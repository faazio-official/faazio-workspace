package appconfig

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// ErrDBUnavailable is returned by every repo call when the pool is nil (health-only mode).
var ErrDBUnavailable = errors.New("appconfig: database not configured")

// Row is one admins.app_config row. Value is the raw JSONB so it round-trips exactly.
type Row struct {
	Key         string          `json:"key"`
	Category    string          `json:"category"`
	Value       json.RawMessage `json:"value"`
	IsPublic    bool            `json:"isPublic"`
	AppVariant  string          `json:"appVariant"`
	ValueSecret bool            `json:"valueSecret"`
	Description string          `json:"description"`
	UpdatedBy   string          `json:"updatedBy,omitempty"`
	UpdatedAt   string          `json:"updatedAt"`
}

// Repo reads/writes admins.app_config. The gateway (service_role) is the only writer; public rows
// are the mobile-app remote-config surface (GET /app-config) and the SUPER_ADMIN control plane.
type Repo struct {
	pool *db.Pool
}

// New returns an appconfig repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const rowSelect = `
	select key, category, value, is_public, app_variant, value_secret, description, updated_by, updated_at
	  from admins.app_config`

// scanRow decodes one row. Timestamps are formatted RFC3339 UTC so clients get a stable string.
func scanRow(row pgx.Row) (Row, error) {
	var r Row
	var updatedAt time.Time
	var value []byte
	err := row.Scan(&r.Key, &r.Category, &value, &r.IsPublic, &r.AppVariant,
		&r.ValueSecret, &r.Description, &r.UpdatedBy, &updatedAt)
	if err != nil {
		return Row{}, err
	}
	r.Value = json.RawMessage(value)
	r.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if len(r.Value) == 0 {
		r.Value = json.RawMessage("null")
	}
	return r, nil
}

// ListPublic returns the rows served to the mobile apps: public only, wildcarded to the given
// app variant ("all" rows always match). A row marked secret can never be public (DB + handler
// guard), so no masking is needed here.
func (r *Repo) ListPublic(ctx context.Context, variant string) ([]Row, error) {
	if r.pool == nil {
		return nil, ErrDBUnavailable
	}
	rows, err := r.pool.Query(ctx, rowSelect+`
		 where is_public
		   and (app_variant = 'all' or app_variant = $1)
		 order by category, key`, variant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Row{}
	for rows.Next() {
		r, err := scanRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// List returns every row for the SUPER_ADMIN control plane (secret values masked by the handler).
func (r *Repo) List(ctx context.Context) ([]Row, error) {
	if r.pool == nil {
		return nil, ErrDBUnavailable
	}
	rows, err := r.pool.Query(ctx, rowSelect+" order by category, key")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Row{}
	for rows.Next() {
		r, err := scanRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Get returns one row. found is false when the key does not exist.
func (r *Repo) Get(ctx context.Context, key string) (Row, bool, error) {
	if r.pool == nil {
		return Row{}, false, ErrDBUnavailable
	}
	row, err := scanRow(r.pool.QueryRow(ctx, rowSelect+" where key = $1", key))
	if errors.Is(err, pgx.ErrNoRows) {
		return Row{}, false, nil
	}
	if err != nil {
		return Row{}, false, err
	}
	return row, true, nil
}

// Upsert creates or updates one config row. actorID is the SUPER_ADMIN portal user id.
func (r *Repo) Upsert(ctx context.Context, in Row, actorID string) (Row, error) {
	if r.pool == nil {
		return Row{}, ErrDBUnavailable
	}
	row, err := scanRow(r.pool.QueryRow(ctx, `
		insert into admins.app_config
		  (key, category, value, is_public, app_variant, value_secret, description, updated_by)
		values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
		on conflict (key) do update
		  set category     = excluded.category,
		      value        = excluded.value,
		      is_public    = excluded.is_public,
		      app_variant  = excluded.app_variant,
		      value_secret = excluded.value_secret,
		      description  = excluded.description,
		      updated_by   = excluded.updated_by,
		      updated_at   = now()
		returning key, category, value, is_public, app_variant, value_secret, description, updated_by, updated_at`,
		in.Key, in.Category, in.Value, in.IsPublic, in.AppVariant, in.ValueSecret, in.Description, actorID))
	if err != nil {
		return Row{}, err
	}
	return row, nil
}

// Delete removes one config row. Returns ok=false when the key did not exist.
func (r *Repo) Delete(ctx context.Context, key string) (bool, error) {
	if r.pool == nil {
		return false, ErrDBUnavailable
	}
	tag, err := r.pool.Exec(ctx, `delete from admins.app_config where key = $1`, key)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}