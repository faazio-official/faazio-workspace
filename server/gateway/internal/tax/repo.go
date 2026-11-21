package tax

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// GSTRateCategory is one tax.gst_rate_categories row: a named GST slab the superadmin picks from.
type GSTRateCategory struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Sector     string `json:"sector"`
	GSTRatePct int    `json:"gstRatePct"`
	IsActive   bool   `json:"isActive"`
	CreatedAt  string `json:"createdAt,omitempty"`
	UpdatedAt  string `json:"updatedAt,omitempty"`
	UpdatedBy  string `json:"updatedBy,omitempty"`
	// IsActiveInput carries the optional PATCH-style "leave unchanged" flag from the portal.
	IsActiveInput *bool `json:"-"`
}

// CategoryGSTRate is one tax.category_gst_rates row: the mandatory GST of a taxonomy category.
type CategoryGSTRate struct {
	CategoryID         string `json:"categoryId"`
	GSTRatePct         int    `json:"gstRatePct"`
	GSTRateCategoryID  string `json:"gstRateCategoryId"`
	GSTRateCategory    string `json:"gstRateCategoryName,omitempty"`
	IsActive           bool   `json:"isActive"`
	UpdatedAt          string `json:"updatedAt,omitempty"`
	UpdatedBy          string `json:"updatedBy,omitempty"`
}

// Settings is the singleton platform rate card (tax.platform_settings).
type Settings struct {
	PlatformGSTPct   int     `json:"platformGstPct"`
	TCSPct           float64 `json:"tcsPct"`
	TDSPct           float64 `json:"tdsPct"`
	DeliveryFeePaisa int64   `json:"deliveryFeePaisa"`
}

// ErrNotFound is returned when a GST rate category id does not exist.
var ErrNotFound = errors.New("tax: not found")

// ErrInUse is returned when a GST rate category is still linked to a taxonomy category.
var ErrInUse = errors.New("tax: gst rate category in use")

// ErrUnknownRate is returned when the picked slab does not exist or belongs to another sector.
var ErrUnknownRate = errors.New("tax: unknown gst rate category")

// ValidGSTRatePct reports whether pct is one of the GST slabs in force.
func ValidGSTRatePct(pct int) bool {
	switch pct {
	case 0, 5, 12, 18, 28, 40:
		return true
	}
	return false
}

// ValidGSTSector reports whether s is a pool a GST slab can belong to. MAIN_APP_HEADER categories
// carry a GST too, so the header pool is a valid sector for a slab.
func ValidGSTSector(s string) bool {
	switch s {
	case "MART", "FOOD", "PHARMA", "MAIN_APP_HEADER":
		return true
	}
	return false
}

// Repo reads/writes the tax master data. The gateway (service_role) is the only writer.
type Repo struct {
	pool *db.Pool
}

// NewRepo returns a tax repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const gstRateCategorySelect = `select id, name, sector::text, gst_rate_pct, is_active,
	created_at::text, updated_at::text, coalesce(updated_by, '')`

func scanGSTRateCategory(row pgx.Row) (GSTRateCategory, error) {
	var g GSTRateCategory
	err := row.Scan(&g.ID, &g.Name, &g.Sector, &g.GSTRatePct, &g.IsActive,
		&g.CreatedAt, &g.UpdatedAt, &g.UpdatedBy)
	return g, err
}

// GSTRateCategories lists the pick-list. When activeOnly is set, deactivated slabs are omitted.
func (r *Repo) GSTRateCategories(ctx context.Context, activeOnly bool) ([]GSTRateCategory, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("tax: database not configured")
	}
	rows, err := r.pool.Query(ctx, gstRateCategorySelect+`
		  from tax.gst_rate_categories
		 where (not $1 or is_active)
		 order by sector, gst_rate_pct, lower(name)`, activeOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []GSTRateCategory{}
	for rows.Next() {
		g, err := scanGSTRateCategory(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

// GetGSTRateCategory returns one pick-list row.
func (r *Repo) GetGSTRateCategory(ctx context.Context, id string) (GSTRateCategory, error) {
	if r.pool == nil {
		return GSTRateCategory{}, fmt.Errorf("tax: database not configured")
	}
	g, err := scanGSTRateCategory(r.pool.QueryRow(ctx, gstRateCategorySelect+`
		  from tax.gst_rate_categories where id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return GSTRateCategory{}, ErrNotFound
		}
		return GSTRateCategory{}, err
	}
	return g, nil
}

