// Package promo owns festival campaigns, seller opt-ins, sector discount caps and partner coupons
// (promo schema, migration 0015). Future service: Go + Postgres (monolith-breakdown.md §1). Money is
// INT8 paisa in the DB, exposed as whole integer rupees; campaigns/coupons are non-PII and cached,
// opt-ins/sector caps are role-scoped. Every mutation is audited by the handler.
package promo

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// SectorCap is one promo.sector_caps row (state_code empty = global cap).
type SectorCap struct {
	CapID              string `json:"capId"`
	Sector             string `json:"sector"`
	StateCode          string `json:"stateCode,omitempty"`
	MaxDiscountPercent int    `json:"maxDiscountPercent"`
	UpdatedAt          string `json:"updatedAt"`
}

// Campaign is one promo.festival_campaigns row.
type Campaign struct {
	CampaignID string `json:"campaignId"`
	Name       string `json:"name"`
	Scope      string `json:"scope"`
	StateCode  string `json:"stateCode,omitempty"`
	StartsAt   string `json:"startsAt"`
	EndsAt     string `json:"endsAt"`
	BannerURL  string `json:"bannerUrl"`
	Status     string `json:"status"`
	CreatedBy  string `json:"createdBy"`
}

// Optin is one promo.festival_optins row.
type Optin struct {
	OptinID         string `json:"optinId"`
	CampaignID      string `json:"campaignId"`
	SellerID        string `json:"sellerId"`
	ProductID       string `json:"productId"`
	DiscountPercent int    `json:"discountPercent"`
	Status          string `json:"status"`
}

// Coupon is one promo.coupons row (maxDiscount is whole rupees).
type Coupon struct {
	CouponID     string `json:"couponId"`
	Code         string `json:"code"`
	Scope        string `json:"scope"`
	StateCode    string `json:"stateCode,omitempty"`
	Sector       string `json:"sector,omitempty"`
	ValuePercent int    `json:"valuePercent"`
	MaxDiscount  int64  `json:"maxDiscount"`
	ValidTill    string `json:"validTill"`
	Active       bool   `json:"active"`
}

// Repo reads/writes the promo schema.
type Repo struct {
	pool *db.Pool
}

// New returns a promo repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// SectorCaps returns all caps (global + state overrides).
func (r *Repo) SectorCaps(ctx context.Context) ([]SectorCap, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("promo: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select cap_id, sector::text, coalesce(state_code,''), max_discount, updated_at
		  from promo.sector_caps order by sector, state_code nulls first`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SectorCap{}
	for rows.Next() {
		var (
			c         SectorCap
			updatedAt time.Time
		)
		if err := rows.Scan(&c.CapID, &c.Sector, &c.StateCode, &c.MaxDiscountPercent, &updatedAt); err != nil {
			return nil, err
		}
		c.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, c)
	}
	return out, rows.Err()
}

// SetSectorCap upserts a cap for (sector, stateCode).
func (r *Repo) SetSectorCap(ctx context.Context, c SectorCap) (SectorCap, error) {
	if r.pool == nil {
		return SectorCap{}, fmt.Errorf("promo: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return SectorCap{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `
		delete from promo.sector_caps
		 where sector = $1::app_brand and coalesce(state_code,'') = $2`,
		c.Sector, c.StateCode); err != nil {
		return SectorCap{}, err
	}
	c.CapID = "cap-" + shortID()
	var updatedAt time.Time
	err = tx.QueryRow(ctx, `
		insert into promo.sector_caps (cap_id, sector, state_code, max_discount)
		values ($1,$2::app_brand,$3,$4)
		returning updated_at`, c.CapID, c.Sector, nullIfEmpty(c.StateCode), c.MaxDiscountPercent).
		Scan(&updatedAt)
	if err != nil {
		return SectorCap{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return SectorCap{}, err
	}
	c.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return c, nil
}

// Campaigns lists campaigns, optionally scoped by state and/or scope.
func (r *Repo) Campaigns(ctx context.Context, stateCode, scope string) ([]Campaign, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("promo: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select campaign_id, name, scope::text, coalesce(state_code,''), starts_at, ends_at,
		       banner_url, status::text, created_by
		  from promo.festival_campaigns
		 where ($1 = '' or scope::text = $1)
		   and ($2 = '' or state_code = $2 or scope = 'GLOBAL')
		 order by starts_at desc`, scope, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCampaigns(rows)
}

// Campaign returns one campaign.
func (r *Repo) Campaign(ctx context.Context, id string) (Campaign, bool, error) {
	if r.pool == nil {
		return Campaign{}, false, fmt.Errorf("promo: database not configured")
	}
	c, err := scanCampaign(r.pool.QueryRow(ctx, `
		select campaign_id, name, scope::text, coalesce(state_code,''), starts_at, ends_at,
		       banner_url, status::text, created_by
		  from promo.festival_campaigns where campaign_id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Campaign{}, false, nil
		}
		return Campaign{}, false, err
	}
	return c, true, nil
}

// CreateCampaign inserts a campaign.
func (r *Repo) CreateCampaign(ctx context.Context, c Campaign) (Campaign, error) {
	if r.pool == nil {
		return Campaign{}, fmt.Errorf("promo: database not configured")
	}
	c.CampaignID = "cmp-" + shortID()
	var startsAt, endsAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into promo.festival_campaigns
		  (campaign_id, name, scope, state_code, starts_at, ends_at, banner_url, status, created_by)
		values ($1,$2,$3::campaign_scope,$4,$5::timestamptz,$6::timestamptz,$7,$8::campaign_status,$9)
		returning campaign_id, name, scope::text, coalesce(state_code,''), starts_at, ends_at,
		          banner_url, status::text, created_by`,
		c.CampaignID, c.Name, c.Scope, nullIfEmpty(c.StateCode), c.StartsAt, c.EndsAt,
		c.BannerURL, c.Status, c.CreatedBy).
		Scan(&c.CampaignID, &c.Name, &c.Scope, &c.StateCode, &startsAt, &endsAt,
			&c.BannerURL, &c.Status, &c.CreatedBy)
	if err != nil {
		return Campaign{}, err
	}
	c.StartsAt = startsAt.UTC().Format(time.RFC3339)
	c.EndsAt = endsAt.UTC().Format(time.RFC3339)
	return c, nil
}

// SetCampaignStatus updates a campaign's status.
func (r *Repo) SetCampaignStatus(ctx context.Context, id, status string) (Campaign, bool, error) {
	if r.pool == nil {
		return Campaign{}, false, fmt.Errorf("promo: database not configured")
	}
	c, err := scanCampaign(r.pool.QueryRow(ctx, `
		update promo.festival_campaigns set status = $2::campaign_status
		 where campaign_id = $1
		 returning campaign_id, name, scope::text, coalesce(state_code,''), starts_at, ends_at,
		           banner_url, status::text, created_by`, id, status))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Campaign{}, false, nil
		}
		return Campaign{}, false, err
	}
	return c, true, nil
}

