// Package directory serves the store directory context. Future service: Go +
// Postgres/CockroachDB (monolith-breakdown §1).
package directory

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Repo reads directory.stores.
type Repo struct {
	pool *db.Pool
}

// New returns a directory repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const storeSelect = `
select id, app::text, name, categories, rating, reviews_count, delivery_time, distance,
       cover_image, emoji, desc_text, offer_tag, is_veg, address, phone, hours
from directory.stores`

// storeListSelect is the public list projection: it never fetches the PII columns (address/phone),
// so they cannot reach the gateway, the wire, or the edge cache. Product detail keeps storeSelect.
const storeListSelect = `
select id, app::text, name, categories, rating, reviews_count, delivery_time, distance,
       cover_image, emoji, desc_text, offer_tag, is_veg, null::text as address, null::text as phone, hours
from directory.stores`

// ByApp returns stores for one app (empty app = all).
func (r *Repo) ByApp(ctx context.Context, app string) ([]contracts.Store, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, storeSelect+` where ($1 = '' or app::text = $1) order by rating desc`, app)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStores(rows)
}

// ByAppPage returns stores ordered by (rating desc, id asc) using keyset pagination.
// When hasCursor is true, rows at or before (cursorRating, cursorID) are skipped. The
// query fetches limit+1 rows so the caller can tell whether another page exists.
func (r *Repo) ByAppPage(ctx context.Context, app string, limit int, cursorRating float64, cursorID string, hasCursor bool) ([]contracts.Store, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, storeListSelect+`
		where ($1 = '' or app::text = $1)
		  and is_live
		  and (not $2::bool or rating < $3::float8 or (rating = $3::float8 and id > $4))
		order by rating desc, id asc
		limit $5`, app, hasCursor, cursorRating, cursorID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStores(rows)
}

// ByID returns one store.
func (r *Repo) ByID(ctx context.Context, id string) (contracts.Store, bool, error) {
	if r.pool == nil {
		return contracts.Store{}, false, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, storeSelect+` where id = $1`, id)
	if err != nil {
		return contracts.Store{}, false, err
	}
	defer rows.Close()
	stores, err := scanStores(rows)
	if err != nil {
		return contracts.Store{}, false, err
	}
	if len(stores) == 0 {
		return contracts.Store{}, false, nil
	}
	return stores[0], true, nil
}

// PickupPoints returns active pickup points. When storeIDs is non-empty it returns only those
// stores plus the neutral fallback hub; otherwise every active point.
func (r *Repo) PickupPoints(ctx context.Context, storeIDs []string) ([]contracts.PickupPoint, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	if len(storeIDs) == 0 {
		storeIDs = nil
	}
	rows, err := r.pool.Query(ctx, `
		select id, coalesce(store_id,''), name, address, coalesce(phone,''), coalesce(hours,''), is_active
		  from inventory.pickup_points
		 where is_active
		   and ($1::text[] is null or id = any($1) or id = 'pickup-neutral')
		 order by name`, storeIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.PickupPoint{}
	for rows.Next() {
		var p contracts.PickupPoint
		if err := rows.Scan(&p.ID, &p.StoreID, &p.Name, &p.Address, &p.Phone, &p.Hours, &p.IsActive); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Menu returns a venue's menu rows (public catalog data), ordered by rating then name.
func (r *Repo) Menu(ctx context.Context, venueID string) ([]contracts.MenuDish, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select dish_id, name, price_paisa, is_veg, cuisine, rating, image, description, emoji, delivery_time
		  from directory.menus where venue_id = $1
		 order by rating desc nulls last, name asc`, venueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.MenuDish{}
	for rows.Next() {
		var (
			d        contracts.MenuDish
			isVeg    *bool
			cuisine  *string
			rating   *float64
			desc     *string
			emoji    *string
			delivery *string
		)
		if err := rows.Scan(&d.ID, &d.Name, &d.Price, &isVeg, &cuisine, &rating, &d.Image, &desc, &emoji, &delivery); err != nil {
			return nil, err
		}
		d.Price = d.Price / 100
		d.IsVeg = isVeg
		d.Rating = rating
		d.Description = derefStr(desc)
		d.Emoji = derefStr(emoji)
		d.DeliveryTime = derefStr(delivery)
		if cuisine != nil {
			d.Cuisine = *cuisine
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// venueListSelect is the public list projection: like storeListSelect it never fetches the PII
// columns (address/phone), so an anonymous venue list cannot reach the wire or the edge cache.
const venueListSelect = `
select id, app::text, name, rating, cover_image, categories,
       null::text as address, null::text as phone, hours
from directory.dining_venues`

// Venues returns dining venues for one app (empty app = all), best-rated first. This is the list
// surface the Food home needs; only the PII-free projection is used (caching doc §6).
func (r *Repo) Venues(ctx context.Context, app string) ([]contracts.Venue, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, venueListSelect+`
		where ($1 = '' or app::text = $1)
		order by rating desc nulls last, name asc`, app)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.Venue{}
	for rows.Next() {
		var (
			v       contracts.Venue
			rating  *float64
			address *string
			phone   *string
			hours   *string
		)
		if err := rows.Scan(&v.ID, &v.App, &v.Name, &rating, &v.CoverImage, &v.Categories, &address, &phone, &hours); err != nil {
			return nil, err
		}
		v.Rating = rating
		v.Address = derefStr(address)
		v.Phone = derefStr(phone)
		v.Hours = derefStr(hours)
		out = append(out, v)
	}
	return out, rows.Err()
}

func scanStores(rows pgx.Rows) ([]contracts.Store, error) {
	out := []contracts.Store{}
	for rows.Next() {
		var (
			s        contracts.Store
			reviews  *int64
			offerTag *string
			isVeg    *bool
			address  *string
			phone    *string
			hours    *string
		)
		if err := rows.Scan(
			&s.ID, &s.App, &s.Name, &s.Categories, &s.Rating, &reviews,
			&s.DeliveryTime, &s.Distance, &s.CoverImage, &s.Emoji, &s.Desc,
			&offerTag, &isVeg, &address, &phone, &hours,
		); err != nil {
			return nil, err
		}
		s.ReviewsCount = reviews
		s.OfferTag = derefStr(offerTag)
		s.IsVeg = isVeg
		s.Address = derefStr(address)
		s.Phone = derefStr(phone)
		s.Hours = derefStr(hours)
		out = append(out, s)
	}
	return out, rows.Err()
}

func derefStr(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

// SellerStore is the portal-facing store-management projection (includes seller scope + live flag).
type SellerStore struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	App       string  `json:"app"`
	SellerID  string  `json:"sellerId,omitempty"`
	StateCode string  `json:"stateCode,omitempty"`
	IsLive    bool    `json:"isLive"`
	Rating    float64 `json:"rating"`
	UpdatedAt string  `json:"updatedAt"`
}

// SellerStores lists the stores a seller owns.
func (r *Repo) SellerStores(ctx context.Context, sellerID string) ([]SellerStore, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select id, name, app::text, coalesce(seller_id,''), coalesce(state_code,''), is_live, rating, updated_at
		  from directory.stores
		 where ($1 = '' or seller_id = $1)
		 order by name asc`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SellerStore{}
	for rows.Next() {
		var (
			s         SellerStore
			updatedAt time.Time
		)
		if err := rows.Scan(&s.ID, &s.Name, &s.App, &s.SellerID, &s.StateCode, &s.IsLive, &s.Rating, &updatedAt); err != nil {
			return nil, err
		}
		s.Rating = math.Round(s.Rating*10) / 10
		s.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, s)
	}
	return out, rows.Err()
}

// SetStoreLive flips a store's live flag, scoped to the caller's seller_id unless admin.
func (r *Repo) SetStoreLive(ctx context.Context, id, sellerID string, live, admin bool) (SellerStore, bool, error) {
	if r.pool == nil {
		return SellerStore{}, false, fmt.Errorf("directory: database not configured")
	}
	var (
		s         SellerStore
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update directory.stores
		   set is_live = $2, updated_at = now()
		 where id = $1 and ($3 or seller_id = $4)
		 returning id, name, app::text, coalesce(seller_id,''), coalesce(state_code,''), is_live, rating, updated_at`,
		id, live, admin, sellerID).
		Scan(&s.ID, &s.Name, &s.App, &s.SellerID, &s.StateCode, &s.IsLive, &s.Rating, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerStore{}, false, nil
		}
		return SellerStore{}, false, err
	}
	s.Rating = math.Round(s.Rating*10) / 10
	s.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return s, true, nil
}

