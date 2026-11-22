package catalog

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/locale"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// Addon is the portal-facing add-on projection. Money is paisa in the DB and on this wire shape
// (the seller portal's typed records are paisa-denominated, unlike the customer menu which is
// whole rupees). Status mirrors the product_status enum: DRAFT / PENDING_REVIEW / ACTIVE /
// REJECTED / DELISTED (rejections are stored back as DRAFT + review_reason in this feature).
type Addon struct {
	AddonID string `json:"addonId"`
	VenueID string `json:"venueId"`
	Name    string `json:"name"`
	// Tamil display copy (0108). Empty means "not translated" → the app falls back to English.
	NameTA       string `json:"nameTa,omitempty"`
	GroupNameTA  string `json:"groupNameTa,omitempty"`
	GroupName    string `json:"groupName"`
	PricePaisa   int64  `json:"pricePaisa"`
	IsVeg        bool   `json:"isVeg"`
	Status       string `json:"status"`
	ReviewReason string `json:"reviewReason,omitempty"`
	UpdatedAt    string `json:"updatedAt"`
}

// MenuAddon is one (dish, add-on) link with the add-on fields the seller add-ons tab renders.
type MenuAddon struct {
	Addon
	DishID  string `json:"dishId"`
	Enabled bool   `json:"enabled"`
}

// PublicAddon is the customer-facing shape (whole rupees, active + enabled links only).
type PublicAddon struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Tamil display copy (0108). Empty means "not translated" → the app falls back to English.
	NameTA      string `json:"nameTa,omitempty"`
	GroupNameTA string `json:"groupNameTa,omitempty"`
	GroupName   string `json:"groupName"`
	Price       int64  `json:"price"`
	IsVeg       bool   `json:"isVeg"`
}

const addonSelect = `
select a.addon_id, a.venue_id, a.name, a.group_name, a.price_paisa, a.is_veg,
       a.status::text, coalesce(a.review_reason, ''), a.updated_at,
       coalesce(a.name_ta, ''), coalesce(a.group_name_ta, '')
from directory.addons a
join directory.stores st on st.id = a.venue_id
left join sellers.sellers se on se.seller_id = st.seller_id`

// addonScopePredicate is $1=sellerID, $2=district (both empty = super admin).
const addonScopePredicate = `(
  ($1 <> '' and st.seller_id = $1) or
  ($2 <> '' and se.district_code = $2) or
  ($1 = '' and $2 = ''))`

// foodVenuePredicate is addonScopePredicate plus a FOOD guard. `directory.menus` and
// `directory.menu_addon_links` are FOOD-owned tables, so a Mart/Pharmacy store that somehow names a
// venue id must never be able to write a dish link. Add-ons themselves are sector-agnostic (0122);
// only the dish-link path is FOOD-only. The product-link path (productAddonPredicate) carries its
// own same-store + same-sector guard.
const foodVenuePredicate = `(` + addonScopePredicate + ` and st.app::text = 'FOOD')`

func scanAddon(row pgx.Row) (Addon, time.Time, error) {
	var (
		a         Addon
		updatedAt time.Time
	)
	err := row.Scan(&a.AddonID, &a.VenueID, &a.Name, &a.GroupName, &a.PricePaisa, &a.IsVeg,
		&a.Status, &a.ReviewReason, &updatedAt, &a.NameTA, &a.GroupNameTA)
	if err != nil {
		return Addon{}, time.Time{}, err
	}
	a.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return a, updatedAt, nil
}

// ListAddons lists add-ons in the caller's scope. venueID/status are optional filters.
func (r *Repo) ListAddons(ctx context.Context, sellerID, district, venueID, status string) ([]Addon, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, addonSelect+`
		where `+addonScopePredicate+`
		  and ($3 = '' or a.venue_id = $3)
		  and ($4 = '' or a.status::text = $4)
		order by a.updated_at desc`, sellerID, district, venueID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Addon{}
	for rows.Next() {
		var (
			a         Addon
			updatedAt time.Time
		)
		if err := rows.Scan(&a.AddonID, &a.VenueID, &a.Name, &a.GroupName, &a.PricePaisa, &a.IsVeg,
			&a.Status, &a.ReviewReason, &updatedAt, &a.NameTA, &a.GroupNameTA); err != nil {
			return nil, err
		}
		a.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, a)
	}
	return out, rows.Err()
}

