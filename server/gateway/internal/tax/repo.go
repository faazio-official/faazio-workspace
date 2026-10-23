package tax

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// CategoryRate is one tax.tax_rates row (a SUPER_ADMIN-managed sector + category + GST rate).
type CategoryRate struct {
	TaxRateID  string `json:"taxRateId"`
	Sector     string `json:"sector"`
	Category   string `json:"category"`
	GSTRatePct int    `json:"gstRatePct"`
	IsActive   bool   `json:"isActive"`
}

// Settings is the singleton platform rate card (tax.platform_settings).
type Settings struct {
	PlatformGSTPct   int     `json:"platformGstPct"`
	TCSPct           float64 `json:"tcsPct"`
	TDSPct           float64 `json:"tdsPct"`
	DeliveryFeePaisa int64   `json:"deliveryFeePaisa"`
}

// Repo reads/writes the tax master data. The gateway (service_role) is the only writer.
type Repo struct {
	pool *db.Pool
}

// NewRepo returns a tax repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// Categories lists category rates. When activeOnly is set, disabled rows are omitted (seller view).
func (r *Repo) Categories(ctx context.Context, activeOnly bool) ([]CategoryRate, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("tax: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select tax_rate_id, sector::text, category, gst_rate_pct, is_active
		  from tax.tax_rates
		 where (not $1 or is_active)
		 order by sector, lower(category)`, activeOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CategoryRate{}
	for rows.Next() {
		var c CategoryRate
		if err := rows.Scan(&c.TaxRateID, &c.Sector, &c.Category, &c.GSTRatePct, &c.IsActive); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// UpsertCategory creates or updates one sector/category rate.
func (r *Repo) UpsertCategory(ctx context.Context, sector, category string, ratePct int, actorID string) (CategoryRate, error) {
	if r.pool == nil {
		return CategoryRate{}, fmt.Errorf("tax: database not configured")
	}
	c := CategoryRate{TaxRateID: "tr-" + shortID(), Sector: sector, Category: category, GSTRatePct: ratePct, IsActive: true}
	err := r.pool.QueryRow(ctx, `
		insert into tax.tax_rates (tax_rate_id, sector, category, gst_rate_pct, updated_by)
		values ($1, $2::app_brand, $3, $4, $5)
		on conflict (sector, category) do update
		  set gst_rate_pct = excluded.gst_rate_pct,
		      is_active = true,
		      updated_by = excluded.updated_by,
		      updated_at = now()
		returning tax_rate_id, sector::text, category, gst_rate_pct, is_active`,
		c.TaxRateID, sector, category, ratePct, actorID).
		Scan(&c.TaxRateID, &c.Sector, &c.Category, &c.GSTRatePct, &c.IsActive)
	if err != nil {
		return CategoryRate{}, err
	}
	return c, nil
}

// DeleteCategory removes one rate row. Products in that category fall back to the 5% default.
func (r *Repo) DeleteCategory(ctx context.Context, id string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("tax: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `delete from tax.tax_rates where tax_rate_id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
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
