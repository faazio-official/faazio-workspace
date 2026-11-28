package sdui

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// ErrControlUnavailable is returned when the pool is nil (health-only runs).
var ErrControlUnavailable = errors.New("sdui: database not configured")

// ErrVersionNotFound is returned when a rollback target does not belong to the scope.
var ErrVersionNotFound = errors.New("sdui: version not found")

// LiveLayout is the resolved layout for one screen + district request.
type LiveLayout struct {
	VersionID   string          `json:"versionId"`
	VersionNum  int             `json:"versionNum"`
	Epoch       int64           `json:"epoch"`
	DistrictID  string          `json:"districtId"`  // "" = PAN_INDIA fallback
	DistrictSet bool            `json:"districtSet"` // true when a district override answered
	Payload     json.RawMessage `json:"payload"`
	PublishedAt time.Time       `json:"publishedAt"`
}

// VersionRow is one immutable published payload.
type VersionRow struct {
	ID            string          `json:"id"`
	Vertical      string          `json:"vertical"`
	Screen        string          `json:"screen"`
	DistrictID    string          `json:"districtId"`
	VersionNum    int             `json:"versionNum"`
	SchemaVersion string          `json:"schemaVersion"`
	Note          string          `json:"note,omitempty"`
	PublishedBy   string          `json:"publishedBy,omitempty"`
	PublishedAt   time.Time       `json:"publishedAt"`
	IsLive        bool            `json:"isLive"`
	Payload       json.RawMessage `json:"payload,omitempty"`
}