// AddonByID returns one add-on if it is inside the caller's scope.
func (r *Repo) AddonByID(ctx context.Context, addonID, sellerID, district string) (Addon, bool, error) {
	if r.pool == nil {
		return Addon{}, false, fmt.Errorf("catalog: database not configured")
	}
	a, _, err := scanAddon(r.pool.QueryRow(ctx, addonSelect+`
		where a.addon_id = $3 and `+addonScopePredicate, sellerID, district, addonID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Addon{}, false, nil
		}
		return Addon{}, false, err
	}
	return a, true, nil
}

// CreateAddon inserts a DRAFT add-on owned by a venue store in the caller's scope. Add-ons serve
// every sector (0122); the row records the store's sector in `sector_app` so a read can filter
// without a join.
func (r *Repo) CreateAddon(ctx context.Context, venueID, name, group, nameTA, groupTA string, pricePaisa int64, isVeg bool, sellerID, district string) (Addon, bool, error) {
	if r.pool == nil {
		return Addon{}, false, fmt.Errorf("catalog: database not configured")
	}
	owned, err := r.venueInScope(ctx, venueID, sellerID, district)
	if err != nil {
		return Addon{}, false, err
	}
	if !owned {
		return Addon{}, false, nil
	}
	a, _, err := scanAddon(r.pool.QueryRow(ctx, `
		insert into directory.addons (addon_id, venue_id, sector_app, name, group_name, name_ta, group_name_ta, price_paisa, is_veg, status)
		select $1, $2, st.app::text, $3, $4, $5, $6, $7, $8, 'DRAFT'
		  from directory.stores st
		 where st.id = $2
		returning addon_id, venue_id, name, group_name, price_paisa, is_veg, status::text,
		          coalesce(review_reason, ''), updated_at, coalesce(name_ta, ''), coalesce(group_name_ta, '')`,
		newAddonID(), venueID, name, group, strings.TrimSpace(nameTA), strings.TrimSpace(groupTA), pricePaisa, isVeg))
	if err != nil {
		return Addon{}, false, err
	}
	return a, true, nil
}

// UpdateAddon patches the editable fields, scoped to the caller. Any sector's add-on is editable.
func (r *Repo) UpdateAddon(ctx context.Context, addonID, name, group, nameTA, groupTA string, pricePaisa int64, isVeg bool, sellerID, district string) (Addon, bool, error) {
	if r.pool == nil {
		return Addon{}, false, fmt.Errorf("catalog: database not configured")
	}
	a, _, err := scanAddon(r.pool.QueryRow(ctx, `
		update directory.addons a set name = $3, group_name = $4, price_paisa = $5, is_veg = $6,
		       name_ta = $8, group_name_ta = $9, updated_at = now()
		 from directory.stores st
		 left join sellers.sellers se on se.seller_id = st.seller_id
		 where a.addon_id = $7 and st.id = a.venue_id and `+addonScopePredicate+`
		 returning a.addon_id, a.venue_id, a.name, a.group_name, a.price_paisa, a.is_veg,
		           a.status::text, coalesce(a.review_reason, ''), a.updated_at,
		           coalesce(a.name_ta, ''), coalesce(a.group_name_ta, '')`,
		sellerID, district, name, group, pricePaisa, isVeg, addonID, strings.TrimSpace(nameTA), strings.TrimSpace(groupTA)))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Addon{}, false, nil
		}
		return Addon{}, false, err
	}
	return a, true, nil
}

