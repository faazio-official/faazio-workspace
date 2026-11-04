// Package directory serves the store directory context. Future service: Go +
// Postgres/CockroachDB (monolith-breakdown §1).
package directory

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Repo reads directory.stores.
type Repo struct {
	pool *db.Pool
	// cdnBase is the media CDN origin; when set, store cover_image_key / menu image_key resolve to CDN
	// URLs on read (falling back to the legacy cover_image / image text column).
	cdnBase string
}

// New returns a directory repo. cdnBase is optional (media CDN origin) and keeps existing call sites valid.
func New(pool *db.Pool, cdnBase ...string) *Repo {
	r := &Repo{pool: pool}
	if len(cdnBase) > 0 {
		r.cdnBase = strings.TrimRight(cdnBase[0], "/")
	}
	return r
}

const storeSelect = `
select id, app::text, name, categories, rating, reviews_count, delivery_time, distance,
       cover_image, cover_image_key, emoji, desc_text, offer_tag, is_veg, address, phone, hours,
       coalesce(state_code,''), latitude, longitude, null::float8 as distance_km
from directory.stores`

// storeListSelect is the public list projection: it never fetches the PII columns (address/phone),
// so they cannot reach the gateway, the wire, or the edge cache. Product detail keeps storeSelect.
const storeListSelect = `
select id, app::text, name, categories, rating, reviews_count, delivery_time, distance,
       cover_image, cover_image_key, emoji, desc_text, offer_tag, is_veg, null::text as address, null::text as phone, hours,
       coalesce(state_code,''), latitude, longitude, null::float8 as distance_km
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
	return scanStores(rows, r.cdnBase)
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
	return scanStores(rows, r.cdnBase)
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
	stores, err := scanStores(rows, r.cdnBase)
	if err != nil {
		return contracts.Store{}, false, err
	}
	if len(stores) == 0 {
		return contracts.Store{}, false, nil
	}
	return stores[0], true, nil
}

// Nearby returns live stores within radiusKm of (lat, lng), nearest first. The bounding box
// prunes with the geo index; the Haversine expression orders the survivors. Public projection only.
func (r *Repo) Nearby(ctx context.Context, app string, lat, lng, radiusKm float64, limit int) ([]contracts.Store, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	if radiusKm <= 0 || radiusKm > 100 {
		radiusKm = 25
	}
	latDelta := radiusKm / 111.32
	cosLat := math.Cos(lat * math.Pi / 180)
	if cosLat < 0.01 {
		cosLat = 0.01
	}
	lngDelta := radiusKm / (111.32 * cosLat)
	rows, err := r.pool.Query(ctx, `
		select id, app::text, name, categories, rating, reviews_count, delivery_time, distance,
		       cover_image, cover_image_key, emoji, desc_text, offer_tag, is_veg,
		       null::text as address, null::text as phone, hours,
		       latitude, longitude,
		       (6371.0088 * acos(least(1, greatest(-1,
		           sin(radians($1)) * sin(radians(latitude)) +
		           cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
		       )))) as distance_km
		from directory.stores
		where is_live
		  and latitude is not null and longitude is not null
		  and latitude between $3 and $4
		  and longitude between $5 and $6
		  and ($7 = '' or app::text = $7)
		order by distance_km asc, rating desc, id asc
		limit $8`,
		lat, lng, lat-latDelta, lat+latDelta, lng-lngDelta, lng+lngDelta, app, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStores(rows, r.cdnBase)
}

// ByIDs returns stores for the given ids using the PII-free list projection (public reads only),
// preserving the requested id order. Used by the SDUI compiler to join Home store rails.
func (r *Repo) ByIDs(ctx context.Context, ids []string) ([]contracts.Store, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	if len(ids) == 0 {
		return []contracts.Store{}, nil
	}
	rows, err := r.pool.Query(ctx, storeListSelect+` where id = any($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	stores, err := scanStores(rows, r.cdnBase)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]contracts.Store, len(stores))
	for _, s := range stores {
		byID[s.ID] = s
	}
	out := make([]contracts.Store, 0, len(ids))
	for _, id := range ids {
		if s, ok := byID[id]; ok {
			out = append(out, s)
		}
	}
	return out, nil
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
		select dish_id, name, price_paisa, mrp_paisa, is_veg, cuisine, rating, image, image_key, description, emoji, delivery_time
		  from directory.menus where venue_id = $1 and status = 'ACTIVE'::product_status
		 order by rating desc nulls last, name asc`, venueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.MenuDish{}
	for rows.Next() {
		var (
			d        contracts.MenuDish
			mrp      *int64
			isVeg    *bool
			cuisine  *string
			rating   *float64
			desc     *string
			emoji    *string
			delivery *string
			imageKey *string
		)
		if err := rows.Scan(&d.ID, &d.Name, &d.Price, &mrp, &isVeg, &cuisine, &rating, &d.Image, &imageKey, &desc, &emoji, &delivery); err != nil {
			return nil, err
		}
		if imageKey != nil && *imageKey != "" && r.cdnBase != "" {
			d.Image = r.cdnBase + "/" + *imageKey
		}
		d.Price = d.Price / 100
		d.OriginalPrice = rupeesPtr(mrp)
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

// venueSelect is the full single-venue projection (authed reads). Public callers get the list
// projection instead so PII is never fetched for an anon cache entry.
const venueSelect = `
select id, app::text, name, rating, cover_image, categories, address, phone, hours
from directory.dining_venues`

// VenueByID returns one dining venue (full projection). Public callers must redact before caching.
func (r *Repo) VenueByID(ctx context.Context, id string) (contracts.Venue, bool, error) {
	if r.pool == nil {
		return contracts.Venue{}, false, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, venueSelect+` where id = $1`, id)
	if err != nil {
		return contracts.Venue{}, false, err
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
			return contracts.Venue{}, false, err
		}
		v.Rating = rating
		v.Address = derefStr(address)
		v.Phone = derefStr(phone)
		v.Hours = derefStr(hours)
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return contracts.Venue{}, false, err
	}
	if len(out) == 0 {
		return contracts.Venue{}, false, nil
	}
	return out[0], true, nil
}

func scanStores(rows pgx.Rows, cdnBase string) ([]contracts.Store, error) {
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
			coverKey *string
			lat, lng *float64
			distance *float64
		)
		if err := rows.Scan(
			&s.ID, &s.App, &s.Name, &s.Categories, &s.Rating, &reviews,
			&s.DeliveryTime, &s.Distance, &s.CoverImage, &coverKey, &s.Emoji, &s.Desc,
			&offerTag, &isVeg, &address, &phone, &hours, &s.StateCode,
			&lat, &lng, &distance,
		); err != nil {
			return nil, err
		}
		if coverKey != nil && *coverKey != "" && cdnBase != "" {
			s.CoverImage = cdnBase + "/" + *coverKey
		}
		s.ReviewsCount = reviews
		s.OfferTag = derefStr(offerTag)
		s.IsVeg = isVeg
		s.Address = derefStr(address)
		s.Phone = derefStr(phone)
		s.Hours = derefStr(hours)
		s.Latitude = lat
		s.Longitude = lng
		s.DistanceKm = distance
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
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	App          string  `json:"app"`
	SellerID     string  `json:"sellerId,omitempty"`
	StateCode    string  `json:"stateCode,omitempty"`
	Address      string  `json:"address,omitempty"`
	Phone        string  `json:"phone,omitempty"`
	Hours        string  `json:"hours,omitempty"`
	DeliveryTime string  `json:"deliveryTime,omitempty"`
	IsVeg        bool    `json:"isVeg"`
	IsLive       bool    `json:"isLive"`
	Rating       float64 `json:"rating"`
	UpdatedAt    string  `json:"updatedAt"`
	// Per-vendor commercial identity (0069): the fee is a property of the shop, not the account.
	PlatformFeePct   int    `json:"platformFeePct"`
	SellerCategoryID string `json:"sellerCategoryId,omitempty"`
	FSSAINumber      string `json:"fssaiNumber,omitempty"`
	FSSAICertKey     string `json:"fssaiCertKey,omitempty"`
	FSSAICertAssetID string `json:"fssaiCertAssetId,omitempty"`
	// PHARMA drug-selling licence (0076): mirrors FSSAI — the licence belongs to the shop, not the
	// account. Opt-in: a pharmacy may go live before the licence is attached.
	DrugLicenseNumber      string `json:"drugLicenseNumber,omitempty"`
	DrugLicenseCertKey     string `json:"drugLicenseCertKey,omitempty"`
	DrugLicenseCertAssetID string `json:"drugLicenseCertAssetId,omitempty"`
	// Public geo pin, returned by SetStoreLive so the handler can flush the store's geo:nearby
	// tiles. Internal only (never serialized).
	Latitude  float64 `json:"-"`
	Longitude float64 `json:"-"`
}

// MenuOrVenueSeller resolves the seller that owns a menu row's venue. Ownership derives through the
// vendor store (0070 dropped directory.menus.seller_id): a menu belongs to whoever owns the store it
// is served from. ok=false means the venue has no owning store — a dining venue, which is
// restaurant-only and not seller-bound, so it is SUPER_ADMIN-only.
func (r *Repo) MenuOrVenueSeller(ctx context.Context, venueID, dishID string) (string, bool, error) {
	if r.pool == nil {
		return "", false, fmt.Errorf("directory: database not configured")
	}
	var sellerID *string
	err := r.pool.QueryRow(ctx, `
		select seller_id from directory.stores where id = $1`, venueID).Scan(&sellerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	if sellerID == nil || *sellerID == "" {
		return "", false, nil
	}
	return *sellerID, true, nil
}

// SellerInDistrict reports whether a seller belongs to the given district (strict).
func (r *Repo) SellerInDistrict(ctx context.Context, sellerID, district string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("directory: database not configured")
	}
	var ok bool
	err := r.pool.QueryRow(ctx, `
		select exists (
			select 1 from sellers.sellers
			 where seller_id = $1 and district_code = $2)`, sellerID, district).Scan(&ok)
	return ok, err
}

// SellerStores lists stores scoped to a seller or district. A district admin passes district
// (strict: the store's seller must belong to it); a seller passes sellerID; a super admin passes
// neither and sees every store.
func (r *Repo) SellerStores(ctx context.Context, sellerID, district string) ([]SellerStore, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select `+sellerStoreColumns+`
		  from directory.stores s
		 where ($1 = '' or s.seller_id = $1)
		   and ($2 = '' or exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = s.seller_id and se.district_code = $2))
		 order by s.name asc`, sellerID, district)
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
		if err := rows.Scan(&s.ID, &s.Name, &s.App, &s.SellerID, &s.StateCode, &s.Address, &s.Phone, &s.Hours, &s.DeliveryTime,
			&s.IsVeg, &s.IsLive, &s.Rating, &updatedAt, &s.PlatformFeePct, &s.SellerCategoryID,
			&s.FSSAINumber, &s.FSSAICertKey, &s.FSSAICertAssetID,
			&s.DrugLicenseNumber, &s.DrugLicenseCertKey, &s.DrugLicenseCertAssetID); err != nil {
			return nil, err
		}
		s.Rating = math.Round(s.Rating*10) / 10
		s.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, s)
	}
	return out, rows.Err()
}

