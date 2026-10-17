// Hero campaigns (ads.campaigns, migration 0027): a seller-owned poster creative that deep-links to
// their own product/store, requested for one or more hero/contextual placements and moderated per
// placement. The anon projection (`HeroAd`) is display-only and cached; the control-plane row
// (`Campaign`) carries schedule + counters for the seller/admin consoles.
package ads

import (
	"context"
	"errors"
	"fmt"
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
	Impressions      int64  `json:"impressions"`
	Clicks           int64  `json:"clicks"`
	OrdersAttributed int64  `json:"ordersAttributed"`
	StartsAt         string `json:"startsAt"`
	EndsAt           string `json:"endsAt"`
	RequestedAt      string `json:"requestedAt"`
}

// maxHeroFill caps how many heroes a placement returns (relevance-first, then most recent).
const maxHeroFill = 8

const campaignSelect = `
	select placement_id, campaign_id, seller_id, creative_type::text, placement::text,
	       target_type::text, target_id, target_app::text, coalesce(category,''), coalesce(store_id,''),
	       title, subtitle, image_url, cta, coalesce(state_code,''), status::text,
	       impressions, clicks, orders_attributed, starts_at, ends_at, requested_at
	  from ads.campaigns`

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

// CreateCampaigns inserts one REQUESTED row per placement sharing a campaign_id.
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
			                           cta, state_code, starts_at, ends_at)
			values ($1,$2,$3,$4::ad_placement,$5::ad_target_type,$6,$7::app_brand,$8,$9,$10,$11,$12,$13,$14,$15,$16)
			returning placement_id, campaign_id, seller_id, creative_type::text, placement::text,
			          target_type::text, target_id, target_app::text, coalesce(category,''), coalesce(store_id,''),
			          title, subtitle, image_url, cta, coalesce(state_code,''), status::text,
			          impressions, clicks, orders_attributed, starts_at, ends_at, requested_at`,
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

// SetCampaignStatus moderates one placement row (REQUESTED/APPROVED/REJECTED/LIVE).
func (r *Repo) SetCampaignStatus(ctx context.Context, id, status string) (Campaign, bool, error) {
	if r.pool == nil {
		return Campaign{}, false, fmt.Errorf("ads: database not configured")
	}
	updated, err := r.scanCampaign(r.pool.QueryRow(ctx, `
		update ads.campaigns set status = $2::ad_status
		 where placement_id = $1
		 returning placement_id, campaign_id, seller_id, creative_type::text, placement::text,
		           target_type::text, target_id, target_app::text, coalesce(category,''), coalesce(store_id,''),
		           title, subtitle, image_url, cta, coalesce(state_code,''), status::text,
		           impressions, clicks, orders_attributed, starts_at, ends_at, requested_at`, id, status))
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
		&c.ImageURL, &c.CTA, &c.StateCode, &c.Status, &c.Impressions, &c.Clicks, &c.OrdersAttributed,
		&startsAt, &endsAt, &requestedAt); err != nil {
		return Campaign{}, err
	}
	c.StartsAt = startsAt.UTC().Format(time.RFC3339)
	c.EndsAt = endsAt.UTC().Format(time.RFC3339)
	c.RequestedAt = requestedAt.UTC().Format(time.RFC3339)
	return c, nil
}