// SubmitAddonForReview moves a seller-owned DRAFT/DELISTED/CHANGES_REQUESTED add-on to
// PENDING_REVIEW and clears any prior review note, so a resubmit starts from a clean slate.
func (r *Repo) SubmitAddonForReview(ctx context.Context, addonID, sellerID, district string) (Addon, bool, error) {
	if r.pool == nil {
		return Addon{}, false, fmt.Errorf("catalog: database not configured")
	}
	a, _, err := scanAddon(r.pool.QueryRow(ctx, `
		update directory.addons a set status = 'PENDING_REVIEW'::product_status,
		       review_reason = null, updated_at = now()
		 from directory.stores st
		 left join sellers.sellers se on se.seller_id = st.seller_id
		 where a.addon_id = $3 and st.id = a.venue_id
		   and a.status in ('DRAFT'::product_status, 'DELISTED'::product_status, 'CHANGES_REQUESTED'::product_status)
		   and `+addonScopePredicate+`
		 returning a.addon_id, a.venue_id, a.name, a.group_name, a.price_paisa, a.is_veg,
		           a.status::text, coalesce(a.review_reason, ''), a.updated_at,
		           coalesce(a.name_ta, ''), coalesce(a.group_name_ta, '')`,
		sellerID, district, addonID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Addon{}, false, nil
		}
		return Addon{}, false, err
	}
	return a, true, nil
}

// SetAddonStatus performs an admin moderation transition. `reason` is stored on the states that
// tell the seller what to fix — DRAFT (legacy reject) and CHANGES_REQUESTED — and cleared on
// ACTIVE/DELISTED. Add-ons are sector-agnostic, so any sector's add-on is moderatable here.
func (r *Repo) SetAddonStatus(ctx context.Context, addonID, status, reason, sellerID, district string) (Addon, bool, error) {
	if r.pool == nil {
		return Addon{}, false, fmt.Errorf("catalog: database not configured")
	}
	a, _, err := scanAddon(r.pool.QueryRow(ctx, `
		update directory.addons a set status = $3::product_status,
		       review_reason = case when $3 in ('DRAFT','CHANGES_REQUESTED') then nullif($4, '') else null end,
		       updated_at = now()
		 from directory.stores st
		 left join sellers.sellers se on se.seller_id = st.seller_id
		 where a.addon_id = $5 and st.id = a.venue_id and `+addonScopePredicate+`
		 returning a.addon_id, a.venue_id, a.name, a.group_name, a.price_paisa, a.is_veg,
		           a.status::text, coalesce(a.review_reason, ''), a.updated_at,
		           coalesce(a.name_ta, ''), coalesce(a.group_name_ta, '')`,
		sellerID, district, status, reason, addonID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Addon{}, false, nil
		}
		return Addon{}, false, err
	}
	return a, true, nil
}

// venueInScope reports whether the venue store belongs to the caller's seller/district scope,
// regardless of sector. Add-ons serve MART/FOOD/PHARMA (0122).
func (r *Repo) venueInScope(ctx context.Context, venueID, sellerID, district string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("catalog: database not configured")
	}
	var ok bool
	err := r.pool.QueryRow(ctx, `
		select exists (
			select 1 from directory.stores st
			left join sellers.sellers se on se.seller_id = st.seller_id
			 where st.id = $3 and `+addonScopePredicate+`)`,
		sellerID, district, venueID).Scan(&ok)
	return ok, err
}

