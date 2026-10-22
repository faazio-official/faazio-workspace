package delivery

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Repo is the Postgres store for the delivery context.
type Repo struct {
	pool *db.Pool
}

// New returns a delivery repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

func shortID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (r *Repo) ready() error {
	if r.pool == nil {
		return fmt.Errorf("delivery: database not configured")
	}
	return nil
}

// CreateApplication upserts a rider application in PENDING_REVIEW and replaces its document/bank
// rows. An ACTIVE/VERIFIED/SUSPENDED/BLACKLISTED rider cannot re-apply through this path.
func (r *Repo) CreateApplication(ctx context.Context, phone, userID string, req ApplyRequest, maskedAccount string) (Rider, error) {
	if err := r.ready(); err != nil {
		return Rider{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Rider{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var riderID string
	var existingStatus string
	err = tx.QueryRow(ctx, `select rider_id, status::text from delivery.delivery_boys where phone = $1`, phone).
		Scan(&riderID, &existingStatus)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		riderID = "rider-" + shortID()
		_, err = tx.Exec(ctx, `
			insert into delivery.delivery_boys
			  (rider_id, user_id, phone, full_name, state_code, hub_zone, address, city,
			   pincode, emergency_contact, vehicle_type, max_capacity, status)
			values ($1,nullif($2,''),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PENDING_REVIEW')`,
			riderID, userID, phone, req.FullName, strings.ToUpper(req.StateCode), req.HubZone,
			req.Address, req.City, req.Pincode, req.EmergencyContact, req.VehicleType, req.MaxCapacity)
		if err != nil {
			return Rider{}, err
		}
	case err != nil:
		return Rider{}, err
	case existingStatus == StatusActive || existingStatus == StatusVerified ||
		existingStatus == StatusSuspended || existingStatus == StatusBlacklisted:
		return Rider{}, fmt.Errorf("%w: an active or verified rider cannot re-apply", ErrConflict)
	default:
		_, err = tx.Exec(ctx, `
			update delivery.delivery_boys
			   set user_id=coalesce(nullif($2,''),user_id),
			       full_name=$3, state_code=$4, hub_zone=$5, address=$6, city=$7, pincode=$8,
			       emergency_contact=$9, vehicle_type=$10, max_capacity=$11,
			       status='PENDING_REVIEW', rejection_reason='', updated_at=now()
			 where rider_id=$1`,
			riderID, userID, req.FullName, strings.ToUpper(req.StateCode), req.HubZone,
			req.Address, req.City, req.Pincode, req.EmergencyContact, req.VehicleType, req.MaxCapacity)
		if err != nil {
			return Rider{}, err
		}
	}

	if _, err = tx.Exec(ctx, `delete from delivery.delivery_documents where rider_id = $1`, riderID); err != nil {
		return Rider{}, err
	}
	for _, d := range req.Documents {
		_, err = tx.Exec(ctx, `
			insert into delivery.delivery_documents (doc_id, rider_id, doc_type, file_key, asset_id, status)
			values ($1,$2,$3,$4,$5,'PENDING')`,
			"doc-"+shortID(), riderID, d.DocType, d.FileKey, nullString(d.AssetID))
		if err != nil {
			return Rider{}, err
		}
	}
	if _, err = tx.Exec(ctx, `delete from delivery.delivery_bank_accounts where rider_id = $1`, riderID); err != nil {
		return Rider{}, err
	}
	_, err = tx.Exec(ctx, `
		insert into delivery.delivery_bank_accounts
		  (bank_account_id, rider_id, account_name, account_number_masked, ifsc, cheque_key, cheque_asset_id, status)
		values ($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
		"bank-"+shortID(), riderID, req.Bank.AccountName, maskedAccount, strings.ToUpper(req.Bank.IFSC),
		nullString(req.Bank.ChequeKey), nullString(req.Bank.ChequeAssetID))
	if err != nil {
		return Rider{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Rider{}, err
	}
	detail, ok, err := r.Detail(ctx, riderID)
	if err != nil {
		return Rider{}, err
	}
	if !ok {
		return Rider{}, ErrNotFound
	}
	return detail.Rider, nil
}

// List returns rider rows scoped by the filter.
func (r *Repo) List(ctx context.Context, f ListFilter) ([]Rider, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	where := []string{"1=1"}
	args := []any{}
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }
	if f.StateCode != "" {
		where = append(where, "state_code = "+arg(strings.ToUpper(f.StateCode)))
	}
	if f.Status != "" {
		where = append(where, "status = "+arg(strings.ToUpper(f.Status))+"::delivery_partner_status")
	}
	if f.Available {
		where = append(where, "is_available = true")
	}
	if f.OnlyOnline {
		// Online authority is the Valkey coordinate key (TTL 300 s), checked by the caller after
		// this query. The Postgres last_heartbeat_at column is only a best-effort mirror.
		where = append(where, "status = 'ACTIVE'", "is_available = true", "current_load < max_capacity")
	}
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	where = append(where, "1=1")
	rows, err := r.pool.Query(ctx, `
		select rider_id, coalesce(user_id,''), phone, full_name, state_code, hub_zone, address, city,
		       pincode, emergency_contact, vehicle_type::text, max_capacity, status::text, is_available,
		       current_load, rating, completed_orders, last_heartbeat_at, rejection_reason, created_at
		  from delivery.delivery_boys
		 where `+strings.Join(where, " and ")+`
		 order by created_at desc
		 limit `+fmt.Sprintf("%d", limit), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Rider, 0, limit)
	for rows.Next() {
		var x Rider
		var last *time.Time
		if err := rows.Scan(&x.RiderID, &x.UserID, &x.Phone, &x.FullName, &x.StateCode, &x.HubZone,
			&x.Address, &x.City, &x.Pincode, &x.EmergencyContact, &x.VehicleType, &x.MaxCapacity, &x.Status,
			&x.IsAvailable, &x.CurrentLoad, &x.Rating, &x.CompletedOrders, &last, &x.RejectionReason,
			&x.CreatedAt); err != nil {
			return nil, err
		}
		x.LastHeartbeatAt = iso(last)
		out = append(out, x)
	}
	return out, rows.Err()
}

func (r *Repo) riderByID(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, riderID string) (Rider, error) {
	var x Rider
	var last *time.Time
	err := q.QueryRow(ctx, `
		select rider_id, coalesce(user_id,''), phone, full_name, state_code, hub_zone, address, city,
		       pincode, emergency_contact, vehicle_type::text, max_capacity, status::text, is_available,
		       current_load, rating, completed_orders, last_heartbeat_at, rejection_reason, created_at
		  from delivery.delivery_boys where rider_id = $1`, riderID).
		Scan(&x.RiderID, &x.UserID, &x.Phone, &x.FullName, &x.StateCode, &x.HubZone, &x.Address, &x.City,
			&x.Pincode, &x.EmergencyContact, &x.VehicleType, &x.MaxCapacity, &x.Status,
			&x.IsAvailable, &x.CurrentLoad, &x.Rating, &x.CompletedOrders, &last,
			&x.RejectionReason, &x.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Rider{}, ErrNotFound
	}
	x.LastHeartbeatAt = iso(last)
	return x, err
}

// RiderByID returns one rider row.
func (r *Repo) RiderByID(ctx context.Context, riderID string) (Rider, error) {
	if err := r.ready(); err != nil {
		return Rider{}, err
	}
	return r.riderByID(ctx, r.pool, riderID)
}

// RiderByPhone resolves the authenticated rider identity.
func (r *Repo) RiderByPhone(ctx context.Context, phone string) (Rider, error) {
	if err := r.ready(); err != nil {
		return Rider{}, err
	}
	var riderID string
	err := r.pool.QueryRow(ctx, `select rider_id from delivery.delivery_boys where phone = $1`, phone).Scan(&riderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Rider{}, ErrNotFound
	}
	if err != nil {
		return Rider{}, err
	}
	return r.riderByID(ctx, r.pool, riderID)
}

// Detail returns a rider with documents + bank account.
func (r *Repo) Detail(ctx context.Context, riderID string) (Detail, bool, error) {
	if err := r.ready(); err != nil {
		return Detail{}, false, err
	}
	rider, err := r.riderByID(ctx, r.pool, riderID)
	if errors.Is(err, ErrNotFound) {
		return Detail{}, false, nil
	}
	if err != nil {
		return Detail{}, false, err
	}
	docs, err := r.documents(ctx, riderID)
	if err != nil {
		return Detail{}, false, err
	}
	bank, err := r.bank(ctx, riderID)
	if err != nil {
		return Detail{}, false, err
	}
	return Detail{Rider: rider, Documents: docs, BankAccount: bank}, true, nil
}

func (r *Repo) documents(ctx context.Context, riderID string) ([]Document, error) {
	rows, err := r.pool.Query(ctx, `
		select doc_id, rider_id, doc_type::text, file_key, coalesce(asset_id,''), status::text,
		       rejection_reason, uploaded_at
		  from delivery.delivery_documents where rider_id = $1 order by doc_type`, riderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Document{}
	for rows.Next() {
		var d Document
		var at time.Time
		if err := rows.Scan(&d.DocID, &d.RiderID, &d.DocType, &d.FileKey, &d.AssetID, &d.Status,
			&d.RejectionReason, &at); err != nil {
			return nil, err
		}
		d.UploadedAt = at.UTC().Format(time.RFC3339)
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *Repo) bank(ctx context.Context, riderID string) (*BankAccount, error) {
	var b BankAccount
	var chequeKey, chequeAsset *string
	var reviewed *time.Time
	var created time.Time
	err := r.pool.QueryRow(ctx, `
		select bank_account_id, rider_id, account_name, account_number_masked, ifsc,
		       cheque_key, cheque_asset_id, status::text, rejection_reason, reviewed_at, created_at
		  from delivery.delivery_bank_accounts where rider_id = $1`, riderID).
		Scan(&b.BankAccountID, &b.RiderID, &b.AccountName, &b.AccountNumberMasked, &b.IFSC,
			&chequeKey, &chequeAsset, &b.Status, &b.RejectionReason, &reviewed, &created)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if chequeKey != nil {
		b.ChequeKey = *chequeKey
	}
	if chequeAsset != nil {
		b.ChequeAssetID = *chequeAsset
	}
	b.CreatedAt = created.UTC().Format(time.RFC3339)
	return &b, nil
}

// SetDocumentStatus marks one document VERIFIED / REJECTED / REUPLOAD_REQUESTED.
func (r *Repo) SetDocumentStatus(ctx context.Context, riderID, docType, status, reason, reviewer string) error {
	if err := r.ready(); err != nil {
		return err
	}
	ct, err := r.pool.Exec(ctx, `
		update delivery.delivery_documents
		   set status = $3::delivery_doc_status, rejection_reason = $4,
		       reviewed_by = $5, reviewed_at = now()
		 where rider_id = $1 and doc_type = $2::delivery_doc_type`,
		riderID, docType, status, reason, reviewer)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ApproveProfile moves a PENDING_REVIEW rider to VERIFIED once no document or the bank account is
// still unresolved.
func (r *Repo) ApproveProfile(ctx context.Context, riderID, reviewer string) error {
	if err := r.ready(); err != nil {
		return err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var current string
	if err := tx.QueryRow(ctx, `select status::text from delivery.delivery_boys where rider_id=$1`, riderID).
		Scan(&current); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if current != StatusPendingReview {
		return fmt.Errorf("%w: only a pending application can be approved", ErrConflict)
	}
	var unresolved int
	if err := tx.QueryRow(ctx, `
		select count(*) from delivery.delivery_documents
		 where rider_id=$1 and status in ('PENDING','REJECTED','REUPLOAD_REQUESTED')`, riderID).Scan(&unresolved); err != nil {
		return err
	}
	if unresolved > 0 {
		return fmt.Errorf("%w: all documents must be verified first", ErrConflict)
	}
	var bankStatus string
	err = tx.QueryRow(ctx, `select status::text from delivery.delivery_bank_accounts where rider_id=$1`, riderID).Scan(&bankStatus)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if bankStatus == "REJECTED" {
		return fmt.Errorf("%w: bank account is rejected", ErrConflict)
	}
	if _, err = tx.Exec(ctx, `
		update delivery.delivery_boys set status='VERIFIED', updated_at=now()
		 where rider_id=$1 and status in ('PENDING_REVIEW','APPLIED','REJECTED')`, riderID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SetStatus applies an admin transition (reject / activate / suspend / blacklist).
func (r *Repo) SetStatus(ctx context.Context, riderID, status, reason string) error {
	if err := r.ready(); err != nil {
		return err
	}
	ct, err := r.pool.Exec(ctx, `
		update delivery.delivery_boys
		   set status = $2::delivery_partner_status,
		       rejection_reason = $3,
		       is_available = case when $2 in ('ACTIVE') then is_available else false end,
		       updated_at = now()
		 where rider_id = $1`, riderID, status, reason)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetAvailability flips the rider online/offline (only ACTIVE riders may go online).
func (r *Repo) SetAvailability(ctx context.Context, riderID string, available bool) error {
	if err := r.ready(); err != nil {
		return err
	}
	ct, err := r.pool.Exec(ctx, `
		update delivery.delivery_boys
		   set is_available = $2, updated_at = now()
		 where rider_id = $1 and status = 'ACTIVE'`, riderID, available)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		var exists bool
		if e := r.pool.QueryRow(ctx, `select exists(select 1 from delivery.delivery_boys where rider_id=$1)`, riderID).Scan(&exists); e != nil {
			return e
		}
		if !exists {
			return ErrNotFound
		}
		return fmt.Errorf("%w: rider is not active", ErrConflict)
	}
	return nil
}

// Heartbeat stamps the low-frequency Postgres mirror: the rider's last-seen time and (when the
// live Valkey key has already expired) the last known coordinates for the admin fallback.
func (r *Repo) Heartbeat(ctx context.Context, riderID string, lat, lng float64) error {
	if err := r.ready(); err != nil {
		return err
	}
	if _, err := r.pool.Exec(ctx,
		`update delivery.delivery_boys set last_heartbeat_at=now(), updated_at=now()
		  where rider_id=$1 and status='ACTIVE' and is_available=true`, riderID); err != nil {
		return err
	}
	// Best-effort mirror only; the Valkey key remains the dispatch source of truth.
	_, err := r.pool.Exec(ctx, `
		insert into delivery.rider_heartbeats (rider_id, last_seen, latitude, longitude)
		values ($1, now(), $2, $3)
		on conflict (rider_id) do update
		   set last_seen=excluded.last_seen, latitude=excluded.latitude, longitude=excluded.longitude`,
		riderID, lat, lng)
	return err
}

// CreateOrder inserts an ASSIGNED order plus its ordered stops.
func (r *Repo) CreateOrder(ctx context.Context, o Order, stops []Stop, otpHash string, otpExpires *time.Time, assignExpires time.Time) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Order{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `
		insert into delivery.delivery_orders
		  (order_id, customer_order_id, store_id, rider_id, status, route_sequence,
		   total_distance_meters, estimated_duration_seconds, payout_amount_paisa, require_otp,
		   assigned_at, expires_at)
		values ($1,$2,$3,$4,'ASSIGNED',$5,$6,$7,$8,$9,now(),$10)`,
		o.OrderID, o.CustomerOrderID, o.StoreID, o.RiderID, o.RouteSequence,
		o.TotalDistanceMeters, o.EstimatedDurationSecs, o.PayoutAmountPaisa, o.RequireOTP, assignExpires)
	if err != nil {
		return Order{}, err
	}
	for i := range stops {
		s := stops[i]
		hash := ""
		if s.Sequence == lastDropSequence(stops) && otpHash != "" {
			hash = otpHash
		}
		var otpExp any
		if hash != "" && otpExpires != nil {
			otpExp = *otpExpires
		}
		_, err = tx.Exec(ctx, `
			insert into delivery.delivery_stops
			  (stop_id, delivery_order_id, sequence, stop_type, status, label, address,
			   latitude, longitude, customer_name, customer_phone, customer_otp_hash, otp_expires_at)
			values ($1,$2,$3,$4::delivery_stop_type,'PENDING',$5,$6,$7,$8,$9,$10,$11,$12)`,
			s.StopID, o.OrderID, s.Sequence, s.StopType, s.Label, s.Address, s.Latitude,
			s.Longitude, s.CustomerName, s.CustomerPhone, nullString(hash), otpExp)
		if err != nil {
			return Order{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Order{}, err
	}
	return r.Route(ctx, o.RiderID, o.OrderID)
}

// AcceptOrder locks an ASSIGNED, unexpired order to the rider and increments their load.
func (r *Repo) AcceptOrder(ctx context.Context, riderID, orderID string) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Order{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	ct, err := tx.Exec(ctx, `
		update delivery.delivery_orders
		   set status='ACCEPTED', accepted_at=now(), updated_at=now()
		 where order_id=$1 and rider_id=$2 and status='ASSIGNED'
		   and (expires_at is null or expires_at > now())`, orderID, riderID)
	if err != nil {
		return Order{}, err
	}
	if ct.RowsAffected() == 0 {
		return Order{}, fmt.Errorf("%w: order is not assignable", ErrConflict)
	}
	load, err := tx.Exec(ctx, `
		update delivery.delivery_boys
		   set current_load = current_load + 1, updated_at=now()
		 where rider_id=$1 and current_load < max_capacity`, riderID)
	if err != nil {
		return Order{}, err
	}
	if load.RowsAffected() == 0 {
		return Order{}, fmt.Errorf("%w: rider is at capacity", ErrConflict)
	}
	if err = tx.Commit(ctx); err != nil {
		return Order{}, err
	}
	return r.Route(ctx, riderID, orderID)
}

// RejectOrder releases an ASSIGNED order and returns the job with the declining rider appended to
// the exclusion list. The handler owns the next-candidate decision (bounded fallback chain).
func (r *Repo) RejectOrder(ctx context.Context, riderID, orderID string) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	ct, err := r.pool.Exec(ctx, `
		update delivery.delivery_orders
		   set status='REJECTED',
		       excluded_rider_ids = case
		         when excluded_rider_ids ? $3 then excluded_rider_ids
		         else excluded_rider_ids || to_jsonb($3::text)
		       end,
		       updated_at=now()
		 where order_id=$1 and rider_id=$2 and status='ASSIGNED'`, orderID, riderID, riderID)
	if err != nil {
		return Order{}, err
	}
	if ct.RowsAffected() == 0 {
		return Order{}, fmt.Errorf("%w: order is not rejectable", ErrConflict)
	}
	return r.OrderByID(ctx, orderID)
}

// ReassignOrder moves a released job to the next rider, resetting the offer window while leaving
// the pickup/drop stops (and their PII) intact. Attempts are incremented atomically.
func (r *Repo) ReassignOrder(
	ctx context.Context,
	orderID, riderID string,
	expiresAt time.Time,
	totalMeters, etaSeconds int64,
) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	ct, err := r.pool.Exec(ctx, `
		update delivery.delivery_orders
		   set rider_id=$2, status='ASSIGNED', assigned_at=now(), accepted_at=null,
		       completed_at=null, expires_at=$3, total_distance_meters=$4,
		       estimated_duration_seconds=$5, dispatch_attempts=dispatch_attempts + 1,
		       updated_at=now()
		 where order_id=$1 and status='REJECTED'`, orderID, riderID, expiresAt, totalMeters, etaSeconds)
	if err != nil {
		return Order{}, err
	}
	if ct.RowsAffected() == 0 {
		return Order{}, fmt.Errorf("%w: order is not reassignable", ErrConflict)
	}
	return r.OrderByID(ctx, orderID)
}

// UpdateStop applies a stop transition and completes the route when every drop is terminal.
func (r *Repo) UpdateStop(ctx context.Context, riderID, stopID, status, failureReason string) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Order{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var (
		orderID  string
		stopType string
		current  string
	)
	if err := tx.QueryRow(ctx, `
		select s.delivery_order_id, s.stop_type::text, s.status::text
		  from delivery.delivery_stops s
		  join delivery.delivery_orders o on o.order_id = s.delivery_order_id
		 where s.stop_id=$1 and o.rider_id=$2 and o.status='ACCEPTED'`, stopID, riderID).
		Scan(&orderID, &stopType, &current); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, ErrNotFound
		}
		return Order{}, err
	}
	if err := validStopTransition(stopType, current, status); err != nil {
		return Order{}, err
	}
	if stopType == "DROP" {
		var pickup string
		if err := tx.QueryRow(ctx, `
			select coalesce((
			         select p.status::text from delivery.delivery_stops p
			          where p.delivery_order_id=$1 and p.stop_type='PICKUP'
			          order by p.sequence limit 1), '')`, orderID).Scan(&pickup); err != nil {
			return Order{}, err
		}
		if pickup != StopPickedUp {
			return Order{}, fmt.Errorf("%w: pick the order up before updating a drop", ErrConflict)
		}
	}
	var arrived, completed any
	if status == StopAtPickup || status == StopAtCustomer {
		arrived = time.Now()
	}
	if status == StopDelivered || status == StopFailed {
		completed = time.Now()
	}
	if _, err := tx.Exec(ctx, `
		update delivery.delivery_stops
		   set status=$2::delivery_stop_status,
		       failure_reason=$3,
		       arrived_at=coalesce($4, arrived_at),
		       completed_at=coalesce($5, completed_at),
		       customer_otp_hash=case when $2::delivery_stop_status='DELIVERED' then null else customer_otp_hash end,
		       otp_expires_at=case when $2::delivery_stop_status='DELIVERED' then null else otp_expires_at end,
		       otp_attempts=case when $2::delivery_stop_status='DELIVERED' then 0 else otp_attempts end
		 where stop_id=$1`, stopID, status, nullString(failureReason), arrived, completed); err != nil {
		return Order{}, err
	}
	if status == StopFailed && stopType == "PICKUP" {
		// A failed pickup aborts the job: close the remaining stops, cancel the dispatch and free
		// the rider's capacity without counting a completed delivery.
		if _, err := tx.Exec(ctx, `
			update delivery.delivery_stops
			   set status='FAILED', completed_at=coalesce(completed_at, now())
			 where delivery_order_id=$1 and stop_id<>$2
			   and status not in ('DELIVERED','FAILED')`, orderID, stopID); err != nil {
			return Order{}, err
		}
		if _, err := tx.Exec(ctx, `
			update delivery.delivery_orders
			   set status='CANCELLED', completed_at=now(), updated_at=now()
			 where order_id=$1`, orderID); err != nil {
			return Order{}, err
		}
		if _, err := tx.Exec(ctx, `
			update delivery.delivery_boys
			   set current_load = greatest(0, current_load - 1), updated_at=now()
			 where rider_id=$1`, riderID); err != nil {
			return Order{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return Order{}, err
		}
		return r.Route(ctx, riderID, orderID)
	}
	if status == StopDelivered || status == StopFailed {
		var open int
		if err := tx.QueryRow(ctx, `
			select count(*) from delivery.delivery_stops
			 where delivery_order_id=$1 and stop_type='DROP'
			   and status not in ('DELIVERED','FAILED')`, orderID).Scan(&open); err != nil {
			return Order{}, err
		}
		if open == 0 {
			if _, err := tx.Exec(ctx, `
				update delivery.delivery_orders
				   set status='ROUTE_COMPLETE', completed_at=now(), updated_at=now()
				 where order_id=$1`, orderID); err != nil {
				return Order{}, err
			}
			var failed int
			if err := tx.QueryRow(ctx, `
				select count(*) from delivery.delivery_stops
				 where delivery_order_id=$1 and stop_type='DROP' and status='FAILED'`, orderID).Scan(&failed); err != nil {
				return Order{}, err
			}
			// Availability stays owned by the rider's explicit toggle, so completion only releases
			// capacity. A route with a failed drop is terminal but is not a completed delivery.
			bumpCompleted := 0
			if failed == 0 {
				bumpCompleted = 1
			}
			if _, err := tx.Exec(ctx, `
				update delivery.delivery_boys
				   set current_load = greatest(0, current_load - 1),
				       completed_orders = completed_orders + $2,
				       updated_at=now()
				 where rider_id=$1`, riderID, bumpCompleted); err != nil {
				return Order{}, err
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Order{}, err
	}
	return r.Route(ctx, riderID, orderID)
}

// Route returns one order with its ordered stops, scoped to the rider.
func (r *Repo) Route(ctx context.Context, riderID, orderID string) (Order, error) {
	return r.orderByID(ctx, riderID, orderID)
}

// ExpiredAssignments returns ASSIGNED jobs whose accept window elapsed, oldest first. The expiry
// worker releases each one and re-offers it through the same bounded fallback chain as a rejection.
func (r *Repo) ExpiredAssignments(ctx context.Context, limit int) ([]string, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 200 {
		limit = 25
	}
	rows, err := r.pool.Query(ctx, `
		select order_id from delivery.delivery_orders
		 where status='ASSIGNED' and expires_at is not null and expires_at <= now()
		 order by expires_at
		 limit $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]string, 0, limit)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// HasCustomerOrder reports whether a customer order already has a delivery job. It makes the
// checkout PACKED auto-dispatch idempotent (a repeated status update must not double-assign).
func (r *Repo) HasCustomerOrder(ctx context.Context, customerOrderID string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	var exists bool
	err := r.pool.QueryRow(ctx,
		`select exists (select 1 from delivery.delivery_orders
		                 where customer_order_id = $1
		                   and status not in ('REJECTED','CANCELLED'))`,
		customerOrderID).Scan(&exists)
	return exists, err
}

// OrderByID returns one order (any rider) for the internal dispatch fallback chain.
func (r *Repo) OrderByID(ctx context.Context, orderID string) (Order, error) {
	return r.orderByID(ctx, "", orderID)
}

func (r *Repo) orderByID(ctx context.Context, riderID, orderID string) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	var o Order
	var accepted, expires, completed *time.Time
	var assigned, created time.Time
	var excluded []byte
	err := r.pool.QueryRow(ctx, `
		select order_id, customer_order_id, store_id, rider_id, status::text, route_sequence,
		       total_distance_meters, estimated_duration_seconds, payout_amount_paisa, require_otp,
		       assigned_at, accepted_at, expires_at, completed_at, created_at,
		       dispatch_attempts, excluded_rider_ids
		  from delivery.delivery_orders
		 where order_id=$1 and ($2 = '' or rider_id=$2)`, orderID, riderID).
		Scan(&o.OrderID, &o.CustomerOrderID, &o.StoreID, &o.RiderID, &o.Status, &o.RouteSequence,
			&o.TotalDistanceMeters, &o.EstimatedDurationSecs, &o.PayoutAmountPaisa, &o.RequireOTP,
			&assigned, &accepted, &expires, &completed, &created,
			&o.DispatchAttempts, &excluded)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrNotFound
	}
	if err != nil {
		return Order{}, err
	}
	if len(excluded) > 0 {
		_ = json.Unmarshal(excluded, &o.ExcludedRiderIDs)
	}
	o.AssignedAt = assigned.UTC().Format(time.RFC3339)
	o.AcceptedAt = iso(accepted)
	o.ExpiresAt = iso(expires)
	o.CompletedAt = iso(completed)
	o.CreatedAt = created.UTC().Format(time.RFC3339)
	rows, err := r.pool.Query(ctx, `
		select stop_id, delivery_order_id, sequence, stop_type::text, status::text, label, address,
		       latitude, longitude, customer_name, customer_phone,
		       (customer_otp_hash is not null) as requires_otp, coalesce(failure_reason,''),
		       arrived_at, completed_at
		  from delivery.delivery_stops where delivery_order_id=$1 order by sequence`, orderID)
	if err != nil {
		return Order{}, err
	}
	defer rows.Close()
	o.Stops = []Stop{}
	for rows.Next() {
		var s Stop
		var arrived, done *time.Time
		if err := rows.Scan(&s.StopID, &s.DeliveryOrderID, &s.Sequence, &s.StopType, &s.Status,
			&s.Label, &s.Address, &s.Latitude, &s.Longitude, &s.CustomerName, &s.CustomerPhone,
			&s.RequiresOTP, &s.FailureReason, &arrived, &done); err != nil {
			return Order{}, err
		}
		s.ArrivedAt = iso(arrived)
		s.CompletedAt = iso(done)
		o.Stops = append(o.Stops, s)
	}
	return o, rows.Err()
}