// Optins lists opt-ins scoped by seller and/or campaign.
func (r *Repo) Optins(ctx context.Context, sellerID, campaignID string) ([]Optin, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("promo: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select optin_id, campaign_id, seller_id, product_id, discount, status::text
		  from promo.festival_optins
		 where ($1 = '' or seller_id = $1) and ($2 = '' or campaign_id = $2)
		 order by created_at desc`, sellerID, campaignID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Optin{}
	for rows.Next() {
		var o Optin
		if err := rows.Scan(&o.OptinID, &o.CampaignID, &o.SellerID, &o.ProductID, &o.DiscountPercent, &o.Status); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// UpsertOptin creates/replaces a seller's opt-in for a product (resets to PENDING).
func (r *Repo) UpsertOptin(ctx context.Context, o Optin) (Optin, error) {
	if r.pool == nil {
		return Optin{}, fmt.Errorf("promo: database not configured")
	}
	o.OptinID = "opt-" + shortID()
	err := r.pool.QueryRow(ctx, `
		insert into promo.festival_optins (optin_id, campaign_id, seller_id, product_id, discount)
		values ($1,$2,$3,$4,$5)
		on conflict (campaign_id, product_id) do update
		  set discount = excluded.discount, status = 'PENDING'
		returning optin_id, campaign_id, seller_id, product_id, discount, status::text`,
		o.OptinID, o.CampaignID, o.SellerID, o.ProductID, o.DiscountPercent).
		Scan(&o.OptinID, &o.CampaignID, &o.SellerID, &o.ProductID, &o.DiscountPercent, &o.Status)
	if err != nil {
		return Optin{}, err
	}
	return o, nil
}

// SetOptinStatus approves/rejects an opt-in.
func (r *Repo) SetOptinStatus(ctx context.Context, id, status string) (Optin, bool, error) {
	if r.pool == nil {
		return Optin{}, false, fmt.Errorf("promo: database not configured")
	}
	var o Optin
	err := r.pool.QueryRow(ctx, `
		update promo.festival_optins set status = $2::optin_status
		 where optin_id = $1
		 returning optin_id, campaign_id, seller_id, product_id, discount, status::text`, id, status).
		Scan(&o.OptinID, &o.CampaignID, &o.SellerID, &o.ProductID, &o.DiscountPercent, &o.Status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Optin{}, false, nil
		}
		return Optin{}, false, err
	}
	return o, true, nil
}

// Coupons lists coupons scoped by state/scope.
func (r *Repo) Coupons(ctx context.Context, stateCode, scope string) ([]Coupon, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("promo: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select coupon_id, code, scope::text, coalesce(state_code,''), coalesce(sector::text,''),
		       value_percent, max_discount_paisa, valid_till, active
		  from promo.coupons
		 where ($1 = '' or scope::text = $1)
		   and ($2 = '' or state_code = $2 or scope = 'GLOBAL')
		 order by created_at desc`, scope, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Coupon{}
	for rows.Next() {
		var (
			c         Coupon
			validTill time.Time
		)
		if err := rows.Scan(&c.CouponID, &c.Code, &c.Scope, &c.StateCode, &c.Sector,
			&c.ValuePercent, &c.MaxDiscount, &validTill, &c.Active); err != nil {
			return nil, err
		}
		c.MaxDiscount = c.MaxDiscount / 100 // paisa -> rupees
		c.ValidTill = validTill.UTC().Format(time.RFC3339)
		out = append(out, c)
	}
	return out, rows.Err()
}

// CreateCoupon inserts a coupon (maxDiscount is rupees on the wire, paisa in the DB).
func (r *Repo) CreateCoupon(ctx context.Context, c Coupon) (Coupon, error) {
	if r.pool == nil {
		return Coupon{}, fmt.Errorf("promo: database not configured")
	}
	c.CouponID = "cpn-" + shortID()
	var validTill time.Time
	err := r.pool.QueryRow(ctx, `
		insert into promo.coupons
		  (coupon_id, code, scope, state_code, sector, value_percent, max_discount_paisa, valid_till, active)
		values ($1,$2,$3::campaign_scope,$4,$5::app_brand,$6,$7,$8::timestamptz,$9)
		returning coupon_id, code, scope::text, coalesce(state_code,''), coalesce(sector::text,''),
		          value_percent, max_discount_paisa, valid_till, active`,
		c.CouponID, c.Code, c.Scope, nullIfEmpty(c.StateCode), nullIfEmpty(c.Sector),
		c.ValuePercent, c.MaxDiscount*100, c.ValidTill, c.Active).
		Scan(&c.CouponID, &c.Code, &c.Scope, &c.StateCode, &c.Sector, &c.ValuePercent,
			&c.MaxDiscount, &validTill, &c.Active)
	if err != nil {
		return Coupon{}, err
	}
	c.MaxDiscount = c.MaxDiscount / 100
	c.ValidTill = validTill.UTC().Format(time.RFC3339)
	return c, nil
}

// ToggleCoupon flips a coupon's active flag.
func (r *Repo) ToggleCoupon(ctx context.Context, id string) (Coupon, bool, error) {
	if r.pool == nil {
		return Coupon{}, false, fmt.Errorf("promo: database not configured")
	}
	var (
		c         Coupon
		validTill time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update promo.coupons set active = not active
		 where coupon_id = $1
		 returning coupon_id, code, scope::text, coalesce(state_code,''), coalesce(sector::text,''),
		           value_percent, max_discount_paisa, valid_till, active`, id).
		Scan(&c.CouponID, &c.Code, &c.Scope, &c.StateCode, &c.Sector, &c.ValuePercent,
			&c.MaxDiscount, &validTill, &c.Active)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Coupon{}, false, nil
		}
		return Coupon{}, false, err
	}
	c.MaxDiscount = c.MaxDiscount / 100
	c.ValidTill = validTill.UTC().Format(time.RFC3339)
	return c, true, nil
}

type campaignScanner interface{ Scan(dest ...any) error }

func scanCampaign(row campaignScanner) (Campaign, error) {
	var (
		c        Campaign
		startsAt time.Time
		endsAt   time.Time
	)
	if err := row.Scan(&c.CampaignID, &c.Name, &c.Scope, &c.StateCode, &startsAt, &endsAt,
		&c.BannerURL, &c.Status, &c.CreatedBy); err != nil {
		return Campaign{}, err
	}
	c.StartsAt = startsAt.UTC().Format(time.RFC3339)
	c.EndsAt = endsAt.UTC().Format(time.RFC3339)
	return c, nil
}

func scanCampaigns(rows pgx.Rows) ([]Campaign, error) {
	out := []Campaign{}
	for rows.Next() {
		c, err := scanCampaign(rows)
		if err != nil {
			return nil, err
		}
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