// SetStoreLive flips a store's live flag, scoped to the caller's seller_id or district (strict).
func (r *Repo) SetStoreLive(ctx context.Context, id, sellerID, district string, live bool) (SellerStore, bool, error) {
	if r.pool == nil {
		return SellerStore{}, false, fmt.Errorf("directory: database not configured")
	}
	var (
		s         SellerStore
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update directory.stores s
		   set is_live = $3, updated_at = now()
		 where s.id = $1 and (
		       ($2 <> '' and s.seller_id = $2) or
		       ($4 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = s.seller_id and se.district_code = $4)) or
		       ($2 = '' and $4 = ''))
		 returning s.id, s.name, s.app::text, coalesce(s.seller_id,''), coalesce(s.state_code,''), s.is_live, s.rating, s.updated_at,
		           coalesce(s.latitude,0), coalesce(s.longitude,0)`,
		id, sellerID, live, district).
		Scan(&s.ID, &s.Name, &s.App, &s.SellerID, &s.StateCode, &s.IsLive, &s.Rating, &updatedAt, &s.Latitude, &s.Longitude)
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

// SetStoreCover links a confirmed media asset as the store cover, scoped to the caller's seller_id
// or district (strict). key/assetID may be empty to clear the cover.
func (r *Repo) SetStoreCover(ctx context.Context, id, sellerID, district, key, assetID string) (SellerStore, bool, error) {
	if r.pool == nil {
		return SellerStore{}, false, fmt.Errorf("directory: database not configured")
	}
	var (
		s         SellerStore
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update directory.stores s
		   set cover_image_key = $3, cover_image_asset_id = $4, updated_at = now()
		 where s.id = $1 and (
		       ($2 <> '' and s.seller_id = $2) or
		       ($5 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = s.seller_id and se.district_code = $5)) or
		       ($2 = '' and $5 = ''))
		 returning s.id, s.name, s.app::text, coalesce(s.seller_id,''), coalesce(s.state_code,''), s.is_live, s.rating, s.updated_at`,
		id, sellerID, nullIfEmpty(key), nullIfEmpty(assetID), district).
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