// SellerMenu is the portal-facing menu-management projection (includes seller scope + status).
type SellerMenu struct {
	VenueID  string   `json:"venueId"`
	DishID   string   `json:"dishId"`
	Name     string   `json:"name"`
	Price    int64    `json:"price"` // rupees
	IsVeg    *bool    `json:"isVeg,omitempty"`
	Cuisine  string   `json:"cuisine,omitempty"`
	Rating   *float64 `json:"rating,omitempty"`
	Image    string   `json:"image,omitempty"`
	SellerID string   `json:"sellerId,omitempty"`
	Status   string   `json:"status"`
}

const sellerMenuSelect = `
select venue_id, dish_id, name, price_paisa, is_veg, cuisine, rating, image,
       coalesce(seller_id,''), status::text
from directory.menus`

// SellerMenus lists menus scoped by seller and/or venue (empty filters = all). Admin moderation sees
// every status; a seller only ever queries their own seller_id.
func (r *Repo) SellerMenus(ctx context.Context, sellerID, venueID string) ([]SellerMenu, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, sellerMenuSelect+`
		where ($1 = '' or seller_id = $1)
		  and ($2 = '' or venue_id = $2)
		order by venue_id asc, name asc`, sellerID, venueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SellerMenu{}
	for rows.Next() {
		var (
			m       SellerMenu
			isVeg   *bool
			cuisine *string
			rating  *float64
		)
		if err := rows.Scan(&m.VenueID, &m.DishID, &m.Name, &m.Price, &isVeg, &cuisine, &rating, &m.Image, &m.SellerID, &m.Status); err != nil {
			return nil, err
		}
		m.Price = m.Price / 100
		m.IsVeg = isVeg
		m.Rating = rating
		if cuisine != nil {
			m.Cuisine = *cuisine
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// UpsertMenu inserts (owner = sellerID) or updates a dish. A non-admin may only update their own
// row; an update outside scope returns ok=false without changing data.
func (r *Repo) UpsertMenu(ctx context.Context, m SellerMenu, sellerID string, admin bool) (SellerMenu, bool, error) {
	if r.pool == nil {
		return SellerMenu{}, false, fmt.Errorf("directory: database not configured")
	}
	var (
		out     SellerMenu
		isVeg   *bool
		cuisine *string
		rating  *float64
	)
	err := r.pool.QueryRow(ctx, `
		insert into directory.menus (venue_id, dish_id, name, price_paisa, is_veg, cuisine, rating, image, seller_id, status)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT')
		on conflict (venue_id, dish_id) do update
		   set name = excluded.name, price_paisa = excluded.price_paisa, is_veg = excluded.is_veg,
		       cuisine = excluded.cuisine, rating = excluded.rating, image = excluded.image
		 where $10 or directory.menus.seller_id = $9
		returning venue_id, dish_id, name, price_paisa, is_veg, cuisine, rating, image,
		          coalesce(seller_id,''), status::text`,
		m.VenueID, m.DishID, m.Name, m.Price*100, m.IsVeg, nullIfEmpty(m.Cuisine), m.Rating, m.Image, sellerID, admin).
		Scan(&out.VenueID, &out.DishID, &out.Name, &out.Price, &isVeg, &cuisine, &rating, &out.Image, &out.SellerID, &out.Status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerMenu{}, false, nil
		}
		return SellerMenu{}, false, err
	}
	out.Price = out.Price / 100
	out.IsVeg = isVeg
	out.Rating = rating
	if cuisine != nil {
		out.Cuisine = *cuisine
	}
	return out, true, nil
}

// SetMenuStatus updates a dish's moderation status, scoped like UpsertMenu.
func (r *Repo) SetMenuStatus(ctx context.Context, venueID, dishID, sellerID, status string, admin bool) (SellerMenu, bool, error) {
	if r.pool == nil {
		return SellerMenu{}, false, fmt.Errorf("directory: database not configured")
	}
	var (
		m       SellerMenu
		isVeg   *bool
		cuisine *string
		rating  *float64
	)
	err := r.pool.QueryRow(ctx, `
		update directory.menus set status = $4::product_status
		 where venue_id = $1 and dish_id = $2 and ($5 or seller_id = $3)
		 returning venue_id, dish_id, name, price_paisa, is_veg, cuisine, rating, image,
		           coalesce(seller_id,''), status::text`,
		venueID, dishID, sellerID, status, admin).
		Scan(&m.VenueID, &m.DishID, &m.Name, &m.Price, &isVeg, &cuisine, &rating, &m.Image, &m.SellerID, &m.Status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerMenu{}, false, nil
		}
		return SellerMenu{}, false, err
	}
	m.Price = m.Price / 100
	m.IsVeg = isVeg
	m.Rating = rating
	if cuisine != nil {
		m.Cuisine = *cuisine
	}
	return m, true, nil
}

// DeleteMenu removes a dish, scoped like UpsertMenu.
func (r *Repo) DeleteMenu(ctx context.Context, venueID, dishID, sellerID string, admin bool) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("directory: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		delete from directory.menus
		 where venue_id = $1 and dish_id = $2 and ($3 or seller_id = $4)`,
		venueID, dishID, admin, sellerID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}
