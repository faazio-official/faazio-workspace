// Package catalog serves the catalog context (product detail + batch joins).
// Future service: Go + Postgres/CockroachDB (monolith-breakdown §1).
package catalog

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Repo reads catalog.products joined with inventory.stock.
type Repo struct {
	pool *db.Pool
	// cdnBase is the media CDN origin (e.g. https://img.faazio.in). When set, a product's image_key is
	// resolved to its CDN URL on read; empty means media is disabled and image_url is the source.
	cdnBase string
}

// New returns a catalog repo. cdnBase is optional (media CDN origin) and keeps existing call sites valid.
func New(pool *db.Pool, cdnBase ...string) *Repo {
	r := &Repo{pool: pool}
	if len(cdnBase) > 0 {
		r.cdnBase = strings.TrimRight(cdnBase[0], "/")
	}
	return r
}

const productSelect = `
select p.id, p.app::text, p.category, p.name, p.search_tokens,
       p.price_paisa, p.rating, p.reviews_count,
       p.emoji, p.image_url, p.image_key, p.desc_text, p.badge, p.shop, coalesce(p.store_id,''),
       p.unit, p.attributes,
       s.available, s.in_stock_qty, s.price_paisa, s.eta, s.is_prescription,
       null::float8 as distance_km
from catalog.products p
left join inventory.stock s on s.product_id = p.id`

// productListSelect is the slim projection for list/search/batch reads. It never fetches the
// TOAST-able desc_text / attributes columns (constant placeholders keep the scan shape identical),
// so search/list stop paying their bytes on the wire and in the Valkey value. Product detail
// (ByID) keeps the full productSelect.
const productListSelect = `
select p.id, p.app::text, p.category, p.name, p.search_tokens,
       p.price_paisa, p.rating, p.reviews_count,
       p.emoji, p.image_url, p.image_key, ''::text as desc_text, p.badge, null::text as shop,
       coalesce(p.store_id,''), p.unit, null::jsonb as attributes,
       s.available, s.in_stock_qty, s.price_paisa, s.eta, s.is_prescription,
       null::float8 as distance_km
from catalog.products p
left join inventory.stock s on s.product_id = p.id`

// ByID returns one product with stock.
func (r *Repo) ByID(ctx context.Context, id string) (contracts.Product, bool, error) {
	if r.pool == nil {
		return contracts.Product{}, false, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, productSelect+" where p.id = $1 and p.deleted_at is null", id)
	if err != nil {
		return contracts.Product{}, false, err
	}
	defer rows.Close()
	products, err := scanProducts(rows, r.cdnBase)
	if err != nil {
		return contracts.Product{}, false, err
	}
	if len(products) == 0 {
		return contracts.Product{}, false, nil
	}
	return products[0], true, nil
}