// sellerStoreColumns is the shared projection for vendor writes (CreateStore/UpdateStore/SetStoreFee).
const sellerStoreColumns = `s.id, s.name, s.app::text, coalesce(s.seller_id,''), coalesce(s.state_code,''),
	coalesce(s.address,''), coalesce(s.phone,''), coalesce(s.hours,''), coalesce(s.delivery_time,''),
	coalesce(s.is_veg,false), s.is_live, s.rating, s.updated_at, s.platform_fee_pct, coalesce(s.seller_category_id,''),
	coalesce(s.fssai_number,''), coalesce(s.fssai_cert_key,''), coalesce(s.fssai_cert_asset_id,''),
	coalesce(s.drug_license_number,''), coalesce(s.drug_license_cert_key,''), coalesce(s.drug_license_cert_asset_id,'')`

func scanSellerStore(row pgx.Row) (SellerStore, error) {
	var (
		s         SellerStore
		updatedAt time.Time
	)
	if err := row.Scan(&s.ID, &s.Name, &s.App, &s.SellerID, &s.StateCode, &s.Address, &s.Phone, &s.Hours, &s.DeliveryTime,
		&s.IsVeg, &s.IsLive, &s.Rating, &updatedAt, &s.PlatformFeePct, &s.SellerCategoryID,
		&s.FSSAINumber, &s.FSSAICertKey, &s.FSSAICertAssetID,
		&s.DrugLicenseNumber, &s.DrugLicenseCertKey, &s.DrugLicenseCertAssetID); err != nil {
		return SellerStore{}, err
	}
	s.Rating = math.Round(s.Rating*10) / 10
	s.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return s, nil
}

