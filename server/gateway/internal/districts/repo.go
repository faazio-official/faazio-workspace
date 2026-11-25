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
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// DistrictTrashWindow is how long a deleted district stays restorable before the purger removes it
// for good. It mirrors the credential trash (0128) and catalogue product trash (0089).
const DistrictTrashWindow = 7 * 24 * time.Hour

// District is one admins.district_master row on the wire for the SUPER_ADMIN coverage API: the
// picker fields plus the lifecycle fields the coverage table shows.
type District struct {
	DistrictCode string `json:"districtCode"`
	Name         string `json:"name"`
	StateCode    string `json:"stateCode"`
	IsActive     bool   `json:"isActive"`
	// InUse is true when a seller, district admin, portal login or delivery order still references
	// the code. The coverage board hides Delete for those rows and the gateway refuses a hard delete.
	InUse     bool   `json:"inUse"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	// DeletedAt/DeleteReason/PurgeAt describe a row in the trash (soft deleted). Empty on a live row.
	DeletedAt    string `json:"deletedAt,omitempty"`
	DeleteReason string `json:"deleteReason,omitempty"`
	PurgeAt      string `json:"purgeAt,omitempty"`
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

// inUseExpr is the reference check shared by the admin read, the soft-delete guard and the purge.
// These four tables FK admins.district_master ON DELETE RESTRICT (0047/0048/0055), so a trashed row
// with any of them must stay until the reference is gone.
const inUseExpr = `(exists (select 1 from sellers.sellers s where s.district_code = dm.district_code)
	or exists (select 1 from admins.district_admins a where a.district_code = dm.district_code)
	or exists (select 1 from admins.portal_users p where p.district_code = dm.district_code)
	or exists (select 1 from delivery.delivery_orders o where o.district_code = dm.district_code))`

const adminSelect = `select dm.district_code as "districtCode", dm.district_name as "name",
	dm.state_code::text as "stateCode", dm.is_active, dm.created_at::text, dm.updated_at::text,
	dm.deleted_at, dm.delete_reason, ` + inUseExpr + ` as in_use
	from admins.district_master dm`

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
		 where is_active and deleted_at is null and ($1 = '' or state_code = $1)
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

// ListAll returns every live district including deactivated ones, for the SUPER_ADMIN coverage page.
// Trashed rows are excluded (GET /admin/districts/trash lists those). Same ordering as List so the
// portal table matches the mobile picker.
func (r *Repo) ListAll(ctx context.Context, stateCode string) ([]District, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("districts: database not configured")
	}
	rows, err := r.pool.Query(ctx, adminSelect+`
		 where dm.deleted_at is null and ($1 = '' or dm.state_code = $1)
		 order by (dm.state_code <> 'TN'), dm.state_code, dm.district_name`, stateCode)
	if err != nil {
		return nil, err
	}
	return scanDistricts(rows)
}

// ListDeleted returns trashed districts still inside the undo window, newest deletion first.
func (r *Repo) ListDeleted(ctx context.Context, stateCode string) ([]District, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("districts: database not configured")
	}
	rows, err := r.pool.Query(ctx, adminSelect+`
		 where dm.deleted_at is not null and ($1 = '' or dm.state_code = $1)
		 order by dm.deleted_at desc`, stateCode)
	if err != nil {
		return nil, err
	}
	return scanDistricts(rows)
}

// Get returns one district (live, deactivated or trashed) by code.
func (r *Repo) Get(ctx context.Context, code string) (District, error) {
	if r.pool == nil {
		return District{}, fmt.Errorf("districts: database not configured")
	}
	d, err := scanDistrict(r.pool.QueryRow(ctx, adminSelect+` where dm.district_code = $1`, code))
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
	var code string
	err := r.pool.QueryRow(ctx, `
		insert into admins.district_master (district_code, district_name, state_code, is_active)
		values ($1, $2, $3, $4)
		returning district_code`,
		strings.TrimSpace(in.Code), strings.TrimSpace(in.Name), strings.TrimSpace(in.StateCode), active).
		Scan(&code)
	if err != nil {
		if isUniqueViolation(err) {
			return District{}, ErrDuplicate
		}
		return District{}, err
	}
	return r.Get(ctx, code)
}

// Update renames a district and/or moves it to another state. The code is immutable (it is the PK
// and the FK target of sellers/admins/payouts). A nil IsActive leaves the flag unchanged.
func (r *Repo) Update(ctx context.Context, code string, in Input) (District, error) {
	if r.pool == nil {
		return District{}, fmt.Errorf("districts: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.district_master
		   set district_name = $2,
		       state_code = $3,
		       is_active = coalesce($4, is_active)
		 where district_code = $1 and deleted_at is null`,
		code, strings.TrimSpace(in.Name), strings.TrimSpace(in.StateCode), in.IsActive)
	if err != nil {
		return District{}, err
	}
	if tag.RowsAffected() == 0 {
		return District{}, ErrNotFound
	}
	return r.Get(ctx, code)
}