// ListMenuAddons returns the add-on links for one dish (dishID "") or a whole venue. Seller scope.
func (r *Repo) ListMenuAddons(ctx context.Context, sellerID, district, venueID, dishID string) ([]MenuAddon, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select a.addon_id, a.venue_id, a.name, a.group_name, a.price_paisa, a.is_veg,
		       a.status::text, coalesce(a.review_reason, ''), a.updated_at, l.dish_id, l.is_enabled,
		       coalesce(a.name_ta, ''), coalesce(a.group_name_ta, '')
		  from directory.menu_addon_links l
		  join directory.addons a on a.addon_id = l.addon_id and a.venue_id = l.venue_id
		  join directory.stores st on st.id = a.venue_id
		  left join sellers.sellers se on se.seller_id = st.seller_id
		 where l.venue_id = $3
		   and ($4 = '' or l.dish_id = $4)
		   and `+addonScopePredicate+`
		 order by l.dish_id asc, a.group_name asc, a.name asc`, sellerID, district, venueID, dishID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MenuAddon{}
	for rows.Next() {
		var (
			m         MenuAddon
			updatedAt time.Time
		)
		if err := rows.Scan(&m.AddonID, &m.VenueID, &m.Name, &m.GroupName, &m.PricePaisa, &m.IsVeg,
			&m.Status, &m.ReviewReason, &updatedAt, &m.DishID, &m.Enabled, &m.NameTA, &m.GroupNameTA); err != nil {
			return nil, err
		}
		m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, m)
	}
	return out, rows.Err()
}

// LinkAddon attaches an add-on to a dish. The add-on must belong to the same venue and both the
// venue and the add-on must be in the caller's scope.
func (r *Repo) LinkAddon(ctx context.Context, venueID, dishID, addonID, sellerID, district string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("catalog: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		insert into directory.menu_addon_links (venue_id, dish_id, addon_id, is_enabled)
		select $3, $4, a.addon_id, true
		  from directory.addons a
		  join directory.stores st on st.id = a.venue_id
		  left join sellers.sellers se on se.seller_id = st.seller_id
		 where a.addon_id = $5 and a.venue_id = $3
		   and a.status <> 'DELISTED'::product_status
		   and `+foodVenuePredicate+`
		on conflict (venue_id, dish_id, addon_id) do update set is_enabled = true`,
		sellerID, district, venueID, dishID, addonID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// UnlinkAddon removes a dish → add-on link, scoped to the caller.
func (r *Repo) UnlinkAddon(ctx context.Context, venueID, dishID, addonID, sellerID, district string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("catalog: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		delete from directory.menu_addon_links l
		 using directory.stores st
		 left join sellers.sellers se on se.seller_id = st.seller_id
		 where l.venue_id = $3 and l.dish_id = $4 and l.addon_id = $5 and st.id = l.venue_id
		   and `+foodVenuePredicate, sellerID, district, venueID, dishID, addonID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ProductAddon is one (product, add-on) link with the add-on fields the retail add-ons tab renders.
type ProductAddon struct {
	Addon
	ProductID string `json:"productId"`
	Enabled   bool   `json:"enabled"`
}

// ListProductAddons returns the add-on links for one product (productID "") or a whole store.
// Seller scope. Serves every sector (Mart/Pharmacy products and Food packaged SKUs).
func (r *Repo) ListProductAddons(ctx context.Context, sellerID, district, venueID, productID string) ([]ProductAddon, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select a.addon_id, a.venue_id, a.name, a.group_name, a.price_paisa, a.is_veg,
		       a.status::text, coalesce(a.review_reason, ''), a.updated_at, l.product_id, l.is_enabled,
		       coalesce(a.name_ta, ''), coalesce(a.group_name_ta, '')
		  from directory.product_addon_links l
		  join directory.addons a on a.addon_id = l.addon_id and a.venue_id = l.venue_id
		  join directory.stores st on st.id = a.venue_id
		  left join sellers.sellers se on se.seller_id = st.seller_id
		 where l.venue_id = $3
		   and ($4 = '' or l.product_id = $4)
		   and `+addonScopePredicate+`
		 order by l.product_id asc, a.group_name asc, a.name asc`, sellerID, district, venueID, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ProductAddon{}
	for rows.Next() {
		var (
			m         ProductAddon
			updatedAt time.Time
		)
		if err := rows.Scan(&m.AddonID, &m.VenueID, &m.Name, &m.GroupName, &m.PricePaisa, &m.IsVeg,
			&m.Status, &m.ReviewReason, &updatedAt, &m.ProductID, &m.Enabled, &m.NameTA, &m.GroupNameTA); err != nil {
			return nil, err
		}
		m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, m)
	}
	return out, rows.Err()
}

// LinkProductAddon attaches an add-on to a product. The add-on and the product must belong to the
// SAME store (so a store can never bind another store's extra), the add-on must not be DELISTED, and
// the caller must own that store. The product↔store check is inside the statement so it is atomic.
func (r *Repo) LinkProductAddon(ctx context.Context, venueID, productID, addonID, sellerID, district string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("catalog: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		insert into directory.product_addon_links (venue_id, product_id, addon_id, is_enabled)
		select $3, p.id, a.addon_id, true
		  from directory.addons a
		  join directory.stores st on st.id = a.venue_id
		  left join sellers.sellers se on se.seller_id = st.seller_id
		  join catalog.products p on p.id = $4 and p.store_id = a.venue_id
		 where a.addon_id = $5 and a.venue_id = $3
		   and a.status <> 'DELISTED'::product_status
		   and `+addonScopePredicate+`
		on conflict (venue_id, product_id, addon_id) do update set is_enabled = true`,
		sellerID, district, venueID, productID, addonID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// UnlinkProductAddon removes a product → add-on link, scoped to the caller.
func (r *Repo) UnlinkProductAddon(ctx context.Context, venueID, productID, addonID, sellerID, district string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("catalog: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		delete from directory.product_addon_links l
		 using directory.stores st
		 left join sellers.sellers se on se.seller_id = st.seller_id
		 where l.venue_id = $3 and l.product_id = $4 and l.addon_id = $5 and st.id = l.venue_id
		   and `+addonScopePredicate, sellerID, district, venueID, productID, addonID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ListProductAddonsPublic is the customer read: ACTIVE, enabled add-ons bound to one product, for a
// live store. Whole rupees, matching the dish add-on projection.
func (r *Repo) ListProductAddonsPublic(ctx context.Context, productID string) ([]PublicAddon, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select a.addon_id, a.name, a.group_name, a.price_paisa, a.is_veg,
		       coalesce(a.name_ta, ''), coalesce(a.group_name_ta, '')
		  from directory.product_addon_links l
		  join directory.addons a on a.addon_id = l.addon_id and a.venue_id = l.venue_id
		 where l.product_id = $1 and l.is_enabled
		   and a.status = 'ACTIVE'::product_status
		   and not exists (
		         select 1 from directory.stores st
		          where st.id = l.venue_id and not st.is_live)
		 order by a.group_name asc, a.name asc`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PublicAddon{}
	for rows.Next() {
		var a PublicAddon
		if err := rows.Scan(&a.ID, &a.Name, &a.GroupName, &a.Price, &a.IsVeg, &a.NameTA, &a.GroupNameTA); err != nil {
			return nil, err
		}
		a.Price = a.Price / 100
		out = append(out, a)
	}
	return out, rows.Err()
}

// ListDishAddons is the public customer read: ACTIVE add-ons linked + enabled for one dish. An
// offline (is_live=false) shop offers no add-ons, matching its hidden menu.
func (r *Repo) ListDishAddons(ctx context.Context, venueID, dishID string) ([]PublicAddon, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select a.addon_id, a.name, a.group_name, a.price_paisa, a.is_veg,
		       coalesce(a.name_ta, ''), coalesce(a.group_name_ta, '')
		  from directory.menu_addon_links l
		  join directory.addons a on a.addon_id = l.addon_id and a.venue_id = l.venue_id
		 where l.venue_id = $1 and l.dish_id = $2 and l.is_enabled
		   and a.status = 'ACTIVE'::product_status
		   and not exists (
		         select 1 from directory.stores st
		          where st.id = l.venue_id and not st.is_live)
		 order by a.group_name asc, a.name asc`, venueID, dishID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PublicAddon{}
	for rows.Next() {
		var a PublicAddon
		if err := rows.Scan(&a.ID, &a.Name, &a.GroupName, &a.Price, &a.IsVeg, &a.NameTA, &a.GroupNameTA); err != nil {
			return nil, err
		}
		a.Price = a.Price / 100
		out = append(out, a)
	}
	return out, rows.Err()
}

func newAddonID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return "ad-" + hex.EncodeToString(b)
}

// ---------------------------------------------------------------- HTTP handlers

// listAddons serves GET /seller/addons?venueId=&status=.
func (h *Handler) listAddons(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	venueID := strings.TrimSpace(r.URL.Query().Get("venueId"))
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	items, err := h.repo.ListAddons(r.Context(), sellerID, district, venueID, status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// getAddon serves GET /seller/addons/{addonId}.
func (h *Handler) getAddon(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	a, found, err := h.repo.AddonByID(r.Context(), chi.URLParam(r, "addonId"), sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on not found")
		return
	}
	httpx.JSON(w, http.StatusOK, a)
}

// createAddon serves POST /seller/addons with {venueId, name, groupName, price, isVeg}. Money is
// whole rupees on the wire and stored as paisa.
func (h *Handler) createAddon(w http.ResponseWriter, r *http.Request) {
	var body struct {
		VenueID     string `json:"venueId"`
		Name        string `json:"name"`
		GroupName   string `json:"groupName"`
		NameTA      string `json:"nameTa"`
		GroupNameTA string `json:"groupNameTa"`
		Price       int64  `json:"price"`
		IsVeg       bool   `json:"isVeg"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	venueID := strings.TrimSpace(body.VenueID)
	name := strings.TrimSpace(body.Name)
	group := strings.TrimSpace(body.GroupName)
	if venueID == "" || name == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "venueId and name are required")
		return
	}
	if len(name) > 200 || len(group) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "name or group is too long")
		return
	}
	if body.Price < 0 || body.Price > 1_000_000 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid price")
		return
	}
	if !locale.IsTamilText(strings.TrimSpace(body.NameTA)) || len([]rune(strings.TrimSpace(body.NameTA))) > 200 ||
		!locale.IsTamilText(strings.TrimSpace(body.GroupNameTA)) || len([]rune(strings.TrimSpace(body.GroupNameTA))) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "Tamil fields accept Tamil letters only")
		return
	}
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	a, found, err := h.repo.CreateAddon(r.Context(), venueID, name, group, body.NameTA, body.GroupNameTA, body.Price*100, body.IsVeg, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "venue not found or not owned")
		return
	}
	h.logEntity(r, "ADDON_CREATE", "directory.addons", a.AddonID, map[string]any{"venueId": venueID, "status": a.Status})
	httpx.JSON(w, http.StatusCreated, a)
}

// updateAddon serves PUT /seller/addons/{addonId}.
func (h *Handler) updateAddon(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		GroupName   string `json:"groupName"`
		NameTA      string `json:"nameTa"`
		GroupNameTA string `json:"groupNameTa"`
		Price       int64  `json:"price"`
		IsVeg       bool   `json:"isVeg"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	name := strings.TrimSpace(body.Name)
	group := strings.TrimSpace(body.GroupName)
	if name == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "name is required")
		return
	}
	if len(name) > 200 || len(group) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "name or group is too long")
		return
	}
	if body.Price < 0 || body.Price > 1_000_000 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid price")
		return
	}
	if !locale.IsTamilText(strings.TrimSpace(body.NameTA)) || len([]rune(strings.TrimSpace(body.NameTA))) > 200 ||
		!locale.IsTamilText(strings.TrimSpace(body.GroupNameTA)) || len([]rune(strings.TrimSpace(body.GroupNameTA))) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "Tamil fields accept Tamil letters only")
		return
	}
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	id := chi.URLParam(r, "addonId")
	a, found, err := h.repo.UpdateAddon(r.Context(), id, name, group, body.NameTA, body.GroupNameTA, body.Price*100, body.IsVeg, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on not found")
		return
	}
	h.logEntity(r, "ADDON_UPDATE", "directory.addons", id, map[string]any{"price": body.Price})
	httpx.JSON(w, http.StatusOK, a)
}