// ActiveOrders returns the rider's in-flight jobs (ASSIGNED offer + ACCEPTED multi-stop routes)
// newest first. The partner app renders the combined stop list from this projection.
func (r *Repo) ActiveOrders(ctx context.Context, riderID string) ([]Order, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		select order_id from delivery.delivery_orders
		 where rider_id=$1 and status in ('ASSIGNED','ACCEPTED')
		 order by created_at asc`, riderID)
	if err != nil {
		return nil, err
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]Order, 0, len(ids))
	for _, id := range ids {
		order, err := r.Route(ctx, riderID, id)
		if err != nil {
			return nil, err
		}
		out = append(out, order)
	}
	return out, nil
}

// OTPTarget returns the stop's hashed OTP + expiry for the rider's accept-scoped order.
func (r *Repo) OTPTarget(ctx context.Context, riderID, stopID string) (orderID, hash string, expires *time.Time, err error) {
	if err := r.ready(); err != nil {
		return "", "", nil, err
	}
	err = r.pool.QueryRow(ctx, `
		select s.delivery_order_id, coalesce(s.customer_otp_hash,''), s.otp_expires_at
		  from delivery.delivery_stops s
		  join delivery.delivery_orders o on o.order_id = s.delivery_order_id
		 where s.stop_id=$1 and o.rider_id=$2 and o.status='ACCEPTED'`, stopID, riderID).
		Scan(&orderID, &hash, &expires)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil, ErrNotFound
	}
	return orderID, hash, expires, err
}

// maxOTPAttempts bounds verification guesses; the code space is only 10,000.
const maxOTPAttempts = 5

// ConsumeOTPAttempt atomically increments the stop's attempt counter and reports whether this
// attempt is still within the bound. It is accept-scoped to the rider, so another rider can never
// burn a stop's attempts.
func (r *Repo) ConsumeOTPAttempt(ctx context.Context, riderID, stopID string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	var attempts int
	err := r.pool.QueryRow(ctx, `
		update delivery.delivery_stops s
		   set otp_attempts = s.otp_attempts + 1
		  from delivery.delivery_orders o
		 where s.stop_id=$1 and o.order_id=s.delivery_order_id
		   and o.rider_id=$2 and o.status='ACCEPTED'
		returning s.otp_attempts`, stopID, riderID).Scan(&attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrNotFound
	}
	if err != nil {
		return false, err
	}
	return attempts <= maxOTPAttempts, nil
}

// Rate inserts the post-delivery rating and refreshes the rider aggregate.
func (r *Repo) Rate(ctx context.Context, orderID, riderID, customerID string, rating int, comment string) error {
	if err := r.ready(); err != nil {
		return err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `
		insert into delivery.delivery_ratings
		  (rating_id, delivery_order_id, rider_id, customer_id, rating, comment)
		values ($1,$2,$3,$4,$5,$6)
		on conflict (delivery_order_id) do nothing`,
		"rating-"+shortID(), orderID, riderID, customerID, rating, comment); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		update delivery.delivery_boys b
		   set rating = coalesce((select round(avg(rating)::numeric, 2)::real
		                            from delivery.delivery_ratings where rider_id=b.rider_id), 0),
		       updated_at = now()
		 where b.rider_id = $1`, riderID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func lastDropSequence(stops []Stop) int {
	last := 0
	for _, s := range stops {
		if strings.EqualFold(s.StopType, "DROP") && s.Sequence > last {
			last = s.Sequence
		}
	}
	return last
}

func nullString(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

// HeartbeatLocation returns the optional low-frequency mirror coordinates.
func (r *Repo) HeartbeatLocation(ctx context.Context, riderID string) (float64, float64, string, bool) {
	if r.pool == nil {
		return 0, 0, "", false
	}
	var lat, lng float64
	var seen time.Time
	err := r.pool.QueryRow(ctx,
		`select latitude, longitude, last_seen from delivery.rider_heartbeats where rider_id=$1`, riderID).
		Scan(&lat, &lng, &seen)
	if err != nil {
		return 0, 0, "", false
	}
	return lat, lng, seen.UTC().Format(time.RFC3339), true
}

// OrderForRating returns the assigned rider, the checkout order id and the delivery status for a
// completed job. The handler uses it to enforce customer ownership before inserting a rating.
func (r *Repo) OrderForRating(ctx context.Context, orderID string) (riderID, customerOrderID, status string, err error) {
	if r.pool == nil {
		return "", "", "", fmt.Errorf("delivery: database not configured")
	}
	err = r.pool.QueryRow(ctx,
		`select rider_id, customer_order_id, status::text
		   from delivery.delivery_orders where order_id=$1`, orderID).
		Scan(&riderID, &customerOrderID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", ErrNotFound
	}
	return riderID, customerOrderID, status, err
}