// SetActive flips is_active (the picker visibility switch) without touching the name or state.
func (r *Repo) SetActive(ctx context.Context, code string, active bool) (District, error) {
	if r.pool == nil {
		return District{}, fmt.Errorf("districts: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.district_master
		   set is_active = $2
		 where district_code = $1 and deleted_at is null`, code, active)
	if err != nil {
		return District{}, err
	}
	if tag.RowsAffected() == 0 {
		return District{}, ErrNotFound
	}
	return r.Get(ctx, code)
}

// SoftDelete moves a district to the trash instead of removing the row: it stops being served by the
// picker and the geo mirror, but stays a valid FK target for rows already on it. A district still
// referenced by a seller/admin/payout is refused (ErrReferenced) — deactivate it instead.
func (r *Repo) SoftDelete(ctx context.Context, code, reason string) (District, bool, error) {
	if r.pool == nil {
		return District{}, false, fmt.Errorf("districts: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.district_master dm
		   set deleted_at = now(), delete_reason = $2, is_active = false, updated_at = now()
		 where dm.district_code = $1 and dm.deleted_at is null and not `+inUseExpr,
		code, strings.TrimSpace(reason))
	if err != nil {
		return District{}, false, err
	}
	if tag.RowsAffected() == 0 {
		return District{}, false, nil
	}
	d, err := r.Get(ctx, code)
	return d, err == nil, err
}

// Restore clears the trash flag. The row comes back deactivated (is_active stays false), so the
// operator re-enables it deliberately — same contract as a restored credential.
func (r *Repo) Restore(ctx context.Context, code string) (District, bool, error) {
	if r.pool == nil {
		return District{}, false, fmt.Errorf("districts: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.district_master
		   set deleted_at = null, delete_reason = '', updated_at = now()
		 where district_code = $1 and deleted_at is not null`, code)
	if err != nil {
		return District{}, false, err
	}
	if tag.RowsAffected() == 0 {
		return District{}, false, nil
	}
	d, err := r.Get(ctx, code)
	return d, err == nil, err
}

// PurgeOne permanently removes one trashed, unreferenced district. A live row, a row still inside
// the window acted on by an operator, or a referenced row returns ok=false.
func (r *Repo) PurgeOne(ctx context.Context, code string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("districts: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		delete from admins.district_master dm
		 where dm.district_code = $1 and dm.deleted_at is not null and not `+inUseExpr, code)
	if err != nil {
		if isForeignKeyViolation(err) {
			return false, nil
		}
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// PurgeDeleted removes trashed, unreferenced districts older than maxAge. Referenced rows are kept
// (they cannot be hard-deleted because of the RESTRICT FKs) until their references go away.
func (r *Repo) PurgeDeleted(ctx context.Context, maxAge time.Duration) (int64, error) {
	if r.pool == nil {
		return 0, fmt.Errorf("districts: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		delete from admins.district_master dm
		 where dm.deleted_at is not null and dm.deleted_at < $1 and not `+inUseExpr,
		time.Now().Add(-maxAge))
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

type districtScanner interface{ Scan(dest ...any) error }

// scanDistrict reads the adminSelect projection (9 columns) and derives the trash window fields.
func scanDistrict(row districtScanner) (District, error) {
	var (
		d         District
		deletedAt *time.Time
	)
	if err := row.Scan(&d.DistrictCode, &d.Name, &d.StateCode, &d.IsActive, &d.CreatedAt,
		&d.UpdatedAt, &deletedAt, &d.DeleteReason, &d.InUse); err != nil {
		return District{}, err
	}
	if deletedAt != nil {
		d.DeletedAt = deletedAt.UTC().Format(time.RFC3339)
		d.PurgeAt = deletedAt.Add(DistrictTrashWindow).UTC().Format(time.RFC3339)
	}
	return d, nil
}

func scanDistricts(rows pgx.Rows) ([]District, error) {
	defer rows.Close()
	out := []District{}
	for rows.Next() {
		d, err := scanDistrict(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
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
