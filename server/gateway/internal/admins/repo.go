// Package admins owns the partner audit trail (admins.audit_logs) and state-admin directory
// (admins.state_admins). Future service: Go + CockroachDB (monolith-breakdown.md §1). Audit rows are
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

// StateAdmin is one admins.state_admins row.
type StateAdmin struct {
	AdminID      string `json:"adminId"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	StateCode    string `json:"stateCode"`
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

// ListStateAdmins returns state admins, optionally scoped to one state.
func (r *Repo) ListStateAdmins(ctx context.Context, stateCode string) ([]StateAdmin, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("admins: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select admin_id, name, email, phone, state_code, active, created_at, last_active_at
		  from admins.state_admins
		 where ($1 = '' or state_code = $1)
		 order by created_at desc`, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StateAdmin{}
	for rows.Next() {
		var (
			a          StateAdmin
			createdAt  time.Time
			lastActive time.Time
		)
		if err := rows.Scan(&a.AdminID, &a.Name, &a.Email, &a.Phone, &a.StateCode, &a.Active, &createdAt, &lastActive); err != nil {
			return nil, err
		}
		a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		a.LastActiveAt = lastActive.UTC().Format(time.RFC3339)
		out = append(out, a)
	}
	return out, rows.Err()
}

// CreateStateAdmin inserts a state admin.
func (r *Repo) CreateStateAdmin(ctx context.Context, a StateAdmin) (StateAdmin, error) {
	if r.pool == nil {
		return StateAdmin{}, fmt.Errorf("admins: database not configured")
	}
	a.AdminID = "adm-" + shortID()
	var createdAt, lastActive time.Time
	err := r.pool.QueryRow(ctx, `
		insert into admins.state_admins (admin_id, name, email, phone, state_code, active)
		values ($1,$2,$3,$4,$5,true)
		returning active, created_at, last_active_at`,
		a.AdminID, a.Name, a.Email, a.Phone, a.StateCode).
		Scan(&a.Active, &createdAt, &lastActive)
	if err != nil {
		return StateAdmin{}, err
	}
	a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	a.LastActiveAt = lastActive.UTC().Format(time.RFC3339)
	return a, nil
}

// SetStateAdminActive flips the active flag. Returns ErrNotFound when the row is absent.
func (r *Repo) SetStateAdminActive(ctx context.Context, adminID string, active bool) (StateAdmin, bool, error) {
	if r.pool == nil {
		return StateAdmin{}, false, fmt.Errorf("admins: database not configured")
	}
	var (
		a          StateAdmin
		createdAt  time.Time
		lastActive time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update admins.state_admins set active = $2
		 where admin_id = $1
		 returning admin_id, name, email, phone, state_code, active, created_at, last_active_at`,
		adminID, active).
		Scan(&a.AdminID, &a.Name, &a.Email, &a.Phone, &a.StateCode, &a.Active, &createdAt, &lastActive)
	if err != nil {
		if isNoRows(err) {
			return StateAdmin{}, false, nil
		}
		return StateAdmin{}, false, err
	}
	a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	a.LastActiveAt = lastActive.UTC().Format(time.RFC3339)
	return a, true, nil
}

// DeleteStateAdmin removes a state admin.
func (r *Repo) DeleteStateAdmin(ctx context.Context, adminID string) error {
	if r.pool == nil {
		return fmt.Errorf("admins: database not configured")
	}
	_, err := r.pool.Exec(ctx, `delete from admins.state_admins where admin_id = $1`, adminID)
	return err
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
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