// VendorInput is the create/edit payload for a vendor (directory.stores). Commercial fields
// (platform fee, taxonomy category, FSSAI) belong to the shop, not the account.
type VendorInput struct {
	Name      string
	App       string
	StateCode string
	Address   string
	Phone     string
	Hours     string
	Latitude  *float64
	Longitude *float64
	// PlatformFeePct 0 means "keep existing" on update; on create 0 falls back to the default.
	PlatformFeePct   int
	SellerCategoryID string
	FSSAINumber      string
	FSSAICertKey     string
	FSSAICertAssetID string
	// Drug licence (0076): PHARMA shops carry their drug-selling licence like FOOD shops carry FSSAI.
	// Optional — empty keeps the current value on update.
	DrugLicenseNumber      string
	DrugLicenseCertKey     string
	DrugLicenseCertAssetID string
	IsLive                 *bool
}

// CreateStore inserts a vendor owned by sellerID under the caller's scope. stateCode is the owning
// account's state (the shop inherits it); app is the vendor's brand.
func (r *Repo) CreateStore(ctx context.Context, sellerID, stateCode string, in VendorInput) (SellerStore, error) {
	if r.pool == nil {
		return SellerStore{}, fmt.Errorf("directory: database not configured")
	}
	fee := in.PlatformFeePct
	if fee == 0 {
		fee = 10
	}
	live := true
	if in.IsLive != nil {
		live = *in.IsLive
	}
	return scanSellerStore(r.pool.QueryRow(ctx, `
		insert into directory.stores
		  (id, app, name, seller_id, state_code, address, phone, hours, latitude, longitude,
		   platform_fee_pct, seller_category_id, fssai_number, fssai_cert_key, fssai_cert_asset_id,
		   drug_license_number, drug_license_cert_key, drug_license_cert_asset_id, is_live)
		values ($1, $2::app_brand, $3, $4, nullif($5,''), nullif($6,''), nullif($7,''), nullif($8,''),
		        $9, $10, $11, nullif($12,''), $13, $14, $15, $16, $17, $18, $19)
		returning `+sellerStoreColumns,
		"store-"+storeID(), in.App, in.Name, sellerID, stateCode, in.Address, in.Phone, in.Hours,
		in.Latitude, in.Longitude, fee, in.SellerCategoryID, in.FSSAINumber, in.FSSAICertKey,
		in.FSSAICertAssetID, in.DrugLicenseNumber, in.DrugLicenseCertKey, in.DrugLicenseCertAssetID, live))
}

