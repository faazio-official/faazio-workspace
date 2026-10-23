// Package admins owns the partner audit trail (admins.audit_logs) and district-admin directory
// (admins.district_admins). Future service: Go + CockroachDB (monolith-breakdown.md §1). Audit rows are
// append-only by convention (no RLS update/delete policies); the gateway writes them for every
// partner mutation via contracts.AuditWriter.
package admins

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// AuditLog is one admins.audit_logs row.
type AuditLog struct {
	LogID     string          `json:"logId"`
	ActorID   string          `json:"actorId"`
	ActorRole string          `json:"actorRole"`
	Action    string          `json:"action"`
	Entity    string          `json:"entity"`
	EntityID  string          `json:"entityId"`
	Before    json.RawMessage `json:"before,omitempty"`
	After     json.RawMessage `json:"after,omitempty"`
	CreatedAt string          `json:"createdAt"`
}

// DistrictAdmin is one admins.district_admins row. StateCode remains for legacy state-scoped
// rows created before the district rollout; new rows always carry DistrictCode.
type DistrictAdmin struct {
	AdminID      string `json:"adminId"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	DistrictCode string `json:"districtCode"`
	StateCode    string `json:"stateCode,omitempty"`
	Active       bool   `json:"active"`
	CreatedAt    string `json:"createdAt"`
	LastActiveAt string `json:"lastActiveAt"`
}

// Repo reads/writes the admins schema.
type Repo struct {
	pool *db.Pool
}

// New returns an admins repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// Audit inserts one append-only audit row (contracts.AuditWriter).
func (r *Repo) Audit(ctx context.Context, e contracts.AuditEntry) error {
	if r.pool == nil {
		return fmt.Errorf("admins: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		insert into admins.audit_logs (log_id, actor_id, actor_role, action, entity, entity_id, before, after)
		values ($1,$2,$3,$4,$5,$6,$7,$8)`,
		"log-"+shortID(), e.ActorID, e.ActorRole, e.Action, e.Entity, e.EntityID,
		nullJSON(e.Before), nullJSON(e.After))
	return err
}

// ListLogs returns the most recent audit rows, newest first.
func (r *Repo) ListLogs(ctx context.Context, actorRole, entity string, limit int) ([]AuditLog, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("admins: database not configured")
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		select log_id, actor_id, actor_role, action, entity, entity_id, before, after, created_at
		  from admins.audit_logs
		 where ($1 = '' or actor_role = $1)
		   and ($2 = '' or entity = $2)
		 order by created_at desc limit $3`, actorRole, entity, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AuditLog{}
	for rows.Next() {
		var (
			l         AuditLog
			before    []byte
			after     []byte
			createdAt time.Time
		)
		if err := rows.Scan(&l.LogID, &l.ActorID, &l.ActorRole, &l.Action, &l.Entity, &l.EntityID, &before, &after, &createdAt); err != nil {
			return nil, err
		}
		if len(before) > 0 {
			l.Before = json.RawMessage(before)
		}
		if len(after) > 0 {
			l.After = json.RawMessage(after)
		}
		l.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, l)
	}
	return out, rows.Err()
}

// PurgeBefore deletes every audit row older than before via the retention function (0037), which
// batches the delete (chunks of 2000 by ctid) so even a first-run mass purge never takes one long
// lock. Returns the number of rows removed. The caller supplies the cutoff (now − retention) so it
// stays testable with a fixed clock.
func (r *Repo) PurgeBefore(ctx context.Context, before time.Time) (int, error) {
	if r.pool == nil {
		return 0, fmt.Errorf("admins: database not configured")
	}
	var n int
	err := r.pool.QueryRow(ctx, `select admins.purge_audit_logs(now() - $1)`, before).Scan(&n)
	return n, err
}

// ListDistrictAdmins returns district admins, optionally scoped to one district.
func (r *Repo) ListDistrictAdmins(ctx context.Context, districtCode string) ([]DistrictAdmin, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("admins: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select admin_id, name, email, phone, coalesce(district_code,''), coalesce(state_code,''), active, created_at, last_active_at
		  from admins.district_admins
		 where ($1 = '' or district_code = $1)
		 order by created_at desc`, districtCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DistrictAdmin{}
	for rows.Next() {
		var (
			a          DistrictAdmin
			createdAt  time.Time
			lastActive time.Time
		)
		if err := rows.Scan(&a.AdminID, &a.Name, &a.Email, &a.Phone, &a.DistrictCode, &a.StateCode, &a.Active, &createdAt, &lastActive); err != nil {
			return nil, err
		}
		a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		a.LastActiveAt = lastActive.UTC().Format(time.RFC3339)
		out = append(out, a)
	}
	return out, rows.Err()
}