// submitAddon serves POST /seller/addons/{addonId}/submit-for-review.
func (h *Handler) submitAddon(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	id := chi.URLParam(r, "addonId")
	a, found, err := h.repo.SubmitAddonForReview(r.Context(), id, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on not found")
		return
	}
	h.logEntity(r, "ADDON_PENDING_REVIEW", "directory.addons", id, map[string]any{"status": a.Status})
	httpx.JSON(w, http.StatusOK, a)
}

// approveAddon serves POST /seller/addons/{addonId}/approve. A seller may publish an add-on on their
// own venue (add-ons are the owner's day-to-day menu content, matching dish publishing); a district
// admin may approve any add-on in their district, and a super admin any add-on. The write itself is
// scoped by `addonScopePredicate`, so a seller can never touch a foreign venue's add-on.
func (h *Handler) approveAddon(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	id := chi.URLParam(r, "addonId")
	a, found, err := h.repo.SetAddonStatus(r.Context(), id, "ACTIVE", "", sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on not found")
		return
	}
	h.logEntity(r, "ADDON_ACTIVE", "directory.addons", id, map[string]any{"status": a.Status})
	h.notifyAddonModeration(r, a, "ACTIVE", "")
	httpx.JSON(w, http.StatusOK, a)
}

// rejectAddon serves POST /seller/addons/{addonId}/reject with {reason} (admin only). A rejected
// add-on returns to DRAFT with the review note so the seller can fix and resubmit.
func (h *Handler) rejectAddon(w http.ResponseWriter, r *http.Request) {
	if !auth.IsAdmin(r.Context()) {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "admin role required")
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	reason := strings.TrimSpace(body.Reason)
	if reason == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a rejection reason is required")
		return
	}
	if len(reason) > 500 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "review reason is too long")
		return
	}
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	id := chi.URLParam(r, "addonId")
	a, found, err := h.repo.SetAddonStatus(r.Context(), id, "DRAFT", reason, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on not found")
		return
	}
	h.logEntity(r, "ADDON_DRAFT", "directory.addons", id, map[string]any{"status": a.Status, "reason": reason})
	h.notifyAddonModeration(r, a, "REJECTED", reason)
	httpx.JSON(w, http.StatusOK, a)
}