// Nearby returns ACTIVE products sold by live stores within radiusKm of (lat, lng), nearest first.
// The bounding box prunes with the store geo index; Haversine orders the survivors.
func (r *Repo) Nearby(ctx context.Context, app string, lat, lng, radiusKm float64, limit int) ([]contracts.Product, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	if limit <= 0 || limit > 100 {
		limit = 40
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
		select p.id, p.app::text, p.category, p.name, p.search_tokens,
		       p.price_paisa, p.rating, p.reviews_count,
		       p.emoji, p.image_url, p.image_key, ''::text as desc_text, p.badge,
		       null::text as shop, coalesce(p.store_id,''), p.unit, null::jsonb as attributes,
		       s.available, s.in_stock_qty, s.price_paisa, s.eta, s.is_prescription,
		       (6371.0088 * acos(least(1, greatest(-1,
		           sin(radians($1)) * sin(radians(d.latitude)) +
		           cos(radians($1)) * cos(radians(d.latitude)) * cos(radians(d.longitude) - radians($2))
		       )))) as distance_km
		from catalog.products p
		left join inventory.stock s on s.product_id = p.id
		join directory.stores d on d.id = p.store_id
		where p.status = 'ACTIVE'
		  and p.deleted_at is null
		  and d.is_live
		  and d.latitude is not null and d.longitude is not null
		  and d.latitude between $3 and $4
		  and d.longitude between $5 and $6
		  and ($7 = '' or p.app::text = $7)
		order by distance_km asc, p.rating desc, p.id asc
		limit $8`,
		lat, lng, lat-latDelta, lat+latDelta, lng-lngDelta, lng+lngDelta, app, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProducts(rows, r.cdnBase)
}

// StorePin returns a store's geo pin (for flushing the geo:nearby:products tiles on catalog
// writes). Zero values mean the store has no pin — nothing to flush.
func (r *Repo) StorePin(ctx context.Context, storeID string) (float64, float64, error) {
	if r.pool == nil {
		return 0, 0, fmt.Errorf("catalog: database not configured")
	}
	var lat, lng float64
	err := r.pool.QueryRow(ctx,
		`select coalesce(latitude,0), coalesce(longitude,0) from directory.stores where id = $1`,
		storeID).Scan(&lat, &lng)
	if err != nil {
		return 0, 0, err
	}
	return lat, lng, nil
}

// ByIDs returns products for the given ids (stable input order preserved by app).
func (r *Repo) ByIDs(ctx context.Context, ids []string) ([]contracts.Product, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	if len(ids) == 0 {
		return []contracts.Product{}, nil
	}
	rows, err := r.pool.Query(ctx, productListSelect+" where p.id = any($1) and p.deleted_at is null", ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	products, err := scanProducts(rows, r.cdnBase)
	if err != nil {
		return nil, err
	}
	// Re-order to the requested id sequence.
	byID := make(map[string]contracts.Product, len(products))
	for _, p := range products {
		byID[p.ID] = p
	}
	out := make([]contracts.Product, 0, len(ids))
	for _, id := range ids {
		if p, ok := byID[id]; ok {
			out = append(out, p)
		}
	}
	return out, nil
}

// ByStorePage returns a store's ACTIVE products (vendor drill-in), ordered by (rating desc, id asc)
// using keyset pagination. The query fetches limit+1 rows so the caller can tell whether another page
// exists. Only ACTIVE rows surface, so a delisted/pending product never reaches a shopper.
func (r *Repo) ByStorePage(ctx context.Context, storeID string, limit int, cursorRating float64, cursorID string, hasCursor bool) ([]contracts.Product, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, productListSelect+`
		where p.store_id = $1
		  and p.status = 'ACTIVE'
		  and p.deleted_at is null
		  and (not $2::bool or p.rating < $3::float8 or (p.rating = $3::float8 and p.id > $4))
		order by p.rating desc, p.id asc
		limit $5`, storeID, hasCursor, cursorRating, cursorID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProducts(rows, r.cdnBase)
}

// Search runs the Postgres FTS query (tsvector + pg_trgm), optionally app-scoped.
func (r *Repo) Search(ctx context.Context, q, app string, limit int) ([]contracts.Product, error) {
	return r.SearchScoped(ctx, q, app, limit)
}

// SearchScoped is Search with an explicit app filter. Only ACTIVE rows surface (mirroring Nearby and
// ByStorePage) so a PENDING_REVIEW/DRAFT/REJECTED/DELISTED listing never leaks into shopper search or
// the category drill-in before an admin approves it.
func (r *Repo) SearchScoped(ctx context.Context, q, app string, limit int) ([]contracts.Product, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	if limit <= 0 || limit > 100 {
		limit = 40
	}
	var (
		rows pgx.Rows
		err  error
	)
	if q == "" {
		rows, err = r.pool.Query(ctx, productListSelect+
			` where p.deleted_at is null and p.status = 'ACTIVE' and ($1 = '' or p.app::text = $1) order by p.rating desc, p.reviews_count desc limit $2`, app, limit)
	} else {
		// FTS only: the pg_trgm `%` fallback was dropped with products_name_trgm_idx (0005) so the
		// planner stays on products_search_vec_idx instead of seq-scanning the OR.
		rows, err = r.pool.Query(ctx, productListSelect+`
			where p.deleted_at is null
			  and p.status = 'ACTIVE'
			  and p.search_vec @@ websearch_to_tsquery('simple', catalog.immutable_unaccent($1))
			  and ($2 = '' or p.app::text = $2)
			order by ts_rank(p.search_vec, websearch_to_tsquery('simple', catalog.immutable_unaccent($1))) desc,
			         p.rating desc
			limit $3`, q, app, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProducts(rows, r.cdnBase)
}

func scanProducts(rows pgx.Rows, cdnBase string) ([]contracts.Product, error) {
	out := []contracts.Product{}
	for rows.Next() {
		var (
			p                      contracts.Product
			pricePaisa, stockPrice *int64
			rating                 float64
			reviewsCount           *int64
			attrsRaw               []byte
			badge, shop, unit      *string
			imageKey               *string
			sAvail                 *bool
			sQty                   *int64
			sETA                   *string
			sRx                    *bool
			distance               *float64
		)
		if err := rows.Scan(
			&p.ID, &p.App, &p.Category, &p.Name, &p.SearchTokens,
			&pricePaisa, &rating, &reviewsCount,
			&p.Emoji, &p.Image, &imageKey, &p.Desc, &badge, &shop, &p.StoreID, &unit, &attrsRaw,
			&sAvail, &sQty, &stockPrice, &sETA, &sRx,
			&distance,
		); err != nil {
			return nil, err
		}
		// A media-registry key wins over the legacy image_url once R2 owns the image.
		if imageKey != nil && *imageKey != "" && cdnBase != "" {
			p.Image = cdnBase + "/" + *imageKey
		}
		// rating is stored as real (float4); round to the 1-decimal domain precision so the JSON
		// number is exact (e.g. 4.9, not 4.900000095367432).
		p.Rating = math.Round(rating*10) / 10
		p.Price = toRupees(pricePaisa)
		p.ReviewsCount = reviewsCount
		p.Badge = deref(badge)
		p.Shop = deref(shop)
		p.Unit = deref(unit)
		p.DistanceKm = distance
		if len(attrsRaw) > 0 {
			_ = json.Unmarshal(attrsRaw, &p.Attributes)
		}
		if sAvail != nil {
			st := &contracts.Stock{
				ProductID:      p.ID,
				Available:      *sAvail,
				InStockQty:     derefInt(sQty),
				Price:          toRupees(stockPrice),
				IsPrescription: sRx != nil && *sRx,
			}
			if sETA != nil {
				st.ETA = *sETA
			}
			p.Stock = st
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func toRupees(paisa *int64) int64 {
	if paisa == nil {
		return 0
	}
	return *paisa / 100
}

func derefInt(v *int64) int64 {
	if v == nil {
		return 0
	}
	return *v
}

func deref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

// SellerProduct is the portal-facing product-management projection (not the mobile catalog shape).
// It carries the catalog identity plus the inventory.stock fields the seller inventory/pricing
// console needs, so one read hydrates the products + stock slices.
type SellerProduct struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	App            string `json:"app"`
	Category       string `json:"category"`
	Status         string `json:"status"`
	SellerID       string `json:"sellerId,omitempty"`
	StoreID        string `json:"storeId,omitempty"`
	Price          int64  `json:"price"` // rupees
	Description    string `json:"description,omitempty"`
	Unit           string `json:"unit,omitempty"`
	Emoji          string `json:"emoji,omitempty"`
	ImageURL       string `json:"imageUrl,omitempty"`
	ImageKey       string `json:"imageKey,omitempty"`
	IsVeg          *bool  `json:"isVeg,omitempty"`
	IsPrescription bool   `json:"isPrescription"`
	InStockQty     int64  `json:"inStockQty"`
	Available      bool   `json:"available"`
	Eta            string `json:"eta,omitempty"` // free-text ETA carried from inventory.stock
	// ReviewReason is the admin's moderation note on a REJECTED listing (empty otherwise).
	ReviewReason string `json:"reviewReason,omitempty"`
	UpdatedAt    string `json:"updatedAt"`
	// DeletedAt/DeleteReason/PurgeAt describe a listing in the trash (soft deleted). Empty on a live
	// listing. PurgeAt is the moment the row is permanently removed (7 days after the delete).
	DeletedAt    string `json:"deletedAt,omitempty"`
	DeleteReason string `json:"deleteReason,omitempty"`
	PurgeAt      string `json:"purgeAt,omitempty"`
}

// sellerProductSelect projects a product with its owner derived through the vendor store. Ownership
// lives on directory.stores only (0070 dropped catalog.products.seller_id), so every seller-scoped
// read joins the store rather than trusting a duplicated column.
const sellerProductSelect = `
select p.id, p.name, p.app::text, p.category, p.status::text, coalesce(st.seller_id,''),
       coalesce(p.store_id,''), p.price_paisa,
       coalesce(p.desc_text,''), coalesce(p.unit,''), coalesce(p.emoji,''),
       coalesce(p.image_url,''), coalesce(p.image_key,''), p.is_veg, p.is_prescription,
       coalesce(s.in_stock_qty, 0), coalesce(s.available, true), coalesce(s.eta, ''),
       coalesce(p.review_reason, ''), p.updated_at, p.deleted_at, coalesce(p.delete_reason, '')
from catalog.products p
left join inventory.stock s on s.product_id = p.id
left join directory.stores st on st.id = p.store_id`

// SellerProducts lists a seller's products (status "" = all), newest edit first.
// SellerProducts lists products scoped to a seller or a district. A district admin passes
// district (strict: the seller must belong to it); a seller passes sellerID; a super admin passes
// neither and sees every product.
func (r *Repo) SellerProducts(ctx context.Context, sellerID, district, status string) ([]SellerProduct, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, sellerProductSelect+`
		where p.deleted_at is null
		  and ($1 = '' or st.seller_id = $1)
		  and ($2 = '' or exists (
		         select 1 from sellers.sellers se
		          where se.seller_id = st.seller_id and se.district_code = $2))
		  and ($3 = '' or p.status::text = $3)
		order by p.updated_at desc`, sellerID, district, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSellerProducts(rows)
}

// SetProductStatus transitions a product's status. The write is scoped to the caller's seller_id or
// district (strict). Passing neither is the super-admin all-products case. reason is the admin's
// moderation note; it is stored only for REJECTED and cleared on any other transition.
func (r *Repo) SetProductStatus(ctx context.Context, id, sellerID, district, status, reason string) (SellerProduct, bool, error) {
	if r.pool == nil {
		return SellerProduct{}, false, fmt.Errorf("catalog: database not configured")
	}
	var (
		p         SellerProduct
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update catalog.products p set status = $4::product_status,
		       review_reason = case when $4 = 'REJECTED' then nullif($5, '') else null end
		 from directory.stores st
		 where p.id = $1 and st.id = p.store_id and p.deleted_at is null and (
		       ($2 <> '' and st.seller_id = $2) or
		       ($3 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = st.seller_id and se.district_code = $3)) or
		       ($2 = '' and $3 = ''))
		 returning p.id, p.name, p.app::text, p.category, p.status::text,
		           coalesce(st.seller_id,''), coalesce(p.store_id,''), p.price_paisa,
		           coalesce(p.review_reason,''), p.updated_at`,
		id, sellerID, district, status, reason).
		Scan(&p.ID, &p.Name, &p.App, &p.Category, &p.Status, &p.SellerID, &p.StoreID, &p.Price, &p.ReviewReason, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerProduct{}, false, nil
		}
		return SellerProduct{}, false, err
	}
	p.Price /= 100
	p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return p, true, nil
}