// UpdateStore edits a vendor, scoped to the caller's seller_id or district (strict) exactly like
// SetStoreLive. Empty optional fields keep their existing value; PlatformFeePct 0 keeps the current
// fee.
func (r *Repo) UpdateStore(ctx context.Context, id, sellerID, district string, in VendorInput) (SellerStore, bool, error) {
	if r.pool == nil {
		return SellerStore{}, false, fmt.Errorf("directory: database not configured")
	}
	s, err := scanSellerStore(r.pool.QueryRow(ctx, `
		update directory.stores s set
		  name = coalesce(nullif($3,''), s.name),
		  address = coalesce(nullif($4,''), s.address),
		  phone = coalesce(nullif($5,''), s.phone),
		  hours = coalesce(nullif($6,''), s.hours),
		  latitude = coalesce($7, s.latitude),
		  longitude = coalesce($8, s.longitude),
		  platform_fee_pct = case when $9 = 0 then s.platform_fee_pct else $9 end,
		  seller_category_id = coalesce(nullif($10,''), s.seller_category_id),
		  fssai_number = coalesce(nullif($11,''), s.fssai_number),
		  fssai_cert_key = coalesce(nullif($12,''), s.fssai_cert_key),
		  fssai_cert_asset_id = coalesce(nullif($13,''), s.fssai_cert_asset_id),
		  drug_license_number = coalesce(nullif($14,''), s.drug_license_number),
		  drug_license_cert_key = coalesce(nullif($15,''), s.drug_license_cert_key),
		  drug_license_cert_asset_id = coalesce(nullif($16,''), s.drug_license_cert_asset_id),
		  is_live = coalesce($17, s.is_live),
		  updated_at = now()
		 where s.id = $1 and (
		       ($2 <> '' and s.seller_id = $2) or
		       ($18 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = s.seller_id and se.district_code = $18)) or
		       ($2 = '' and $18 = ''))
		 returning `+sellerStoreColumns,
		id, sellerID, in.Name, in.Address, in.Phone, in.Hours, in.Latitude, in.Longitude,
		in.PlatformFeePct, in.SellerCategoryID, in.FSSAINumber, in.FSSAICertKey, in.FSSAICertAssetID,
		in.DrugLicenseNumber, in.DrugLicenseCertKey, in.DrugLicenseCertAssetID, in.IsLive, district))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerStore{}, false, nil
		}
		return SellerStore{}, false, err
	}
	return s, true, nil
}