// UpsertGSTRateCategory creates or updates one named slab. An empty id mints `gst-<shortid>`.
func (r *Repo) UpsertGSTRateCategory(ctx context.Context, g GSTRateCategory, actorID string) (GSTRateCategory, error) {
	if r.pool == nil {
		return GSTRateCategory{}, fmt.Errorf("tax: database not configured")
	}
	id := strings.TrimSpace(g.ID)
	if id == "" {
		id = "gst-" + shortID()
	}
	out, err := scanGSTRateCategory(r.pool.QueryRow(ctx, `
		insert into tax.gst_rate_categories (id, name, sector, gst_rate_pct, is_active, updated_by)
		values ($1, $2, $3::app_brand, $4, coalesce($5, true), $6)
		on conflict (id) do update
		  set name = excluded.name,
		      sector = excluded.sector,
		      gst_rate_pct = excluded.gst_rate_pct,
		      is_active = coalesce($5, tax.gst_rate_categories.is_active),
		      updated_by = excluded.updated_by,
		      updated_at = now()
		returning id, name, sector::text, gst_rate_pct, is_active,
		          created_at::text, updated_at::text, coalesce(updated_by, '')`,
		id, strings.TrimSpace(g.Name), strings.ToUpper(strings.TrimSpace(g.Sector)), g.GSTRatePct,
		g.IsActiveInput, actorID))
	if err != nil {
		return GSTRateCategory{}, err
	}
	return out, nil
}