// ProductCreateInput is the seller create-product payload. Money is whole rupees on the wire (the
// repo converts to paisa at the insert boundary, matching ProductEdit).
type ProductCreateInput struct {
	StoreID            string
	Name               string
	Category           string
	TaxonomyCategoryID string
	Desc               string
	Price              int64 // rupees
	Unit               string
	Emoji              string
	ImageURL           string
	ImageKey           *string
	ImageAssetID       *string
	IsVeg              *bool
	IsPrescription     bool
	Attributes         map[string]any
}

// ErrInvalidTaxonomy is returned when a product's taxonomy_category_id is not an active leaf of the
// store's app brand. The handler maps it to 400 (the store itself was valid).
var ErrInvalidTaxonomy = errors.New("catalog: invalid taxonomy category")

// taxonomyLeaf resolves an active leaf category for the app and returns its name + vendor search
// query. A top-level/non-leaf id is rejected: products must attach to a drill-in leaf.
func (r *Repo) taxonomyLeaf(ctx context.Context, q pgxQuerier, app, id string) (name, query string, err error) {
	err = q.QueryRow(ctx, `
		select t.name, coalesce(t.search_query, '')
		  from taxonomy.categories t
		 where t.id = $1 and t.app::text = $2 and t.is_active
		   and not exists (
		     select 1 from taxonomy.categories c where c.parent_id = t.id and c.is_active
		   )`, id, app).Scan(&name, &query)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrInvalidTaxonomy
	}
	return name, query, err
}