// ValidVendorCategory reports whether id is an active taxonomy category for the vendor's app.
func (r *Repo) ValidVendorCategory(ctx context.Context, app, id string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("directory: database not configured")
	}
	var exists bool
	err := r.pool.QueryRow(ctx, `
		select exists(select 1 from taxonomy.categories
		               where id = $1 and app::text = $2 and is_active)`, id, app).Scan(&exists)
	return exists, err
}

// StoreVendorMeta returns the store's app + current FSSAI fields under the caller's scope, so update
// validation can require a certificate only when the shop does not already hold one.
func (r *Repo) StoreVendorMeta(ctx context.Context, id, sellerID, district string) (app, fssaiNumber, fssaiKey string, ok bool, err error) {
	if r.pool == nil {
		return "", "", "", false, fmt.Errorf("directory: database not configured")
	}
	err = r.pool.QueryRow(ctx, `
		select s.app::text, coalesce(s.fssai_number,''), coalesce(s.fssai_cert_key,'')
		  from directory.stores s
		 where s.id = $1 and (
		       ($2 <> '' and s.seller_id = $2) or
		       ($3 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = s.seller_id and se.district_code = $3)) or
		       ($2 = '' and $3 = ''))`, id, sellerID, district).Scan(&app, &fssaiNumber, &fssaiKey)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", "", false, nil
		}
		return "", "", "", false, err
	}
	return app, fssaiNumber, fssaiKey, true, nil
}

// StoreApp returns a store's app brand under the caller's ownership scope, so fee validation can be
// keyed on the store's real app (not a client-supplied one).
func (r *Repo) StoreApp(ctx context.Context, id, sellerID, district string) (string, bool, error) {
	if r.pool == nil {
		return "", false, fmt.Errorf("directory: database not configured")
	}
	var app string
	err := r.pool.QueryRow(ctx, `
		select s.app::text from directory.stores s
		 where s.id = $1 and (
		       ($2 <> '' and s.seller_id = $2) or
		       ($3 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = s.seller_id and se.district_code = $3)) or
		       ($2 = '' and $3 = ''))`, id, sellerID, district).Scan(&app)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	return app, true, nil
}

// SetStoreFee sets a vendor's platform fee, scoped like SetStoreLive. The fee is per shop (0069).
func (r *Repo) SetStoreFee(ctx context.Context, id, sellerID, district string, pct int) (SellerStore, bool, error) {
	if r.pool == nil {
		return SellerStore{}, false, fmt.Errorf("directory: database not configured")
	}
	s, err := scanSellerStore(r.pool.QueryRow(ctx, `
		update directory.stores s set platform_fee_pct = $3, updated_at = now()
		 where s.id = $1 and (
		       ($2 <> '' and s.seller_id = $2) or
		       ($4 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = s.seller_id and se.district_code = $4)) or
		       ($2 = '' and $4 = ''))
		 returning `+sellerStoreColumns,
		id, sellerID, pct, district))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerStore{}, false, nil
		}
		return SellerStore{}, false, err
	}
	return s, true, nil
}

