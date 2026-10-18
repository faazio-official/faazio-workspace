// Package blood serves the blood-donor registry, requests, interests, and donor-match requests.
// Future service: Go + Postgres (monolith-breakdown.md §1). Health PII: consent gates the public
// directory, and contact/address are redacted for anon by the handler.
package blood

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Repo reads/writes the blood schema.
type Repo struct {
	pool *db.Pool
}

// New returns a blood repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// Donor returns the caller's own donor profile.
func (r *Repo) Donor(ctx context.Context, userID string) (contracts.BloodDonor, bool, error) {
	if r.pool == nil {
		return contracts.BloodDonor{}, false, fmt.Errorf("blood: database not configured")
	}
	var (
		d      contracts.BloodDonor
		age    *string
		weight *int64
		dtype  *string
		notif  []byte
	)
	err := r.pool.QueryRow(ctx, `
		select user_id, name, blood_group, age_range, weight_kg, city, willing_to_travel,
		       donation_type, notif, available, consent
		  from blood.donors where user_id = $1`, userID).
		Scan(&d.UserID, &d.Name, &d.BloodGroup, &age, &weight, &d.City, &d.WillingToTravel, &dtype, &notif, &d.Available, &d.Consent)
	if err != nil {
		if err == pgx.ErrNoRows {
			return contracts.BloodDonor{}, false, nil
		}
		return contracts.BloodDonor{}, false, err
	}
	d.AgeRange = derefStr(age)
	d.WeightKg = weight
	d.DonationType = derefStr(dtype)
	d.Notif = json.RawMessage(notif)
	return d, true, nil
}

// UpsertDonor inserts or updates the caller's donor profile. Consent is explicit; consent_at is set
// when consent is first granted.
func (r *Repo) UpsertDonor(ctx context.Context, d contracts.BloodDonor) error {
	if r.pool == nil {
		return fmt.Errorf("blood: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		insert into blood.donors
		  (user_id, name, blood_group, age_range, weight_kg, city, willing_to_travel, donation_type, notif, available, consent, consent_at, updated_at)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, case when $11 then now() else null end, now())
		on conflict (user_id) do update set
		  name = excluded.name, blood_group = excluded.blood_group, age_range = excluded.age_range,
		  weight_kg = excluded.weight_kg, city = excluded.city, willing_to_travel = excluded.willing_to_travel,
		  donation_type = excluded.donation_type, notif = excluded.notif, available = excluded.available,
		  consent = excluded.consent,
		  consent_at = case when excluded.consent and blood.donors.consent_at is null then now() else blood.donors.consent_at end,
		  updated_at = now()`,
		d.UserID, d.Name, d.BloodGroup, nullIfEmpty(d.AgeRange), d.WeightKg, d.City, d.WillingToTravel,
		nullIfEmpty(d.DonationType), nullIfEmptyJSON(d.Notif), d.Available, d.Consent)
	return err
}

// Directory returns consented, available donors matching an optional blood group / city.
func (r *Repo) Directory(ctx context.Context, bloodGroup, city string) ([]contracts.BloodDonor, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("blood: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select user_id, name, blood_group, city, donation_type, willing_to_travel, available
		  from blood.donor_directory
		 where ($1 = '' or blood_group = $1) and ($2 = '' or city = $2)
		 order by name`, bloodGroup, city)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.BloodDonor{}
	for rows.Next() {
		var (
			d     contracts.BloodDonor
			dtype *string
		)
		if err := rows.Scan(&d.UserID, &d.Name, &d.BloodGroup, &d.City, &dtype, &d.WillingToTravel, &d.Available); err != nil {
			return nil, err
		}
		d.DonationType = derefStr(dtype)
		d.Consent = true
		out = append(out, d)
	}
	return out, rows.Err()
}

