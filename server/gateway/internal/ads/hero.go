// Hero campaigns (ads.campaigns, migration 0027): a seller-owned poster creative that deep-links to
// their own product/store, requested for one or more hero/contextual placements and moderated per
// placement. The anon projection (`HeroAd`) is display-only and cached; the control-plane row
// (`Campaign`) carries schedule + counters for the seller/admin consoles.
package ads

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// HeroAd is the anon-visible LIVE hero projection for a context (display fields only).
type HeroAd struct {
	PlacementID string `json:"placementId"`
	CampaignID  string `json:"campaignId"`
	SellerID    string `json:"sellerId"`
	Placement   string `json:"placement"`
	TargetType  string `json:"targetType"`
	TargetID    string `json:"targetId"`
	TargetApp   string `json:"targetApp"`
	Category    string `json:"category,omitempty"`
	StoreID     string `json:"storeId,omitempty"`
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle,omitempty"`
	ImageURL    string `json:"imageUrl,omitempty"`
	CTA         string `json:"cta,omitempty"`
}

// Campaign is one ads.campaigns row (control plane: creative + target + schedule + counters).
type Campaign struct {
	PlacementID      string `json:"placementId"`
	CampaignID       string `json:"campaignId"`
	SellerID         string `json:"sellerId"`
	CreativeType     string `json:"creativeType"`
	Placement        string `json:"placement"`
	TargetType       string `json:"targetType"`
	TargetID         string `json:"targetId"`
	TargetApp        string `json:"targetApp"`
	Category         string `json:"category,omitempty"`
	StoreID          string `json:"storeId,omitempty"`
	Title            string `json:"title"`
	Subtitle         string `json:"subtitle,omitempty"`
	ImageURL         string `json:"imageUrl,omitempty"`
	CTA              string `json:"cta,omitempty"`
	StateCode        string `json:"stateCode,omitempty"`
	Status           string `json:"status"`
	Reports          int64  `json:"reports"`
	TakedownReason   string `json:"takedownReason,omitempty"`
	Impressions      int64  `json:"impressions"`
	Clicks           int64  `json:"clicks"`
	OrdersAttributed int64  `json:"ordersAttributed"`
	// SortOrder is the explicit play order within a store's STORE_TOP carousel (lower plays first).
	SortOrder   int    `json:"sortOrder"`
	StartsAt    string `json:"startsAt"`
	EndsAt      string `json:"endsAt"`
	RequestedAt string `json:"requestedAt"`
}

// ResolvedTarget is the server-authoritative owner + app of a hero's deep-link target, read from the
// owning table (catalog.products / directory.menus / directory.stores / directory.dining_venues).
// The gateway never trusts a client-supplied target_app or ownership claim.
type ResolvedTarget struct {
	SellerID string
	App      string
	StoreID  string
}

// maxHeroFill caps how many heroes a placement returns (relevance-first, then most recent).
const maxHeroFill = 8

// campaignCols is the shared control-plane projection (mirrors Campaign's scan order).
const campaignCols = `placement_id, campaign_id, seller_id, creative_type::text, placement::text,
	       target_type::text, target_id, target_app::text, coalesce(category,''), coalesce(store_id,''),
	       title, subtitle, image_url, cta, coalesce(state_code,''), status::text,
	       reports, coalesce(takedown_reason,''), impressions, clicks, orders_attributed,
	       sort_order, starts_at, ends_at, requested_at`

const campaignSelect = `select ` + campaignCols + ` from ads.campaigns`