// pgxQuerier is satisfied by both *pgxpool.Pool and pgx.Tx.
type pgxQuerier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

// CreateProduct inserts a new catalog product owned by the calling seller and seeds its
// inventory.stock row in one transaction. The listing opens as PENDING_REVIEW so a district admin
// activates it before buyers see it (mirrors the portal create flow).
//
// Scope: a seller (sellerID != "") may only create under a live store they own. A district admin
// (district != "") is confined to stores whose seller belongs to that district. A super admin
// (both empty) may create under any existing store. The product's app is derived from the store,
// never trusted from the client, and the stored seller_id is the store owner for admin creates.
// Returns ok=false when the store is absent or outside the caller's scope.
func (r *Repo) CreateProduct(ctx context.Context, sellerID, district string, e ProductCreateInput) (SellerProduct, bool, error) {
	if r.pool == nil {
		return SellerProduct{}, false, fmt.Errorf("catalog: database not configured")
	}
	if e.Price < 0 || e.Price > 10_000_000 {
		return SellerProduct{}, false, fmt.Errorf("catalog: invalid price")
	}
	storeID := strings.TrimSpace(e.StoreID)
	name := strings.TrimSpace(e.Name)
	category := strings.TrimSpace(e.Category)
	taxonomyID := strings.TrimSpace(e.TaxonomyCategoryID)
	if storeID == "" || name == "" || (category == "" && taxonomyID == "") {
		return SellerProduct{}, false, fmt.Errorf("catalog: store, name and category are required")
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return SellerProduct{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		app           string
		storeSeller   string
		storeLive     bool
		storeDistrict string
	)
	if err := tx.QueryRow(ctx, `
		select s.app::text, coalesce(s.seller_id, ''), s.is_live, coalesce(se.district_code, '')
		  from directory.stores s
		  left join sellers.sellers se on se.seller_id = s.seller_id
		 where s.id = $1`, storeID).
		Scan(&app, &storeSeller, &storeLive, &storeDistrict); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerProduct{}, false, nil
		}
		return SellerProduct{}, false, err
	}
	switch {
	case sellerID != "":
		if storeSeller != sellerID || !storeLive {
			return SellerProduct{}, false, nil
		}
	case district != "":
		if storeSeller == "" || storeDistrict != district {
			return SellerProduct{}, false, nil
		}
	}

	var attrJSON []byte
	if e.Attributes != nil {
		b, err := json.Marshal(e.Attributes)
		if err != nil {
			return SellerProduct{}, false, err
		}
		attrJSON = b
	}

	taxonomyName, taxonomyQuery := "", ""
	var taxonomyPtr *string
	if taxonomyID != "" {
		taxonomyName, taxonomyQuery, err = r.taxonomyLeaf(ctx, tx, app, taxonomyID)
		if err != nil {
			return SellerProduct{}, false, err
		}
		taxonomyPtr = &taxonomyID
		if category == "" {
			// The GST label was omitted: fall back to the leaf name (GST resolves to the 5% default
			// until a matching tax.tax_rates row exists). Discovery still uses the leaf query below.
			category = taxonomyName
		}
	}

	id := newProductID(app)
	pricePaisa := e.Price * 100
	// Ownership is not written here: the product's owner is its store's owner (0070).
	if _, err := tx.Exec(ctx, `
		insert into catalog.products
		  (id, app, category, name, search_tokens, price_paisa, rating, reviews_count,
		   emoji, image_url, image_key, image_asset_id, desc_text, unit, store_id, is_prescription,
		   is_veg, attributes, taxonomy_category_id, status)
		values ($1, $2::app_brand, $3, $4, $5, $6, 0, 0,
		        $7, $8, $9, $10, $11, $12, $13, $14,
		        $15, $16, $17, 'PENDING_REVIEW'::product_status)`,
		id, app, category, name,
		searchTokens(name, category, e.Desc, taxonomyName, taxonomyQuery), pricePaisa,
		strings.TrimSpace(e.Emoji), strings.TrimSpace(e.ImageURL), e.ImageKey, e.ImageAssetID,
		strings.TrimSpace(e.Desc), strings.TrimSpace(e.Unit), storeID, e.IsPrescription, e.IsVeg,
		attrJSON, taxonomyPtr); err != nil {
		return SellerProduct{}, false, err
	}
	if _, err := tx.Exec(ctx, `
		insert into inventory.stock
		  (product_id, available, in_stock_qty, price_paisa, eta, is_prescription)
		values ($1, true, 0, $2, '', $3)`,
		id, pricePaisa, e.IsPrescription); err != nil {
		return SellerProduct{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return SellerProduct{}, false, err
	}
	return r.sellerProductByID(ctx, id)
}