// PointerRow is the live pointer for one (vertical, screen, district).
type PointerRow struct {
	Vertical      string    `json:"vertical"`
	Screen        string    `json:"screen"`
	DistrictID    string    `json:"districtId"`
	VersionID     string    `json:"versionId"`
	VersionNum    int       `json:"versionNum"`
	SchemaVersion string    `json:"schemaVersion"`
	Epoch         int64     `json:"epoch"`
	PublishedBy   string    `json:"publishedBy,omitempty"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// District is one targetable district row from admins.district_master.
type District struct {
	Code  string `json:"code"`
	Name  string `json:"name"`
	State string `json:"state"`
}

// PublishInput is one publish request (already decoded + validated by the handler).
type PublishInput struct {
	Vertical   string
	Screen     string
	DistrictID string
	Payload    *Payload
	Note       string
	Actor      string
}

// Store reads/writes the versioned SDUI tables. Only the gateway (service role) writes.
type Store struct {
	pool *db.Pool
}

// NewStore returns an SDUI control-plane store.
func NewStore(pool *db.Pool) *Store { return &Store{pool: pool} }

func (s *Store) ready() error {
	if s == nil || s.pool == nil {
		return ErrControlUnavailable
	}
	return nil
}

// districtArg maps "" to SQL NULL so the PAN_INDIA fallback compares correctly.
func districtArg(d string) any {
	if d == "" {
		return nil
	}
	return d
}

// Resolve finds the layout for a district, falling back to the PAN_INDIA row. The district
// override wins whenever one exists.
func (s *Store) Resolve(ctx context.Context, vertical, screen, district string) (LiveLayout, error) {
	if err := s.ready(); err != nil {
		return LiveLayout{}, err
	}
	const q = `
		select p.version_id::text, p.epoch, v.version_num, coalesce(p.district_id, ''), v.payload, v.published_at
		  from admins.sdui_layout_pointers p
		  join admins.sdui_layout_versions v on v.id = p.version_id
		 where p.vertical = $1 and p.screen = $2
		   and (p.district_id is null or p.district_id = $3)
		 order by (p.district_id is not null) desc
		 limit 1`
	var out LiveLayout
	err := s.pool.QueryRow(ctx, q, vertical, screen, districtArg(district)).Scan(
		&out.VersionID, &out.Epoch, &out.VersionNum, &out.DistrictID, &out.Payload, &out.PublishedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return LiveLayout{}, ErrVersionNotFound
	}
	if err != nil {
		return LiveLayout{}, fmt.Errorf("sdui: resolve layout: %w", err)
	}
	out.DistrictSet = district != "" && out.DistrictID == district
	return out, nil
}

// Epoch returns the layout epoch cheaply (the mid-session kill-switch probe).
func (s *Store) Epoch(ctx context.Context, vertical, screen, district string) (int64, error) {
	if err := s.ready(); err != nil {
		return 0, err
	}
	const q = `
		select epoch from admins.sdui_layout_pointers
		 where vertical = $1 and screen = $2
		   and (district_id is null or district_id = $3)
		 order by (district_id is not null) desc
		 limit 1`
	var epoch int64
	err := s.pool.QueryRow(ctx, q, vertical, screen, districtArg(district)).Scan(&epoch)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrVersionNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("sdui: epoch: %w", err)
	}
	return epoch, nil
}

// Pointers lists the live pointer for every district scope of a screen (PAN_INDIA included).
func (s *Store) Pointers(ctx context.Context, vertical, screen string) ([]PointerRow, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	const q = `
		select p.vertical, p.screen, coalesce(p.district_id, ''), p.version_id::text, v.version_num,
		       v.schema_version, p.epoch, coalesce(v.published_by, ''), p.updated_at
		  from admins.sdui_layout_pointers p
		  join admins.sdui_layout_versions v on v.id = p.version_id
		 where p.vertical = $1 and p.screen = $2
		 order by (p.district_id is null) desc, p.district_id asc`
	rows, err := s.pool.Query(ctx, q, vertical, screen)
	if err != nil {
		return nil, fmt.Errorf("sdui: pointers: %w", err)
	}
	defer rows.Close()
	out := []PointerRow{}
	for rows.Next() {
		var p PointerRow
		if err := rows.Scan(&p.Vertical, &p.Screen, &p.DistrictID, &p.VersionID, &p.VersionNum,
			&p.SchemaVersion, &p.Epoch, &p.PublishedBy, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Versions lists the published history of one scope, newest first, with the live flag.
func (s *Store) Versions(ctx context.Context, vertical, screen, district string, limit int) ([]VersionRow, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	const q = `
		select v.id::text, v.vertical, v.screen, coalesce(v.district_id, ''), v.version_num,
		       v.schema_version, coalesce(v.note, ''), coalesce(v.published_by, ''), v.published_at,
		       (p.version_id = v.id) as is_live, v.payload
		  from admins.sdui_layout_versions v
		  left join admins.sdui_layout_pointers p
		         on p.vertical = v.vertical and p.screen = v.screen
		        and p.district_id is not distinct from v.district_id
		 where v.vertical = $1 and v.screen = $2 and v.district_id is not distinct from $3
		 order by v.version_num desc
		 limit $4`
	rows, err := s.pool.Query(ctx, q, vertical, screen, districtArg(district), limit)
	if err != nil {
		return nil, fmt.Errorf("sdui: versions: %w", err)
	}
	defer rows.Close()
	out := []VersionRow{}
	for rows.Next() {
		var v VersionRow
		if err := rows.Scan(&v.ID, &v.Vertical, &v.Screen, &v.DistrictID, &v.VersionNum,
			&v.SchemaVersion, &v.Note, &v.PublishedBy, &v.PublishedAt, &v.IsLive, &v.Payload); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// Publish appends a new immutable version and points the scope at it, bumping the epoch.
func (s *Store) Publish(ctx context.Context, in PublishInput) (VersionRow, error) {
	if err := s.ready(); err != nil {
		return VersionRow{}, err
	}
	body, err := json.Marshal(in.Payload)
	if err != nil {
		return VersionRow{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return VersionRow{}, fmt.Errorf("sdui: publish begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Serialise publishes per scope so two admins cannot mint the same version_num.
	const scopeLock = `select pg_advisory_xact_lock(hashtext($1))`
	if _, err := tx.Exec(ctx, scopeLock, in.Vertical+"/"+in.Screen+"/"+in.DistrictID); err != nil {
		return VersionRow{}, fmt.Errorf("sdui: publish lock: %w", err)
	}
	var next int
	if err := tx.QueryRow(ctx, `
		select coalesce(max(version_num), 0) + 1 from admins.sdui_layout_versions
		 where vertical = $1 and screen = $2 and district_id is not distinct from $3`,
		in.Vertical, in.Screen, districtArg(in.DistrictID)).Scan(&next); err != nil {
		return VersionRow{}, fmt.Errorf("sdui: next version: %w", err)
	}
	var out VersionRow
	if err := tx.QueryRow(ctx, `
		insert into admins.sdui_layout_versions
		  (vertical, screen, district_id, version_num, schema_version, payload, note, published_by)
		values ($1, $2, $3, $4, $5, $6, nullif($7, ''), nullif($8, ''))
		returning id::text, version_num, schema_version, coalesce(note, ''), coalesce(published_by, ''), published_at`,
		in.Vertical, in.Screen, districtArg(in.DistrictID), next, in.Payload.SchemaVersion, body, in.Note, in.Actor,
	).Scan(&out.ID, &out.VersionNum, &out.SchemaVersion, &out.Note, &out.PublishedBy, &out.PublishedAt); err != nil {
		return VersionRow{}, fmt.Errorf("sdui: insert version: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into admins.sdui_layout_pointers (vertical, screen, district_id, version_id, epoch, updated_by, updated_at)
		values ($1, $2, $3, $4, 1, nullif($5, ''), now())
		on conflict (vertical, screen, coalesce(district_id, 'PAN_INDIA'))
		do update set version_id = excluded.version_id,
		              epoch = admins.sdui_layout_pointers.epoch + 1,
		              updated_by = excluded.updated_by,
		              updated_at = now()`,
		in.Vertical, in.Screen, districtArg(in.DistrictID), out.ID, in.Actor); err != nil {
		return VersionRow{}, fmt.Errorf("sdui: upsert pointer: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return VersionRow{}, fmt.Errorf("sdui: publish commit: %w", err)
	}
	out.Vertical, out.Screen, out.DistrictID = in.Vertical, in.Screen, in.DistrictID
	out.IsLive = true
	out.Payload = body
	return out, nil
}