// CreateDistrictAdmin inserts a district admin.
func (r *Repo) CreateDistrictAdmin(ctx context.Context, a DistrictAdmin) (DistrictAdmin, error) {
	if r.pool == nil {
		return DistrictAdmin{}, fmt.Errorf("admins: database not configured")
	}
	a.AdminID = "adm-" + shortID()
	var createdAt, lastActive time.Time
	err := r.pool.QueryRow(ctx, `
		insert into admins.district_admins (admin_id, name, email, phone, district_code, state_code, active)
		values ($1,$2,$3,$4,$5,$6,true)
		returning active, created_at, last_active_at`,
		a.AdminID, a.Name, a.Email, a.Phone, nullIfEmpty(a.DistrictCode), nullIfEmpty(a.StateCode)).
		Scan(&a.Active, &createdAt, &lastActive)
	if err != nil {
		return DistrictAdmin{}, err
	}
	a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	a.LastActiveAt = lastActive.UTC().Format(time.RFC3339)
	return a, nil
}

// SetDistrictAdminActive flips the active flag. Returns ErrNotFound when the row is absent.
func (r *Repo) SetDistrictAdminActive(ctx context.Context, adminID string, active bool) (DistrictAdmin, bool, error) {
	if r.pool == nil {
		return DistrictAdmin{}, false, fmt.Errorf("admins: database not configured")
	}
	var (
		a          DistrictAdmin
		createdAt  time.Time
		lastActive time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update admins.district_admins set active = $2
		 where admin_id = $1
		 returning admin_id, name, email, phone, coalesce(district_code,''), coalesce(state_code,''), active, created_at, last_active_at`,
		adminID, active).
		Scan(&a.AdminID, &a.Name, &a.Email, &a.Phone, &a.DistrictCode, &a.StateCode, &a.Active, &createdAt, &lastActive)
	if err != nil {
		if isNoRows(err) {
			return DistrictAdmin{}, false, nil
		}
		return DistrictAdmin{}, false, err
	}
	a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	a.LastActiveAt = lastActive.UTC().Format(time.RFC3339)
	return a, true, nil
}

// DeleteDistrictAdmin removes a district admin.
func (r *Repo) DeleteDistrictAdmin(ctx context.Context, adminID string) error {
	if r.pool == nil {
		return fmt.Errorf("admins: database not configured")
	}
	_, err := r.pool.Exec(ctx, `delete from admins.district_admins where admin_id = $1`, adminID)
	return err
}

// Customer is one checkout.users_admin projection row — PII-redacted (no phone/address/email).
type Customer struct {
	UserID      string `json:"userId"`
	Name        string `json:"name"`
	StateCode   string `json:"stateCode,omitempty"`
	OrdersCount int64  `json:"ordersCount"`
	Spend       int64  `json:"spend"` // whole rupees
	LastOrderAt string `json:"lastOrderAt,omitempty"`
	CreatedAt   string `json:"createdAt,omitempty"`
}

// Customers reads the PII-safe customer projection, optionally scoped to one state. The gateway
// connects as service_role, so it reads the full (redacted) view; direct Supabase clients are never
// granted SELECT on it (0017).
func (r *Repo) Customers(ctx context.Context, stateCode string, limit int) ([]Customer, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("admins: database not configured")
	}
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := r.pool.Query(ctx, `
		select user_id, name, coalesce(state_code,''), orders_count, spend_paisa, last_order_at, created_at
		  from checkout.users_admin
		 where ($1 = '' or state_code = $1)
		 order by spend_paisa desc, user_id asc
		 limit $2`, stateCode, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Customer{}
	for rows.Next() {
		var (
			c           Customer
			lastOrderAt *time.Time
			createdAt   time.Time
		)
		if err := rows.Scan(&c.UserID, &c.Name, &c.StateCode, &c.OrdersCount, &c.Spend, &lastOrderAt, &createdAt); err != nil {
			return nil, err
		}
		c.Spend = c.Spend / 100
		if lastOrderAt != nil {
			c.LastOrderAt = lastOrderAt.UTC().Format(time.RFC3339)
		}
		c.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, c)
	}
	return out, rows.Err()
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func nullJSON(v json.RawMessage) any {
	if len(v) == 0 {
		return nil
	}
	return string(v)
}

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
