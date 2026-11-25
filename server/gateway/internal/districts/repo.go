// Package districts owns the production district master (admins.district_master, migrations 0046 +
// 0114). The DB is the single source of truth: GET /geo/districts serves the picker read and the
// SUPER_ADMIN write API (POST/PUT/DELETE/PATCH under /admin/districts) is the only way a district is
// created, renamed, retired or re-enabled. internal/platform/geo keeps the in-process validation
// mirror and is reloaded after every write, so new rows are valid for onboarding/scoping immediately.
//
// It is a distinct context, not internal/geo: that package is the delivery-zone hex grid, and
// internal/platform/geo is the district validation cache.
package districts

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// District is one admins.district_master row on the wire for the SUPER_ADMIN coverage API: the
// picker fields plus the lifecycle fields the coverage table shows.
type District struct {
	DistrictCode string `json:"districtCode"`
	Name         string `json:"name"`
	StateCode    string `json:"stateCode"`
	IsActive     bool   `json:"isActive"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

// PickerDistrict is the seller-picker wire row from GET /geo/districts. It keeps the original
// 3-field shape identical to the client fixture DistrictInfo (@data/districts) — no lifecycle fields
// leak into the mobile picker contract — plus the district centroid (0133) so the customer
// service-area gate can resolve the nearest active district from the origin coordinates when the
// platform geocoder omits the district name. Both are null when a district has no seeded centroid.
type PickerDistrict struct {
	DistrictCode string   `json:"districtCode"`
	Name         string   `json:"name"`
	StateCode    string   `json:"stateCode"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
}

// Input is a create/update payload. Code is only read on create — it is the primary key, so an
// update addresses the row by its code and never rewrites it.
type Input struct {
	Code      string `json:"districtCode"`
	Name      string `json:"name"`
	StateCode string `json:"stateCode"`
	IsActive  *bool  `json:"isActive"`
}

// ErrNotFound is returned when a district code does not exist.
var ErrNotFound = errors.New("districts: not found")

// ErrDuplicate is returned when a create re-uses an existing district code.
var ErrDuplicate = errors.New("districts: duplicate code")

// ErrReferenced is returned when a delete is blocked because another row still points at the
// district (sellers, district admins, delivery payouts). Deactivate instead.
var ErrReferenced = errors.New("districts: referenced by other rows")

// Repo reads/writes the district master. The gateway (service_role) is the only writer.
type Repo struct {
	pool *db.Pool
}