// Requests lists active requests matching an optional blood group / city, newest first.
func (r *Repo) Requests(ctx context.Context, bloodGroup, city string) ([]contracts.BloodRequest, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("blood: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select id, hospital, city, state, blood_group, units, patient_context, needed_within,
		       verified, urgency, coalesce(contact,''), coalesce(address,''), coalesce(remarks,''),
		       posted_at, expires_at
		  from blood.requests
		 where ($1 = '' or blood_group = $1) and ($2 = '' or city = $2)
		 order by posted_at desc`, bloodGroup, city)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	now := time.Now().UTC()
	out := []contracts.BloodRequest{}
	for rows.Next() {
		var (
			req       contracts.BloodRequest
			postedAt  time.Time
			expiresAt *time.Time
		)
		if err := rows.Scan(&req.ID, &req.Hospital, &req.City, &req.State, &req.BloodGroup, &req.UnitsRequired,
			&req.PatientContext, &req.NeededWithin, &req.Verified, &req.Urgency, &req.Contact, &req.Address, &req.Remarks,
			&postedAt, &expiresAt); err != nil {
			return nil, err
		}
		req.PostedAt = postedAt.UTC().Format(time.RFC3339)
		req.PostedHoursAgo = int64(now.Sub(postedAt).Hours())
		if req.PostedHoursAgo < 0 {
			req.PostedHoursAgo = 0
		}
		if expiresAt != nil {
			req.ExpiresAt = expiresAt.UTC().Format(time.RFC3339)
		}
		out = append(out, req)
	}
	return out, rows.Err()
}

// CreateRequest inserts a blood request and returns the persisted row.
func (r *Repo) CreateRequest(ctx context.Context, req contracts.BloodRequest) (contracts.BloodRequest, error) {
	if r.pool == nil {
		return contracts.BloodRequest{}, fmt.Errorf("blood: database not configured")
	}
	req.ID = "br-" + shortID()
	if req.UnitsRequired < 1 {
		req.UnitsRequired = 1
	}
	if req.Urgency == "" {
		req.Urgency = "normal"
	}
	var (
		postedAt  time.Time
		expiresAt *time.Time
	)
	err := r.pool.QueryRow(ctx, `
		insert into blood.requests
		  (id, hospital, city, state, blood_group, units, patient_context, needed_within, urgency, contact, address, remarks, expires_at)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now() + interval '14 days')
		returning posted_at, expires_at`,
		req.ID, req.Hospital, req.City, req.State, req.BloodGroup, req.UnitsRequired, req.PatientContext,
		req.NeededWithin, req.Urgency, nullIfEmpty(req.Contact), nullIfEmpty(req.Address), nullIfEmpty(req.Remarks)).
		Scan(&postedAt, &expiresAt)
	if err != nil {
		return contracts.BloodRequest{}, err
	}
	req.PostedAt = postedAt.UTC().Format(time.RFC3339)
	if expiresAt != nil {
		req.ExpiresAt = expiresAt.UTC().Format(time.RFC3339)
	}
	return req, nil
}

// DeleteRequest removes a request (moderation). Reports whether a row existed.
func (r *Repo) DeleteRequest(ctx context.Context, id string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("blood: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `delete from blood.requests where id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// SetInterest records an "interested"/"accepted" interest (idempotent).
func (r *Repo) SetInterest(ctx context.Context, requestID, donorUserID, kind string) error {
	if r.pool == nil {
		return fmt.Errorf("blood: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		insert into blood.interests (request_id, donor_user_id, kind) values ($1,$2,$3)
		on conflict (request_id, donor_user_id, kind) do nothing`, requestID, donorUserID, kind)
	return err
}

// DeleteInterest removes an "interested"/"accepted" mark (un-interest). Idempotent: deleting a
// non-existent row is a no-op so a repeat un-tap never errors.
func (r *Repo) DeleteInterest(ctx context.Context, requestID, donorUserID, kind string) error {
	if r.pool == nil {
		return fmt.Errorf("blood: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		delete from blood.interests where request_id = $1 and donor_user_id = $2 and kind = $3`,
		requestID, donorUserID, kind)
	return err
}

// CreateMatch records a donor-match request from the caller to a donor.
func (r *Repo) CreateMatch(ctx context.Context, m contracts.DonorMatch) (contracts.DonorMatch, error) {
	if r.pool == nil {
		return contracts.DonorMatch{}, fmt.Errorf("blood: database not configured")
	}
	m.ID = "dmr-" + shortID()
	m.Status = "pending"
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into blood.match_requests (id, requester_user_id, donor_user_id, blood_group, city)
		values ($1,$2,$3,$4,$5) returning created_at`,
		m.ID, m.RequesterUserID, m.DonorUserID, m.BloodGroup, m.City).Scan(&createdAt)
	if err != nil {
		return contracts.DonorMatch{}, err
	}
	m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return m, nil
}

// MatchesByRequester lists the caller's outgoing donor-match requests.
func (r *Repo) MatchesByRequester(ctx context.Context, userID string) ([]contracts.DonorMatch, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("blood: database not configured")
	}
	return r.matchesWhere(ctx, `requester_user_id = $1`, userID)
}

// MatchesByDonor lists the caller's incoming donor-match requests (rows addressed to them as the
// recipient donor). This is the recipient-scoped surface a second device sees; the requester id is
// included so the card can name the requester without a second round-trip.
func (r *Repo) MatchesByDonor(ctx context.Context, userID string) ([]contracts.DonorMatch, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("blood: database not configured")
	}
	return r.matchesWhere(ctx, `donor_user_id = $1`, userID)
}

func (r *Repo) matchesWhere(ctx context.Context, where string, userID string) ([]contracts.DonorMatch, error) {
	rows, err := r.pool.Query(ctx, `
		select id, requester_user_id, donor_user_id, blood_group, city, status::text, created_at, responded_at
		  from blood.match_requests where `+where+` order by created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.DonorMatch{}
	for rows.Next() {
		var (
			m           contracts.DonorMatch
			createdAt   time.Time
			respondedAt *time.Time
		)
		if err := rows.Scan(&m.ID, &m.RequesterUserID, &m.DonorUserID, &m.BloodGroup, &m.City, &m.Status, &createdAt, &respondedAt); err != nil {
			return nil, err
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if respondedAt != nil {
			m.RespondedAt = respondedAt.UTC().Format(time.RFC3339)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// SetMatchStatus lets the recipient (donor) accept or decline their own pending match. It is scoped
// to `donor_user_id = donorUserID AND status = 'pending'`, so a non-recipient or a double-response is
// a no-op returning ok=false. Returns the updated row (with the requester id for the notification).
func (r *Repo) SetMatchStatus(ctx context.Context, id, donorUserID, status string) (contracts.DonorMatch, bool, error) {
	if r.pool == nil {
		return contracts.DonorMatch{}, false, fmt.Errorf("blood: database not configured")
	}
	var (
		m           contracts.DonorMatch
		createdAt   time.Time
		respondedAt *time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update blood.match_requests set status = $3::match_status, responded_at = now()
		 where id = $1 and donor_user_id = $2 and status = 'pending'
		returning id, requester_user_id, donor_user_id, blood_group, city, status::text, created_at, responded_at`,
		id, donorUserID, status).
		Scan(&m.ID, &m.RequesterUserID, &m.DonorUserID, &m.BloodGroup, &m.City, &m.Status, &createdAt, &respondedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return contracts.DonorMatch{}, false, nil
		}
		return contracts.DonorMatch{}, false, err
	}
	m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	if respondedAt != nil {
		m.RespondedAt = respondedAt.UTC().Format(time.RFC3339)
	}
	return m, true, nil
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func derefStr(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func nullIfEmptyJSON(v json.RawMessage) any {
	if len(v) == 0 {
		return nil
	}
	return string(v)
}
