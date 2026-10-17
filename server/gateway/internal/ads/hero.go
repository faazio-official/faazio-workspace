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
	StartsAt         string `json:"startsAt"`
	EndsAt           string `json:"endsAt"`
	RequestedAt      string `json:"requestedAt"`
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
	       starts_at, ends_at, requested_at`

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
		 order by requested_at desc
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

// CreateCampaigns inserts one LIVE row per placement sharing a campaign_id. Self-serve: the handler
// has already machine-checked ownership, placement fit, creative bounds and the per-seller cap, so a
// verified seller publishes straight to LIVE (no admin approval queue). REQUESTED is never minted.
func (r *Repo) CreateCampaigns(ctx context.Context, c Campaign, placements []string) ([]Campaign, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("ads: database not configured")
	}
	campaignID := "cmp-" + shortID()
	out := make([]Campaign, 0, len(placements))
	for _, placement := range placements {
		placementID := "ad-cmp-" + shortID()
		row, err := r.scanCampaign(r.pool.QueryRow(ctx, `
			insert into ads.campaigns (placement_id, campaign_id, seller_id, placement, target_type,
			                           target_id, target_app, category, store_id, title, subtitle, image_url,
			                           cta, state_code, starts_at, ends_at, status)
			values ($1,$2,$3,$4::ad_placement,$5::ad_target_type,$6,$7::app_brand,$8,$9,$10,$11,$12,$13,$14,$15,$16,'LIVE')
			returning `+campaignCols,
			placementID, campaignID, c.SellerID, placement, c.TargetType, c.TargetID, c.TargetApp,
			nullIfEmpty(c.Category), nullIfEmpty(c.StoreID), c.Title, c.Subtitle, c.ImageURL, c.CTA,
			nullIfEmpty(c.StateCode), c.StartsAt, c.EndsAt))
		if err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, nil
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
		row = r.pool.QueryRow(ctx, `
			select coalesce(seller_id,''), app::text, coalesce(store_id,'')
			  from catalog.products where id = $1`, targetID)
	case "DISH":
		row = r.pool.QueryRow(ctx, `
			select coalesce(seller_id,''), 'FOOD', venue_id
			  from directory.menus
			 where dish_id = $1 and ($2 = '' or venue_id = $2)
			 order by (coalesce(seller_id,'') = $3) desc, venue_id
			 limit 1`, targetID, storeID, sellerID)
	case "STORE":
		row = r.pool.QueryRow(ctx, `
			select coalesce(seller_id,''), app::text, id
			  from directory.stores where id = $1`, targetID)
	case "VENUE":
		row = r.pool.QueryRow(ctx, `
			select coalesce(seller_id,''), 'FOOD', id
			  from directory.dining_venues where id = $1`, targetID)
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
		&c.Impressions, &c.Clicks, &c.OrdersAttributed, &startsAt, &endsAt, &requestedAt); err != nil {
		return Campaign{}, err
	}
	c.StartsAt = startsAt.UTC().Format(time.RFC3339)
	c.EndsAt = endsAt.UTC().Format(time.RFC3339)
	c.RequestedAt = requestedAt.UTC().Format(time.RFC3339)
	return c, nil
}