// Heroes lists LIVE, in-window campaigns matching a context, newest-first, capped. Empty context
// dimensions are "any".
func (r *Repo) Heroes(ctx context.Context, placement, app, category, storeID string) ([]HeroAd, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("ads: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select placement_id, campaign_id, seller_id, placement::text, target_type::text, target_id,
		       target_app::text, coalesce(category,''), coalesce(store_id,''), title, subtitle, image_url, cta
		  from ads.campaigns
		 where status = 'LIVE'
		   and ($1 = '' or placement::text = $1)
		   and ($2 = '' or target_app::text = $2)
		   and ($3 = '' or coalesce(category,'') = $3)
		   and ($4 = '' or coalesce(store_id,'') = $4)
		   and now() between starts_at and ends_at
		 order by sort_order asc, requested_at desc
		 limit $5`, placement, app, category, storeID, maxHeroFill)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []HeroAd{}
	for rows.Next() {
		var a HeroAd
		if err := rows.Scan(&a.PlacementID, &a.CampaignID, &a.SellerID, &a.Placement, &a.TargetType,
			&a.TargetID, &a.TargetApp, &a.Category, &a.StoreID, &a.Title, &a.Subtitle, &a.ImageURL, &a.CTA); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Campaigns lists the control-plane rows scoped by seller and/or state.
func (r *Repo) Campaigns(ctx context.Context, sellerID, stateCode string) ([]Campaign, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("ads: database not configured")
	}
	rows, err := r.pool.Query(ctx, campaignSelect+`
		 where ($1 = '' or seller_id = $1) and ($2 = '' or state_code = $2)
		 order by requested_at desc`, sellerID, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Campaign{}
	for rows.Next() {
		c, err := r.scanCampaign(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CampaignByID returns one control-plane row.
func (r *Repo) CampaignByID(ctx context.Context, id string) (Campaign, bool, error) {
	if r.pool == nil {
		return Campaign{}, false, fmt.Errorf("ads: database not configured")
	}
	c, err := r.scanCampaign(r.pool.QueryRow(ctx, campaignSelect+` where placement_id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Campaign{}, false, nil
		}
		return Campaign{}, false, err
	}
	return c, true, nil
}

// CreateCampaigns inserts one row per placement sharing a campaign_id. Self-serve: the handler has
// already machine-checked ownership, placement fit, creative bounds and (for LIVE) the per-seller
// cap. A verified seller publishes straight to LIVE; the storefront playlist can also save DRAFT rows
// (hidden from `GET /ads/hero`). REQUESTED is never minted.
func (r *Repo) CreateCampaigns(ctx context.Context, c Campaign, placements []string) ([]Campaign, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("ads: database not configured")
	}
	status := strings.ToUpper(strings.TrimSpace(c.Status))
	if status == "" {
		status = "LIVE"
	}
	campaignID := "cmp-" + shortID()
	out := make([]Campaign, 0, len(placements))
	for _, placement := range placements {
		placementID := "ad-cmp-" + shortID()
		row, err := r.scanCampaign(r.pool.QueryRow(ctx, `
			insert into ads.campaigns (placement_id, campaign_id, seller_id, placement, target_type,
			                           target_id, target_app, category, store_id, title, subtitle, image_url,
			                           cta, state_code, starts_at, ends_at, status, sort_order)
			values ($1,$2,$3,$4::ad_placement,$5::ad_target_type,$6,$7::app_brand,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::ad_status,$18)
			returning `+campaignCols,
			placementID, campaignID, c.SellerID, placement, c.TargetType, c.TargetID, c.TargetApp,
			nullIfEmpty(c.Category), nullIfEmpty(c.StoreID), c.Title, c.Subtitle, c.ImageURL, c.CTA,
			nullIfEmpty(c.StateCode), c.StartsAt, c.EndsAt, status, c.SortOrder))
		if err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, nil
}

// UpdateCampaign replaces the editable fields of one row. Ownership, placement fit, creative bounds
// and (on a DRAFT→LIVE transition) the live cap are validated by the handler first. Placement and
// seller stay immutable; only the creative, target, schedule, status and play order change.
func (r *Repo) UpdateCampaign(ctx context.Context, id string, c Campaign) (Campaign, bool, error) {
	if r.pool == nil {
		return Campaign{}, false, fmt.Errorf("ads: database not configured")
	}
	updated, err := r.scanCampaign(r.pool.QueryRow(ctx, `
		update ads.campaigns
		   set target_type = $2::ad_target_type, target_id = $3, target_app = $4::app_brand,
		       category = $5, store_id = $6, title = $7, subtitle = $8, image_url = $9,
		       cta = $10, status = $11::ad_status, starts_at = $12, ends_at = $13,
		       sort_order = $14
		 where placement_id = $1
		 returning `+campaignCols,
		id, c.TargetType, c.TargetID, c.TargetApp, nullIfEmpty(c.Category), nullIfEmpty(c.StoreID),
		c.Title, c.Subtitle, c.ImageURL, c.CTA, c.Status, c.StartsAt, c.EndsAt, c.SortOrder))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Campaign{}, false, nil
		}
		return Campaign{}, false, err
	}
	return updated, true, nil
}