// searchTokens mirrors the client tokenizer: lowercase, split on non [a-z0-9], de-duplicated.
func searchTokens(parts ...string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, 24)
	for _, part := range parts {
		for _, token := range strings.FieldsFunc(strings.ToLower(part), func(r rune) bool {
			return !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'))
		}) {
			if _, ok := seen[token]; ok {
				continue
			}
			seen[token] = struct{}{}
			out = append(out, token)
		}
	}
	return out
}

// newProductID returns an app-prefixed id (e.g. "ma-1a2b3c4d5e"). Random so a seller cannot pick a
// collision-prone, client-controlled primary key.
func newProductID(app string) string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	prefix := strings.ToLower(app)
	if len(prefix) > 2 {
		prefix = prefix[:2]
	}
	return prefix + "-" + hex.EncodeToString(b)
}

// ProductEdit is the seller price/stock/image edit payload (money in whole rupees; nil = leave
// unchanged). ImageKey/ImageAssetID link a confirmed media asset; a pointer to "" clears the image.
type ProductEdit struct {
	Price              *int64
	InStockQty         *int64
	Available          *bool
	Eta                *string
	ImageKey           *string
	ImageAssetID       *string
	Name               *string
	Description        *string
	Category           *string
	TaxonomyCategoryID *string
	IsVeg              *bool
	IsPrescription     *bool
}