// NewRepo returns a districts repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const adminSelect = `select district_code as "districtCode", district_name as "name",
	state_code::text as "stateCode", is_active, created_at::text, updated_at::text`

// List returns active districts, optionally narrowed to one 2-letter state code ("" means all). The
// predicate hits the partial index district_master_state_idx (state_code, district_name)
// WHERE is_active. Order is Tamil Nadu first (the primary coverage state), then the remaining states
// by code, then districts by name — the same order as internal/platform/geo and the @data fixtures
// (locked by TestListMatchesMirror).
func (r *Repo) List(ctx context.Context, stateCode string) ([]PickerDistrict, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("districts: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select district_code as "districtCode", district_name as "name", state_code::text as "stateCode",
		       latitude, longitude
		  from admins.district_master
		 where is_active and ($1 = '' or state_code = $1)
		 order by (state_code <> 'TN'), state_code, district_name`, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PickerDistrict{}
	for rows.Next() {
		var d PickerDistrict
		if err := rows.Scan(&d.DistrictCode, &d.Name, &d.StateCode, &d.Latitude, &d.Longitude); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// ListAll returns every district including deactivated ones, for the SUPER_ADMIN coverage page.
// Same ordering as List so the portal table matches the mobile picker.
func (r *Repo) ListAll(ctx context.Context, stateCode string) ([]District, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("districts: database not configured")
	}
	rows, err := r.pool.Query(ctx, adminSelect+`
		  from admins.district_master
		 where ($1 = '' or state_code = $1)
		 order by (state_code <> 'TN'), state_code, district_name`, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []District{}
	for rows.Next() {
		var d District
		if err := rows.Scan(&d.DistrictCode, &d.Name, &d.StateCode, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// Get returns one district (active or not) by code.
func (r *Repo) Get(ctx context.Context, code string) (District, error) {
	if r.pool == nil {
		return District{}, fmt.Errorf("districts: database not configured")
	}
	var d District
	err := r.pool.QueryRow(ctx, adminSelect+` from admins.district_master where district_code = $1`, code).
		Scan(&d.DistrictCode, &d.Name, &d.StateCode, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return District{}, ErrNotFound
		}
		return District{}, err
	}
	return d, nil
}

// Create inserts a district. is_active defaults to true when the payload omits it.
func (r *Repo) Create(ctx context.Context, in Input) (District, error) {
	if r.pool == nil {
		return District{}, fmt.Errorf("districts: database not configured")
	}
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	var d District
	err := r.pool.QueryRow(ctx, `
		insert into admins.district_master (district_code, district_name, state_code, is_active)
		values ($1, $2, $3, $4)
		returning district_code as "districtCode", district_name as "name",
		          state_code::text as "stateCode", is_active,
		          created_at::text, updated_at::text`,
		strings.TrimSpace(in.Code), strings.TrimSpace(in.Name), strings.TrimSpace(in.StateCode), active).
		Scan(&d.DistrictCode, &d.Name, &d.StateCode, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return District{}, ErrDuplicate
		}
		return District{}, err
	}
	return d, nil
}

// Update renames a district and/or moves it to another state. The code is immutable (it is the PK
// and the FK target of sellers/admins/payouts). A nil IsActive leaves the flag unchanged.
func (r *Repo) Update(ctx context.Context, code string, in Input) (District, error) {
	if r.pool == nil {
		return District{}, fmt.Errorf("districts: database not configured")
	}
	var d District
	err := r.pool.QueryRow(ctx, `
		update admins.district_master
		   set district_name = $2,
		       state_code = $3,
		       is_active = coalesce($4, is_active)
		 where district_code = $1
		returning district_code as "districtCode", district_name as "name",
		          state_code::text as "stateCode", is_active,
		          created_at::text, updated_at::text`,
		code, strings.TrimSpace(in.Name), strings.TrimSpace(in.StateCode), in.IsActive).
		Scan(&d.DistrictCode, &d.Name, &d.StateCode, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return District{}, ErrNotFound
		}
		return District{}, err
	}
	return d, nil
}

// SetActive flips is_active (the picker visibility switch) without touching the name or state.
func (r *Repo) SetActive(ctx context.Context, code string, active bool) (District, error) {
	if r.pool == nil {
		return District{}, fmt.Errorf("districts: database not configured")
	}
	var d District
	err := r.pool.QueryRow(ctx, `
		update admins.district_master
		   set is_active = $2
		 where district_code = $1
		returning district_code as "districtCode", district_name as "name",
		          state_code::text as "stateCode", is_active,
		          created_at::text, updated_at::text`, code, active).
		Scan(&d.DistrictCode, &d.Name, &d.StateCode, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return District{}, ErrNotFound
		}
		return District{}, err
	}
	return d, nil
}

// Delete removes a district row. 0047/0048/0055 FK it ON DELETE RESTRICT, so a district that still
// has sellers, district admins or delivery payouts is refused (ErrReferenced) — the operator must
// deactivate it instead. 0049/0111 use ON DELETE SET NULL and are happily nulled by the FK.
func (r *Repo) Delete(ctx context.Context, code string) error {
	if r.pool == nil {
		return fmt.Errorf("districts: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `delete from admins.district_master where district_code = $1`, code)
	if err != nil {
		if isForeignKeyViolation(err) {
			return ErrReferenced
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// StateExists reports whether stateCode is a known (any activation state) admins.states row. The
// coverage states are already in the geo mirror; this lookup keeps a newly seeded state usable
// without a gateway deploy.
func (r *Repo) StateExists(ctx context.Context, stateCode string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("districts: database not configured")
	}
	var exists bool
	err := r.pool.QueryRow(ctx, `select exists (select 1 from admins.states where state_code = $1)`,
		stateCode).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// isUniqueViolation reports whether err is a Postgres unique-constraint violation (SQLSTATE 23505).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// isForeignKeyViolation reports whether err is a Postgres FK violation (SQLSTATE 23503).
func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