func storeID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// SellerMenu is the portal-facing menu-management projection (includes seller scope + status).
type SellerMenu struct {
	VenueID      string   `json:"venueId"`
	DishID       string   `json:"dishId"`
	Name         string   `json:"name"`
	Price        int64    `json:"price"`         // rupees
	MRP          *int64   `json:"mrp,omitempty"` // rupees; list price (strike), never below price
	IsVeg        *bool    `json:"isVeg,omitempty"`
	Cuisine      string   `json:"cuisine,omitempty"`
	Rating       *float64 `json:"rating,omitempty"`
	Image        string   `json:"image,omitempty"`
	ImageAssetID string   `json:"imageAssetId,omitempty"`
	ImageKey     string   `json:"-"`
	SellerID     string   `json:"sellerId,omitempty"`
	Status       string   `json:"status"`
}

// sellerMenuSelect projects a menu row with its owner derived through the vendor store. A dining
// venue has no directory.stores row, so its dishes carry no owner (empty seller id).
const sellerMenuSelect = `
select m.venue_id, m.dish_id, m.name, m.price_paisa, m.mrp_paisa, m.is_veg, m.cuisine, m.rating,
       m.image, m.image_key, coalesce(st.seller_id,''), m.status::text
from directory.menus m
left join directory.stores st on st.id = m.venue_id`