// UpdateProduct edits price/stock for a seller's product. The row must belong to sellerID, or
// to a seller in district (strict); passing neither is the super-admin case. Price is written to
// both catalog.products and inventory.stock so the two stay in lockstep. Returns ok=false when the
// product is absent or outside the caller's scope.
func (r *Repo) UpdateProduct(ctx context.Context, id, sellerID, district string, e ProductEdit) (SellerProduct, bool, error) {
	if r.pool == nil {
		return SellerProduct{}, false, fmt.Errorf("catalog: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return SellerProduct{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		owner         *string
		ownerDistrict string
		app           string
		curName       string
		curDesc       string
		curCategory   string
		curTaxonomy   string
	)
	if err := tx.QueryRow(ctx, `
		select st.seller_id, coalesce(se.district_code, ''), st.app::text, p.name,
		       coalesce(p.desc_text,''), p.category, coalesce(p.taxonomy_category_id, '')
		  from catalog.products p
		  join directory.stores st on st.id = p.store_id
		  left join sellers.sellers se on se.seller_id = st.seller_id
		 where p.id = $1 and p.deleted_at is null
		 for update of p`, id).Scan(&owner, &ownerDistrict, &app, &curName, &curDesc, &curCategory, &curTaxonomy); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerProduct{}, false, nil
		}
		return SellerProduct{}, false, err
	}
	switch {
	case sellerID != "":
		if owner == nil || *owner != sellerID {
			return SellerProduct{}, false, nil
		}
	case district != "":
		if owner == nil || ownerDistrict != district {
			return SellerProduct{}, false, nil
		}
	}
	if e.Name != nil || e.Description != nil || e.Category != nil || e.TaxonomyCategoryID != nil || e.IsVeg != nil || e.IsPrescription != nil {
		newName, newDesc, newCategory := curName, curDesc, curCategory
		if e.Name != nil {
			newName = strings.TrimSpace(*e.Name)
		}
		if e.Description != nil {
			newDesc = strings.TrimSpace(*e.Description)
		}
		if e.Category != nil {
			newCategory = strings.TrimSpace(*e.Category)
		}
		taxonomyID := curTaxonomy
		if e.TaxonomyCategoryID != nil {
			taxonomyID = strings.TrimSpace(*e.TaxonomyCategoryID)
		}
		taxonomyName, taxonomyQuery := "", ""
		if taxonomyID != "" {
			taxonomyName, taxonomyQuery, err = r.taxonomyLeaf(ctx, tx, app, taxonomyID)
			if err != nil {
				return SellerProduct{}, false, err
			}
			if newCategory == "" {
				newCategory = taxonomyName
			}
		}
		var taxonomyPtr *string
		if taxonomyID != "" {
			taxonomyPtr = &taxonomyID
		}
		if _, err := tx.Exec(ctx, `
			update catalog.products
			   set name            = $2,
			       desc_text       = $3,
			       category        = $4,
			       search_tokens   = $5,
			       is_veg          = coalesce($6, is_veg),
			       is_prescription = coalesce($7, is_prescription),
			       taxonomy_category_id = $8
			 where id = $1`,
			id, newName, newDesc, newCategory,
			searchTokens(newName, newCategory, newDesc, taxonomyName, taxonomyQuery),
			e.IsVeg, e.IsPrescription, taxonomyPtr); err != nil {
			return SellerProduct{}, false, err
		}
	}
	if e.Price != nil {
		if _, err := tx.Exec(ctx, `
			update catalog.products
			   set price_paisa = coalesce($2, price_paisa)
			 where id = $1`, id, mul100(e.Price)); err != nil {
			return SellerProduct{}, false, err
		}
	}
	if e.ImageKey != nil || e.ImageAssetID != nil {
		if _, err := tx.Exec(ctx, `
			update catalog.products
			   set image_key      = coalesce($2, image_key),
			       image_asset_id = coalesce($3, image_asset_id)
			 where id = $1`, id, e.ImageKey, e.ImageAssetID); err != nil {
			return SellerProduct{}, false, err
		}
	}
	if e.InStockQty != nil || e.Available != nil || e.Price != nil || e.Eta != nil || e.IsPrescription != nil {
		if _, err := tx.Exec(ctx, `
			update inventory.stock
			   set price_paisa     = coalesce($2, price_paisa),
			       in_stock_qty    = coalesce($3, in_stock_qty),
			       available       = coalesce($4, available),
			       eta             = coalesce($5, eta),
			       is_prescription = coalesce($6, is_prescription),
			       updated_at      = now()
			 where product_id = $1`, id,
			mul100(e.Price), e.InStockQty, e.Available, e.Eta, e.IsPrescription); err != nil {
			return SellerProduct{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return SellerProduct{}, false, err
	}
	return r.sellerProductByID(ctx, id)
}

// SoftDeleteProduct moves a listing to the trash (deleted_at = now()) instead of removing the row.
// Scope matches UpdateProduct: seller_id for a seller, strict district for a district admin, neither
// for a super admin. Returns ok=false when the product is absent, already deleted, or out of scope.
func (r *Repo) SoftDeleteProduct(ctx context.Context, id, sellerID, district, reason string) (SellerProduct, bool, error) {
	if r.pool == nil {
		return SellerProduct{}, false, fmt.Errorf("catalog: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update catalog.products p
		   set deleted_at = now(), delete_reason = $4
		 from directory.stores st
		 where p.id = $1 and st.id = p.store_id and p.deleted_at is null and (
		       ($2 <> '' and st.seller_id = $2) or
		       ($3 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = st.seller_id and se.district_code = $3)) or
		       ($2 = '' and $3 = ''))`,
		id, sellerID, district, strings.TrimSpace(reason))
	if err != nil {
		return SellerProduct{}, false, err
	}
	if tag.RowsAffected() == 0 {
		return SellerProduct{}, false, nil
	}
	return r.sellerProductByID(ctx, id)
}

// RestoreProduct clears a soft delete so the listing returns to its previous status/lifecycle.
// Scope is identical to SoftDeleteProduct; ok=false when the row is absent, not deleted, or out of
// scope. A listing past the 7-day window may already have been purged and will read as not found.
func (r *Repo) RestoreProduct(ctx context.Context, id, sellerID, district string) (SellerProduct, bool, error) {
	if r.pool == nil {
		return SellerProduct{}, false, fmt.Errorf("catalog: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update catalog.products p
		   set deleted_at = null, delete_reason = ''
		 from directory.stores st
		 where p.id = $1 and st.id = p.store_id and p.deleted_at is not null and (
		       ($2 <> '' and st.seller_id = $2) or
		       ($3 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = st.seller_id and se.district_code = $3)) or
		       ($2 = '' and $3 = ''))`,
		id, sellerID, district)
	if err != nil {
		return SellerProduct{}, false, err
	}
	if tag.RowsAffected() == 0 {
		return SellerProduct{}, false, nil
	}
	return r.sellerProductByID(ctx, id)
}

// DeletedProducts lists the caller-scoped trash, newest deletion first.
func (r *Repo) DeletedProducts(ctx context.Context, sellerID, district string) ([]SellerProduct, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, sellerProductSelect+`
		where p.deleted_at is not null
		  and ($1 = '' or st.seller_id = $1)
		  and ($2 = '' or exists (
		         select 1 from sellers.sellers se
		          where se.seller_id = st.seller_id and se.district_code = $2))
		order by p.deleted_at desc`, sellerID, district)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SellerProduct{}
	for rows.Next() {
		p, err := scanSellerProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// PurgeDeletedProducts permanently removes trash rows older than maxAge and their stock rows.
// Order history is preserved (it is a historical record, not a live catalogue row). Global sweep;
// callers run it with the productTrashWindow.
func (r *Repo) PurgeDeletedProducts(ctx context.Context, maxAge time.Duration) (int64, error) {
	if r.pool == nil {
		return 0, fmt.Errorf("catalog: database not configured")
	}
	cutoff := time.Now().Add(-maxAge)
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `
		delete from inventory.stock s
		 using catalog.products p
		 where s.product_id = p.id
		   and p.deleted_at is not null
		   and p.deleted_at < $1`, cutoff); err != nil {
		return 0, err
	}
	tag, err := tx.Exec(ctx, `
		delete from catalog.products
		 where deleted_at is not null and deleted_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *Repo) sellerProductByID(ctx context.Context, id string) (SellerProduct, bool, error) {
	p, err := scanSellerProduct(r.pool.QueryRow(ctx, sellerProductSelect+` where p.id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SellerProduct{}, false, nil
		}
		return SellerProduct{}, false, err
	}
	return p, true, nil
}