// requestAddonChanges serves POST /seller/addons/{addonId}/request-changes with {reason} (admin
// only). The add-on moves to CHANGES_REQUESTED with the note attached, so the seller edits and
// resubmits instead of starting over from DRAFT.
func (h *Handler) requestAddonChanges(w http.ResponseWriter, r *http.Request) {
	if !auth.IsAdmin(r.Context()) {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "admin role required")
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	reason := strings.TrimSpace(body.Reason)
	if reason == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a reason is required")
		return
	}
	if len(reason) > 500 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "review reason is too long")
		return
	}
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	id := chi.URLParam(r, "addonId")
	a, found, err := h.repo.SetAddonStatus(r.Context(), id, "CHANGES_REQUESTED", reason, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on not found")
		return
	}
	h.logEntity(r, "ADDON_CHANGES_REQUESTED", "directory.addons", id, map[string]any{"status": a.Status, "reason": reason})
	h.notifyAddonModeration(r, a, "CHANGES_REQUESTED", reason)
	httpx.JSON(w, http.StatusOK, a)
}

// deleteAddon serves DELETE /seller/addons/{addonId} as a soft delist.
func (h *Handler) deleteAddon(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	id := chi.URLParam(r, "addonId")
	a, found, err := h.repo.SetAddonStatus(r.Context(), id, "DELISTED", "", sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on not found")
		return
	}
	h.logEntity(r, "ADDON_DELISTED", "directory.addons", id, map[string]any{"status": a.Status})
	httpx.JSON(w, http.StatusOK, a)
}