// DeleteCampaign removes one row the handler has already authorised for the caller.
func (r *Repo) DeleteCampaign(ctx context.Context, id string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("ads: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `delete from ads.campaigns where placement_id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ReorderStorefront writes the explicit STORE_TOP play order for one of a seller's stores. `ids` is
// the full ordered playlist; only rows that belong to the seller and store are touched. The handler
// validates ownership before calling, and this returns the number of rows actually reordered.
func (r *Repo) ReorderStorefront(ctx context.Context, sellerID, storeID string, ids []string) (int64, error) {
	if r.pool == nil {
		return 0, fmt.Errorf("ads: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var moved int64
	for i, id := range ids {
		tag, err := tx.Exec(ctx, `
			update ads.campaigns set sort_order = $3
			 where placement_id = $1 and seller_id = $2 and store_id = $4 and placement = 'STORE_TOP'`,
			id, sellerID, i, storeID)
		if err != nil {
			return 0, err
		}
		moved += tag.RowsAffected()
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return moved, nil
}

// CountLiveBySellerPlacement counts a seller's currently LIVE rows on one placement (cap guard).
func (r *Repo) CountLiveBySellerPlacement(ctx context.Context, sellerID, placement string) (int, error) {
	if r.pool == nil {
		return 0, fmt.Errorf("ads: database not configured")
	}
	var n int
	err := r.pool.QueryRow(ctx, `
		select count(*) from ads.campaigns
		 where seller_id = $1 and placement = $2::ad_placement and status = 'LIVE'`, sellerID, placement).Scan(&n)
	return n, err
}

// CountLiveBySellerStorePlacement counts a seller's LIVE rows on one placement for one store (the
// STORE_TOP playlist cap is per shop, so a seller with several shops gets a full playlist on each).
func (r *Repo) CountLiveBySellerStorePlacement(ctx context.Context, sellerID, storeID, placement string) (int, error) {
	if r.pool == nil {
		return 0, fmt.Errorf("ads: database not configured")
	}
	var n int
	err := r.pool.QueryRow(ctx, `
		select count(*) from ads.campaigns
		 where seller_id = $1 and coalesce(store_id,'') = $2
		   and placement = $3::ad_placement and status = 'LIVE'`, sellerID, storeID, placement).Scan(&n)
	return n, err
}

// ResolveOwnedTarget resolves a target id to its owning seller + app from the authoritative table.
// DISH ids are not globally unique (directory.menus is keyed by (venue_id, dish_id)), so an optional
// storeID disambiguates and the caller's own row is preferred. ok=false means "no such target".
func (r *Repo) ResolveOwnedTarget(ctx context.Context, sellerID, targetType, targetID, storeID string) (ResolvedTarget, bool, error) {
	if r.pool == nil {
		return ResolvedTarget{}, false, fmt.Errorf("ads: database not configured")
	}
	var (
		row pgx.Row
		t   ResolvedTarget
	)
	switch targetType {
	case "PRODUCT":
		// Ownership derives through the vendor store (0070 dropped catalog.products.seller_id).
		row = r.pool.QueryRow(ctx, `
			select coalesce(st.seller_id,''), p.app::text, coalesce(p.store_id,'')
			  from catalog.products p
			  left join directory.stores st on st.id = p.store_id
			 where p.id = $1`, targetID)
	case "DISH":
		// Menu ownership derives through the vendor store (0070 dropped directory.menus.seller_id);
		// a dining venue has no directory.stores row, so its dishes carry no owner.
		row = r.pool.QueryRow(ctx, `
			select coalesce(st.seller_id,''), 'FOOD', m.venue_id
			  from directory.menus m
			  left join directory.stores st on st.id = m.venue_id
			 where m.dish_id = $1 and ($2 = '' or m.venue_id = $2)
			 order by (coalesce(st.seller_id,'') = $3) desc, m.venue_id
			 limit 1`, targetID, storeID, sellerID)
	case "STORE":
		row = r.pool.QueryRow(ctx, `
			select coalesce(seller_id,''), app::text, id
			  from directory.stores where id = $1`, targetID)
	case "VENUE":
		// directory.dining_venues is restaurant-only and not seller-bound, so it has no owner.
		return ResolvedTarget{}, false, nil
	default:
		return ResolvedTarget{}, false, nil
	}
	if err := row.Scan(&t.SellerID, &t.App, &t.StoreID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ResolvedTarget{}, false, nil
		}
		return ResolvedTarget{}, false, err
	}
	return t, true, nil
}

// Takedown sets one row REJECTED with an admin reason (the abuse brake; never deletes).
func (r *Repo) Takedown(ctx context.Context, id, reason string) (Campaign, bool, error) {
	if r.pool == nil {
		return Campaign{}, false, fmt.Errorf("ads: database not configured")
	}
	updated, err := r.scanCampaign(r.pool.QueryRow(ctx, `
		update ads.campaigns set status = 'REJECTED', takedown_reason = $2
		 where placement_id = $1
		 returning `+campaignCols, id, nullIfEmpty(strings.TrimSpace(reason))))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Campaign{}, false, nil
		}
		return Campaign{}, false, err
	}
	return updated, true, nil
}

// ReportCampaign increments one row's user-report counter and returns the new total. Anon-safe: no
// user id is stored (de-dupe lives in Valkey keyed by a hashed identity), so no PII lands here.
func (r *Repo) ReportCampaign(ctx context.Context, id string) (int64, bool, error) {
	if r.pool == nil {
		return 0, false, fmt.Errorf("ads: database not configured")
	}
	var reports int64
	err := r.pool.QueryRow(ctx, `
		update ads.campaigns set reports = reports + 1
		 where placement_id = $1 returning reports`, id).Scan(&reports)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return reports, true, nil
}

// SetCampaignStatus flips one row's status (admin: takedown RESTORE → LIVE, takedown → REJECTED).
func (r *Repo) SetCampaignStatus(ctx context.Context, id, status string) (Campaign, bool, error) {
	if r.pool == nil {
		return Campaign{}, false, fmt.Errorf("ads: database not configured")
	}
	// Restoring clears the prior takedown note.
	updated, err := r.scanCampaign(r.pool.QueryRow(ctx, `
		update ads.campaigns
		   set status = $2::ad_status,
		       takedown_reason = case when $2::text = 'LIVE' then null else takedown_reason end
		 where placement_id = $1
		 returning `+campaignCols, id, status))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Campaign{}, false, nil
		}
		return Campaign{}, false, err
	}
	return updated, true, nil
}

func (r *Repo) scanCampaign(row interface{ Scan(...any) error }) (Campaign, error) {
	var (
		c                Campaign
		startsAt, endsAt time.Time
		requestedAt      time.Time
	)
	if err := row.Scan(&c.PlacementID, &c.CampaignID, &c.SellerID, &c.CreativeType, &c.Placement,
		&c.TargetType, &c.TargetID, &c.TargetApp, &c.Category, &c.StoreID, &c.Title, &c.Subtitle,
		&c.ImageURL, &c.CTA, &c.StateCode, &c.Status, &c.Reports, &c.TakedownReason,
		&c.Impressions, &c.Clicks, &c.OrdersAttributed, &c.SortOrder, &startsAt, &endsAt, &requestedAt); err != nil {
		return Campaign{}, err
	}
	c.StartsAt = startsAt.UTC().Format(time.RFC3339)
	c.EndsAt = endsAt.UTC().Format(time.RFC3339)
	c.RequestedAt = requestedAt.UTC().Format(time.RFC3339)
	return c, nil
}