func mul100(v *int64) *int64 {
	if v == nil {
		return nil
	}
	r := *v * 100
	return &r
}

type sellerProductScanner interface{ Scan(dest ...any) error }

func scanSellerProduct(row sellerProductScanner) (SellerProduct, error) {
	var (
		p         SellerProduct
		updatedAt time.Time
		deletedAt *time.Time
	)
	if err := row.Scan(&p.ID, &p.Name, &p.App, &p.Category, &p.Status, &p.SellerID, &p.StoreID,
		&p.Price, &p.Description, &p.Unit, &p.Emoji, &p.ImageURL, &p.ImageKey,
		&p.IsVeg, &p.IsPrescription, &p.InStockQty, &p.Available, &p.Eta,
		&p.ReviewReason, &updatedAt, &deletedAt, &p.DeleteReason); err != nil {
		return SellerProduct{}, err
	}
	p.Price /= 100
	p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if deletedAt != nil {
		p.DeletedAt = deletedAt.UTC().Format(time.RFC3339)
		p.PurgeAt = deletedAt.Add(productTrashWindow).UTC().Format(time.RFC3339)
	}
	return p, nil
}

// productTrashWindow is how long a soft-deleted listing stays restorable before it is purged.
const productTrashWindow = 7 * 24 * time.Hour

func scanSellerProducts(rows pgx.Rows) ([]SellerProduct, error) {
	out := []SellerProduct{}
	for rows.Next() {
		p, err := scanSellerProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