// DeleteGSTRateCategory soft-deletes a slab so existing category links never dangle. It refuses while
// a live category still points at the slab, because checkout would then resolve a rate the portal no
// longer offers.
func (r *Repo) DeleteGSTRateCategory(ctx context.Context, id, actorID string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("tax: database not configured")
	}
	var inUse int
	if err := r.pool.QueryRow(ctx, `
		select count(*) from tax.category_gst_rates where gst_rate_category_id = $1`, id).
		Scan(&inUse); err != nil {
		return false, err
	}
	if inUse > 0 {
		return false, ErrInUse
	}
	tag, err := r.pool.Exec(ctx, `
		update tax.gst_rate_categories
		   set is_active = false, updated_by = $2, updated_at = now()
		 where id = $1 and is_active`, id, actorID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// CategoryGSTRates returns the category → GST links, optionally scoped to one taxonomy category.
func (r *Repo) CategoryGSTRates(ctx context.Context, categoryID string) ([]CategoryGSTRate, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("tax: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select r.category_id, r.gst_rate_pct, r.gst_rate_category_id, coalesce(g.name, ''),
		       r.is_active, r.updated_at::text, coalesce(r.updated_by, '')
		  from tax.category_gst_rates r
		  left join tax.gst_rate_categories g on g.id = r.gst_rate_category_id
		 where ($1 = '' or r.category_id = $1)
		 order by r.category_id`, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CategoryGSTRate{}
	for rows.Next() {
		var c CategoryGSTRate
		if err := rows.Scan(&c.CategoryID, &c.GSTRatePct, &c.GSTRateCategoryID,
			&c.GSTRateCategory, &c.IsActive, &c.UpdatedAt, &c.UpdatedBy); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetCategoryGSTRate returns one category's GST link.
func (r *Repo) GetCategoryGSTRate(ctx context.Context, categoryID string) (CategoryGSTRate, error) {
	if r.pool == nil {
		return CategoryGSTRate{}, fmt.Errorf("tax: database not configured")
	}
	var c CategoryGSTRate
	err := r.pool.QueryRow(ctx, `
		select r.category_id, r.gst_rate_pct, r.gst_rate_category_id, coalesce(g.name, ''),
		       r.is_active, r.updated_at::text, coalesce(r.updated_by, '')
		  from tax.category_gst_rates r
		  left join tax.gst_rate_categories g on g.id = r.gst_rate_category_id
		 where r.category_id = $1`, categoryID).
		Scan(&c.CategoryID, &c.GSTRatePct, &c.GSTRateCategoryID, &c.GSTRateCategory,
			&c.IsActive, &c.UpdatedAt, &c.UpdatedBy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CategoryGSTRate{}, ErrNotFound
		}
		return CategoryGSTRate{}, err
	}
	return c, nil
}

// UpsertCategoryGSTRate links a taxonomy category to a picked slab. The slab's own percentage is
// copied onto the row (never the caller's number) so checkout and the portal cannot disagree.
func (r *Repo) UpsertCategoryGSTRate(ctx context.Context, categoryID, rateCategoryID, actorID string) (CategoryGSTRate, error) {
	if r.pool == nil {
		return CategoryGSTRate{}, fmt.Errorf("tax: database not configured")
	}
	var c CategoryGSTRate
	err := r.pool.QueryRow(ctx, `
		with slab as (
		  select id, gst_rate_pct from tax.gst_rate_categories where id = $2 and is_active
		)
		insert into tax.category_gst_rates (category_id, gst_rate_pct, gst_rate_category_id, updated_by)
		select $1, slab.gst_rate_pct, slab.id, $3 from slab
		on conflict (category_id) do update
		  set gst_rate_pct = excluded.gst_rate_pct,
		      gst_rate_category_id = excluded.gst_rate_category_id,
		      is_active = true,
		      updated_by = excluded.updated_by,
		      updated_at = now()
		returning category_id, gst_rate_pct, gst_rate_category_id,
		          (select name from tax.gst_rate_categories where id = gst_rate_category_id),
		          is_active, updated_at::text, coalesce(updated_by, '')`,
		categoryID, rateCategoryID, actorID).
		Scan(&c.CategoryID, &c.GSTRatePct, &c.GSTRateCategoryID, &c.GSTRateCategory,
			&c.IsActive, &c.UpdatedAt, &c.UpdatedBy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CategoryGSTRate{}, ErrUnknownRate
		}
		return CategoryGSTRate{}, err
	}
	return c, nil
}

// CategoryRate is one taxonomy category's GST, as the seller category picker reads it.
type CategoryRate struct {
	CategoryID string `json:"taxRateId"`
	Sector     string `json:"sector"`
	Category   string `json:"category"`
	GSTRatePct int    `json:"gstRatePct"`
	IsActive   bool   `json:"isActive"`
}

// CategoryRates lists the GST of every taxonomy category (the seller picker's source). The
// `taxRateId` field carries the taxonomy category id, so a listing can store it as
// `taxonomy_category_id` and checkout resolves the same rate by primary key.
func (r *Repo) CategoryRates(ctx context.Context, activeOnly bool) ([]CategoryRate, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("tax: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select c.id, c.app::text, c.name, g.gst_rate_pct, (c.is_active and g.is_active)
		  from taxonomy.categories c
		  join tax.category_gst_rates g on g.category_id = c.id
		 where (not $1 or (c.is_active and g.is_active))
		 order by c.app, lower(c.name)`, activeOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CategoryRate{}
	for rows.Next() {
		var c CategoryRate
		if err := rows.Scan(&c.CategoryID, &c.Sector, &c.Category, &c.GSTRatePct, &c.IsActive); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// Settings reads the singleton rate card (returns defaults when the row is absent).
func (r *Repo) Settings(ctx context.Context) (Settings, error) {
	if r.pool == nil {
		return Settings{PlatformGSTPct: 18, TCSPct: 1, TDSPct: 0.1, DeliveryFeePaisa: 5000}, nil
	}
	var s Settings
	err := r.pool.QueryRow(ctx, `
		select platform_gst_pct, tcs_pct::float8, tds_pct::float8, delivery_fee_paisa
		  from tax.platform_settings where id = 1`).
		Scan(&s.PlatformGSTPct, &s.TCSPct, &s.TDSPct, &s.DeliveryFeePaisa)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Settings{PlatformGSTPct: 18, TCSPct: 1, TDSPct: 0.1, DeliveryFeePaisa: 5000}, nil
		}
		return Settings{}, err
	}
	return s, nil
}

// UpdateSettings writes the singleton rate card.
func (r *Repo) UpdateSettings(ctx context.Context, s Settings, actorID string) (Settings, error) {
	if r.pool == nil {
		return Settings{}, fmt.Errorf("tax: database not configured")
	}
	err := r.pool.QueryRow(ctx, `
		insert into tax.platform_settings
		  (id, platform_gst_pct, tcs_pct, tds_pct, delivery_fee_paisa, updated_by)
		values (1, $1, $2, $3, $4, $5)
		on conflict (id) do update
		  set platform_gst_pct = excluded.platform_gst_pct,
		      tcs_pct = excluded.tcs_pct,
		      tds_pct = excluded.tds_pct,
		      delivery_fee_paisa = excluded.delivery_fee_paisa,
		      updated_by = excluded.updated_by,
		      updated_at = now()
		returning platform_gst_pct, tcs_pct::float8, tds_pct::float8, delivery_fee_paisa`,
		s.PlatformGSTPct, s.TCSPct, s.TDSPct, s.DeliveryFeePaisa, actorID).
		Scan(&s.PlatformGSTPct, &s.TCSPct, &s.TDSPct, &s.DeliveryFeePaisa)
	if err != nil {
		return Settings{}, err
	}
	return s, nil
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