// SellerMenus lists menus scoped by seller, district and/or venue. A district admin passes
// district (strict); a seller passes sellerID; a super admin passes neither and sees all.
func (r *Repo) SellerMenus(ctx context.Context, sellerID, district, venueID string) ([]SellerMenu, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, sellerMenuSelect+`
		where ($1 = '' or st.seller_id = $1)
		  and ($2 = '' or exists (
		         select 1 from sellers.sellers se
		          where se.seller_id = st.seller_id and se.district_code = $2))
		  and ($3 = '' or m.venue_id = $3)
		order by m.venue_id asc, m.name asc`, sellerID, district, venueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SellerMenu{}
	for rows.Next() {
		var (
			m        SellerMenu
			mrp      *int64
			isVeg    *bool
			cuisine  *string
			rating   *float64
			imageKey *string
		)
		if err := rows.Scan(&m.VenueID, &m.DishID, &m.Name, &m.Price, &mrp, &isVeg, &cuisine, &rating, &m.Image, &imageKey, &m.SellerID, &m.Status); err != nil {
			return nil, err
		}
		if imageKey != nil {
			m.ImageKey = *imageKey
			if *imageKey != "" && r.cdnBase != "" {
				m.Image = r.cdnBase + "/" + *imageKey
			}
		}
		m.Price = m.Price / 100
		m.MRP = rupeesPtr(mrp)
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
// row; all is the super-admin bypass. A district admin reaches this path with the venue's seller_id
// (resolved by the handler), so the write is still ownership-scoped.
func (r *Repo) UpsertMenu(ctx context.Context, m SellerMenu, sellerID string, all bool) (SellerMenu, bool, error) {
	if r.pool == nil {
		return SellerMenu{}, false, fmt.Errorf("directory: database not configured")
	}
	// A non-super caller may only write a dish at a venue they own (store owner, or the owner of an
	// existing menu row for a dining venue). This also closes the insert path: the ON CONFLICT guard
	// alone only protects rows that already exist.
	if !all {
		owner, found, err := r.MenuOrVenueSeller(ctx, m.VenueID, m.DishID)
		if err != nil {
			return SellerMenu{}, false, err
		}
		if !found || owner != sellerID {
			return SellerMenu{}, false, nil
		}
	}
	var (
		out      SellerMenu
		mrp      *int64
		isVeg    *bool
		cuisine  *string
		rating   *float64
		imageKey *string
	)
	err := r.pool.QueryRow(ctx, `
		insert into directory.menus (venue_id, dish_id, name, price_paisa, mrp_paisa, is_veg, cuisine, rating, image, image_key, image_asset_id, status)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'DRAFT')
		on conflict (venue_id, dish_id) do update
		   set name = excluded.name, price_paisa = excluded.price_paisa, mrp_paisa = excluded.mrp_paisa,
		       is_veg = excluded.is_veg, cuisine = excluded.cuisine, rating = excluded.rating,
		       image = excluded.image, image_key = excluded.image_key, image_asset_id = excluded.image_asset_id
		 where $12 or exists (
		         select 1 from directory.stores st
		          where st.id = directory.menus.venue_id and st.seller_id = $13)
		returning venue_id, dish_id, name, price_paisa, mrp_paisa, is_veg, cuisine, rating, image, image_key,
		          coalesce((select st.seller_id from directory.stores st where st.id = directory.menus.venue_id), ''),
		          status::text`,
		m.VenueID, m.DishID, m.Name, m.Price*100, paisaPtr(m.MRP), m.IsVeg, nullIfEmpty(m.Cuisine), m.Rating, m.Image,
		nullIfEmpty(m.ImageKey), nullIfEmpty(m.ImageAssetID), all, sellerID).
		Scan(&out.VenueID, &out.DishID, &out.Name, &out.Price, &mrp, &isVeg, &cuisine, &rating, &out.Image, &imageKey, &out.SellerID, &out.Status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerMenu{}, false, nil
		}
		return SellerMenu{}, false, err
	}
	if imageKey != nil {
		out.ImageKey = *imageKey
	}
	out.Price = out.Price / 100
	out.MRP = rupeesPtr(mrp)
	out.IsVeg = isVeg
	out.Rating = rating
	if cuisine != nil {
		out.Cuisine = *cuisine
	}
	return out, true, nil
}

// SetMenuStatus updates a dish's moderation status, scoped like UpsertMenu.
func (r *Repo) SetMenuStatus(ctx context.Context, venueID, dishID, sellerID, status string, all bool) (SellerMenu, bool, error) {
	if r.pool == nil {
		return SellerMenu{}, false, fmt.Errorf("directory: database not configured")
	}
	var (
		m       SellerMenu
		mrp     *int64
		isVeg   *bool
		cuisine *string
		rating  *float64
	)
	err := r.pool.QueryRow(ctx, `
		update directory.menus set status = $4::product_status
		 where venue_id = $1 and dish_id = $2
		   and ($5 or exists (
		          select 1 from directory.stores st
		           where st.id = directory.menus.venue_id and st.seller_id = $3))
		 returning venue_id, dish_id, name, price_paisa, mrp_paisa, is_veg, cuisine, rating, image,
		           coalesce((select st.seller_id from directory.stores st where st.id = directory.menus.venue_id), ''),
		           status::text`,
		venueID, dishID, sellerID, status, all).
		Scan(&m.VenueID, &m.DishID, &m.Name, &m.Price, &mrp, &isVeg, &cuisine, &rating, &m.Image, &m.SellerID, &m.Status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerMenu{}, false, nil
		}
		return SellerMenu{}, false, err
	}
	m.Price = m.Price / 100
	m.MRP = rupeesPtr(mrp)
	m.IsVeg = isVeg
	m.Rating = rating
	if cuisine != nil {
		m.Cuisine = *cuisine
	}
	return m, true, nil
}

// DeleteMenu removes a dish, scoped like UpsertMenu.
func (r *Repo) DeleteMenu(ctx context.Context, venueID, dishID, sellerID string, all bool) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("directory: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		delete from directory.menus
		 where venue_id = $1 and dish_id = $2
		   and ($3 or exists (
		          select 1 from directory.stores st
		           where st.id = directory.menus.venue_id and st.seller_id = $4))`,
		venueID, dishID, all, sellerID)
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

// paisaPtr converts an optional rupees value (portal/text contract) to INT8 paisa for the DB.
// nil in → nil out, so an absent MRP stays NULL (no strike) rather than a zero-price.
func paisaPtr(rupees *int64) *int64 {
	if rupees == nil {
		return nil
	}
	v := *rupees * 100
	return &v
}

// rupeesPtr converts an optional INT8 paisa column back to whole rupees for the JSON projection.
func rupeesPtr(paisa *int64) *int64 {
	if paisa == nil {
		return nil
	}
	v := *paisa / 100
	return &v
}