// Rollback points a scope back at an earlier version, bumping the epoch (history is kept intact).
func (s *Store) Rollback(ctx context.Context, vertical, screen, district, versionID, actor string) (PointerRow, error) {
	if err := s.ready(); err != nil {
		return PointerRow{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PointerRow{}, fmt.Errorf("sdui: rollback begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var exists bool
	if err := tx.QueryRow(ctx, `
		select exists(
			select 1 from admins.sdui_layout_versions
			 where id = $1 and vertical = $2 and screen = $3
			   and district_id is not distinct from $4)`,
		versionID, vertical, screen, districtArg(district)).Scan(&exists); err != nil {
		return PointerRow{}, fmt.Errorf("sdui: rollback lookup: %w", err)
	}
	if !exists {
		return PointerRow{}, ErrVersionNotFound
	}
	var out PointerRow
	if err := tx.QueryRow(ctx, `
		insert into admins.sdui_layout_pointers (vertical, screen, district_id, version_id, epoch, updated_by, updated_at)
		values ($1, $2, $3, $4, 1, nullif($5, ''), now())
		on conflict (vertical, screen, coalesce(district_id, 'PAN_INDIA'))
		do update set version_id = excluded.version_id,
		              epoch = admins.sdui_layout_pointers.epoch + 1,
		              updated_by = excluded.updated_by,
		              updated_at = now()
		returning epoch`,
		vertical, screen, districtArg(district), versionID, actor).Scan(&out.Epoch); err != nil {
		return PointerRow{}, fmt.Errorf("sdui: rollback pointer: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return PointerRow{}, fmt.Errorf("sdui: rollback commit: %w", err)
	}
	out.Vertical, out.Screen, out.DistrictID, out.VersionID = vertical, screen, district, versionID
	out.UpdatedAt = time.Now().UTC()
	return out, nil
}

// Districts lists active district_master rows for targeting pickers.
func (s *Store) Districts(ctx context.Context) ([]District, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
		select district_code, district_name, state_code
		  from admins.district_master where is_active order by state_code, district_name`)
	if err != nil {
		return nil, fmt.Errorf("sdui: districts: %w", err)
	}
	defer rows.Close()
	out := []District{}
	for rows.Next() {
		var d District
		if err := rows.Scan(&d.Code, &d.Name, &d.State); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