// listMenuAddons serves GET /seller/menu-addons?venueId=&dishId=.
func (h *Handler) listMenuAddons(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	venueID := strings.TrimSpace(r.URL.Query().Get("venueId"))
	if venueID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "venueId is required")
		return
	}
	items, err := h.repo.ListMenuAddons(r.Context(), sellerID, district, venueID, strings.TrimSpace(r.URL.Query().Get("dishId")))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// linkAddon serves POST /seller/menu-addons with {venueId, dishId, addonId}.
func (h *Handler) linkAddon(w http.ResponseWriter, r *http.Request) {
	var body struct {
		VenueID string `json:"venueId"`
		DishID  string `json:"dishId"`
		AddonID string `json:"addonId"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	venueID := strings.TrimSpace(body.VenueID)
	dishID := strings.TrimSpace(body.DishID)
	addonID := strings.TrimSpace(body.AddonID)
	if venueID == "" || dishID == "" || addonID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "venueId, dishId and addonId are required")
		return
	}
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	linked, err := h.repo.LinkAddon(r.Context(), venueID, dishID, addonID, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !linked {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on not found or not owned")
		return
	}
	h.logEntity(r, "ADDON_LINK", "directory.menu_addon_links", venueID+":"+dishID+":"+addonID, nil)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// unlinkAddon serves DELETE /seller/menu-addons/{venueId}/{dishId}/{addonId}.
func (h *Handler) unlinkAddon(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	venueID := chi.URLParam(r, "venueId")
	dishID := chi.URLParam(r, "dishId")
	addonID := chi.URLParam(r, "addonId")
	removed, err := h.repo.UnlinkAddon(r.Context(), venueID, dishID, addonID, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !removed {
		httpx.Fail(w, http.StatusNotFound, "not_found", "link not found")
		return
	}
	h.logEntity(r, "ADDON_UNLINK", "directory.menu_addon_links", venueID+":"+dishID+":"+addonID, nil)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// dishAddons serves GET /venues/{venueId}/menu/{dishId}/addons (public, ACTIVE only).
func (h *Handler) dishAddons(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListDishAddons(r.Context(), chi.URLParam(r, "venueId"), chi.URLParam(r, "dishId"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// listProductAddons serves GET /seller/product-addons?venueId=&productId=.
func (h *Handler) listProductAddons(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	venueID := strings.TrimSpace(r.URL.Query().Get("venueId"))
	if venueID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "venueId is required")
		return
	}
	items, err := h.repo.ListProductAddons(r.Context(), sellerID, district, venueID, strings.TrimSpace(r.URL.Query().Get("productId")))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// linkProductAddon serves POST /seller/product-addons with {venueId, productId, addonId}.
func (h *Handler) linkProductAddon(w http.ResponseWriter, r *http.Request) {
	var body struct {
		VenueID   string `json:"venueId"`
		ProductID string `json:"productId"`
		AddonID   string `json:"addonId"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	venueID := strings.TrimSpace(body.VenueID)
	productID := strings.TrimSpace(body.ProductID)
	addonID := strings.TrimSpace(body.AddonID)
	if venueID == "" || productID == "" || addonID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "venueId, productId and addonId are required")
		return
	}
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	linked, err := h.repo.LinkProductAddon(r.Context(), venueID, productID, addonID, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !linked {
		httpx.Fail(w, http.StatusNotFound, "not_found", "add-on or product not found, not owned, or not in the same store")
		return
	}
	h.logEntity(r, "ADDON_PRODUCT_LINK", "directory.product_addon_links", venueID+":"+productID+":"+addonID, nil)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// unlinkProductAddon serves DELETE /seller/product-addons/{venueId}/{productId}/{addonId}.
func (h *Handler) unlinkProductAddon(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no add-on scope on this account")
		return
	}
	venueID := chi.URLParam(r, "venueId")
	productID := chi.URLParam(r, "productId")
	addonID := chi.URLParam(r, "addonId")
	removed, err := h.repo.UnlinkProductAddon(r.Context(), venueID, productID, addonID, sellerID, district)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !removed {
		httpx.Fail(w, http.StatusNotFound, "not_found", "link not found")
		return
	}
	h.logEntity(r, "ADDON_PRODUCT_UNLINK", "directory.product_addon_links", venueID+":"+productID+":"+addonID, nil)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// productAddons serves GET /venues/{venueId}/products/{productId}/addons (public, ACTIVE only).
// `venueId` is in the path for a cacheable, store-scoped URL; the repo keys the read on the product.
func (h *Handler) productAddons(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListProductAddonsPublic(r.Context(), chi.URLParam(r, "productId"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// notifyAddonModeration tells the seller about an admin decision. Best-effort, after the write.
func (h *Handler) notifyAddonModeration(r *http.Request, a Addon, decision, reason string) {
	if h.notifier == nil {
		return
	}
	kind, title, body := "", "", ""
	switch decision {
	case "ACTIVE":
		kind, title, body = "ADDON_APPROVED", "Add-on approved", a.Name+" is now live on your menu."
	case "CHANGES_REQUESTED":
		kind, title, body = "ADDON_CHANGES_REQUESTED", "Add-on needs changes", a.Name+" needs an update: "+reason
	case "REJECTED":
		kind, title, body = "ADDON_REJECTED", "Add-on needs changes", a.Name+" was returned for changes: "+reason
	default:
		return
	}
	_ = h.notifier.EnqueueSeller(r.Context(), []string{a.VenueID}, kind, title, body, map[string]any{
		"addonId": a.AddonID, "venueId": a.VenueID, "status": decision,
		"deepLink": "/seller/inventory?tab=addons",
	})
}

// logEntity writes an audit entry for a non-product catalog entity.
func (h *Handler) logEntity(r *http.Request, action, entity, entityID string, after any) {
	if h.audit == nil {
		return
	}
	actorID := auth.UserID(r.Context())
	if actorID == "" {
		actorID = auth.SellerID(r.Context())
	}
	if actorID == "" {
		actorID = "anonymous"
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleSeller
	}
	var raw json.RawMessage
	if after != nil {
		if b, err := json.Marshal(after); err == nil {
			raw = b
		}
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: entity, EntityID: entityID, After: raw,
	})
}
