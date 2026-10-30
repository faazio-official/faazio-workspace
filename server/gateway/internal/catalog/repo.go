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
       p.price_paisa, p.mrp_paisa, p.rating, p.reviews_count,
       p.emoji, p.image_url, p.image_key, p.desc_text, p.badge, p.shop, coalesce(p.store_id,''),
       p.unit, p.attributes,
       s.available, s.in_stock_qty, s.price_paisa, s.mrp_paisa, s.eta, s.is_prescription,
       null::float8 as distance_km
from catalog.products p
left join inventory.stock s on s.product_id = p.id`

// productListSelect is the slim projection for list/search/batch reads. It never fetches the
// TOAST-able desc_text / attributes columns (constant placeholders keep the scan shape identical),
// so search/list stop paying their bytes on the wire and in the Valkey value. Product detail
// (ByID) keeps the full productSelect.
const productListSelect = `
select p.id, p.app::text, p.category, p.name, p.search_tokens,
       p.price_paisa, p.mrp_paisa, p.rating, p.reviews_count,
       p.emoji, p.image_url, p.image_key, ''::text as desc_text, p.badge, null::text as shop,
       coalesce(p.store_id,''), p.unit, null::jsonb as attributes,
       s.available, s.in_stock_qty, s.price_paisa, s.mrp_paisa, s.eta, s.is_prescription,
       null::float8 as distance_km
from catalog.products p
left join inventory.stock s on s.product_id = p.id`

// ByID returns one product with stock.
func (r *Repo) ByID(ctx context.Context, id string) (contracts.Product, bool, error) {
	if r.pool == nil {
		return contracts.Product{}, false, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, productSelect+" where p.id = $1", id)
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
		       p.price_paisa, p.mrp_paisa, p.rating, p.reviews_count,
		       p.emoji, p.image_url, p.image_key, ''::text as desc_text, p.badge,
		       null::text as shop, coalesce(p.store_id,''), p.unit, null::jsonb as attributes,
		       s.available, s.in_stock_qty, s.price_paisa, s.mrp_paisa, s.eta, s.is_prescription,
		       (6371.0088 * acos(least(1, greatest(-1,
		           sin(radians($1)) * sin(radians(d.latitude)) +
		           cos(radians($1)) * cos(radians(d.latitude)) * cos(radians(d.longitude) - radians($2))
		       )))) as distance_km
		from catalog.products p
		left join inventory.stock s on s.product_id = p.id
		join directory.stores d on d.id = p.store_id
		where p.status = 'ACTIVE'
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
	rows, err := r.pool.Query(ctx, productListSelect+" where p.id = any($1)", ids)
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

// SearchScoped is Search with an explicit app filter.
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
			` where ($1 = '' or p.app::text = $1) order by p.rating desc, p.reviews_count desc limit $2`, app, limit)
	} else {
		// FTS only: the pg_trgm `%` fallback was dropped with products_name_trgm_idx (0005) so the
		// planner stays on products_search_vec_idx instead of seq-scanning the OR.
		rows, err = r.pool.Query(ctx, productListSelect+`
			where p.search_vec @@ websearch_to_tsquery('simple', catalog.immutable_unaccent($1))
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
			p                                contracts.Product
			pricePaisa, mrpPaisa, stockPrice *int64
			rating                           float64
			reviewsCount                     *int64
			attrsRaw                         []byte
			badge, shop, unit                *string
			imageKey                         *string
			sAvail                           *bool
			sQty, sMRP                       *int64
			sETA                             *string
			sRx                              *bool
			distance                         *float64
		)
		if err := rows.Scan(
			&p.ID, &p.App, &p.Category, &p.Name, &p.SearchTokens,
			&pricePaisa, &mrpPaisa, &rating, &reviewsCount,
			&p.Emoji, &p.Image, &imageKey, &p.Desc, &badge, &shop, &p.StoreID, &unit, &attrsRaw,
			&sAvail, &sQty, &stockPrice, &sMRP, &sETA, &sRx,
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
		p.OriginalPrice = moneyPtr(mrpPaisa)
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
				MRP:            moneyPtr(sMRP),
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

func moneyPtr(paisa *int64) *int64 {
	if paisa == nil {
		return nil
	}
	r := *paisa / 100
	return &r
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
	Price          int64  `json:"price"`         // rupees
	MRP            *int64 `json:"mrp,omitempty"` // rupees
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
	UpdatedAt      string `json:"updatedAt"`
}

const sellerProductSelect = `
select p.id, p.name, p.app::text, p.category, p.status::text, coalesce(p.seller_id,''),
       coalesce(p.store_id,''), p.price_paisa, p.mrp_paisa,
       coalesce(p.desc_text,''), coalesce(p.unit,''), coalesce(p.emoji,''),
       coalesce(p.image_url,''), coalesce(p.image_key,''), p.is_veg, p.is_prescription,
       coalesce(s.in_stock_qty, 0), coalesce(s.available, true), coalesce(s.eta, ''),
       p.updated_at
from catalog.products p
left join inventory.stock s on s.product_id = p.id`

// SellerProducts lists a seller's products (status "" = all), newest edit first.
// SellerProducts lists products scoped to a seller or a district. A district admin passes
// district (strict: the seller must belong to it); a seller passes sellerID; a super admin passes
// neither and sees every product.
func (r *Repo) SellerProducts(ctx context.Context, sellerID, district, status string) ([]SellerProduct, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, sellerProductSelect+`
		where ($1 = '' or p.seller_id = $1)
		  and ($2 = '' or exists (
		         select 1 from sellers.sellers se
		          where se.seller_id = p.seller_id and se.district_code = $2))
		  and ($3 = '' or p.status::text = $3)
		order by p.updated_at desc`, sellerID, district, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSellerProducts(rows)
}

// SetProductStatus transitions a product's status. The write is scoped to the caller's seller_id or
// district (strict). Passing neither is the super-admin all-products case.
func (r *Repo) SetProductStatus(ctx context.Context, id, sellerID, district, status string) (SellerProduct, bool, error) {
	if r.pool == nil {
		return SellerProduct{}, false, fmt.Errorf("catalog: database not configured")
	}
	var (
		p         SellerProduct
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update catalog.products p set status = $4::product_status
		 where p.id = $1 and (
		       ($2 <> '' and p.seller_id = $2) or
		       ($3 <> '' and exists (
		          select 1 from sellers.sellers se
		           where se.seller_id = p.seller_id and se.district_code = $3)) or
		       ($2 = '' and $3 = ''))
		 returning p.id, p.name, p.app::text, p.category, p.status::text,
		           coalesce(p.seller_id,''), coalesce(p.store_id,''), p.price_paisa, p.updated_at`,
		id, sellerID, district, status).
		Scan(&p.ID, &p.Name, &p.App, &p.Category, &p.Status, &p.SellerID, &p.StoreID, &p.Price, &updatedAt)
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
	StoreID        string
	Name           string
	Category       string
	Desc           string
	Price          int64  // rupees
	MRP            *int64 // rupees
	Unit           string
	Emoji          string
	ImageURL       string
	ImageKey       *string
	ImageAssetID   *string
	IsVeg          *bool
	IsPrescription bool
	Attributes     map[string]any
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
	if e.MRP != nil && (*e.MRP < 0 || *e.MRP > 10_000_000) {
		return SellerProduct{}, false, fmt.Errorf("catalog: invalid mrp")
	}
	if e.MRP != nil && *e.MRP < e.Price {
		return SellerProduct{}, false, fmt.Errorf("catalog: mrp below price")
	}
	storeID := strings.TrimSpace(e.StoreID)
	name := strings.TrimSpace(e.Name)
	category := strings.TrimSpace(e.Category)
	if storeID == "" || name == "" || category == "" {
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

	productSeller := sellerID
	if productSeller == "" {
		productSeller = storeSeller
	}
	var sellerArg *string
	if productSeller != "" {
		sellerArg = &productSeller
	}

	var attrJSON []byte
	if e.Attributes != nil {
		b, err := json.Marshal(e.Attributes)
		if err != nil {
			return SellerProduct{}, false, err
		}
		attrJSON = b
	}

	id := newProductID(app)
	pricePaisa := e.Price * 100
	var mrpPaisa *int64
	if e.MRP != nil {
		v := *e.MRP * 100
		mrpPaisa = &v
	}
	if _, err := tx.Exec(ctx, `
		insert into catalog.products
		  (id, app, category, name, search_tokens, price_paisa, mrp_paisa, rating, reviews_count,
		   emoji, image_url, image_key, image_asset_id, desc_text, unit, store_id, is_prescription,
		   is_veg, attributes, seller_id, status)
		values ($1, $2::app_brand, $3, $4, $5, $6, $7, 0, 0,
		        $8, $9, $10, $11, $12, $13, $14, $15,
		        $16, $17, $18, 'PENDING_REVIEW'::product_status)`,
		id, app, category, name, searchTokens(name, category, e.Desc), pricePaisa, mrpPaisa,
		strings.TrimSpace(e.Emoji), strings.TrimSpace(e.ImageURL), e.ImageKey, e.ImageAssetID,
		strings.TrimSpace(e.Desc), strings.TrimSpace(e.Unit), storeID, e.IsPrescription, e.IsVeg,
		attrJSON, sellerArg); err != nil {
		return SellerProduct{}, false, err
	}
	if _, err := tx.Exec(ctx, `
		insert into inventory.stock
		  (product_id, available, in_stock_qty, price_paisa, mrp_paisa, eta, is_prescription)
		values ($1, true, 0, $2, $3, '', $4)`,
		id, pricePaisa, mrpPaisa, e.IsPrescription); err != nil {
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
	Price        *int64
	MRP          *int64
	InStockQty   *int64
	Available    *bool
	Eta          *string
	ImageKey     *string
	ImageAssetID *string
}

// UpdateProduct edits price/MRP/stock for a seller's product. The row must belong to sellerID, or
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
	)
	if err := tx.QueryRow(ctx, `
		select p.seller_id, coalesce(se.district_code, '')
		  from catalog.products p
		  left join sellers.sellers se on se.seller_id = p.seller_id
		 where p.id = $1
		 for update of p`, id).Scan(&owner, &ownerDistrict); err != nil {
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
	if e.Price != nil || e.MRP != nil {
		if _, err := tx.Exec(ctx, `
			update catalog.products
			   set price_paisa = coalesce($2, price_paisa),
			       mrp_paisa   = coalesce($3, mrp_paisa)
			 where id = $1`, id,
			mul100(e.Price), mul100(e.MRP)); err != nil {
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
	if e.InStockQty != nil || e.Available != nil || e.Price != nil || e.MRP != nil || e.Eta != nil {
		if _, err := tx.Exec(ctx, `
			update inventory.stock
			   set price_paisa  = coalesce($2, price_paisa),
			       mrp_paisa    = coalesce($3, mrp_paisa),
			       in_stock_qty = coalesce($4, in_stock_qty),
			       available    = coalesce($5, available),
			       eta          = coalesce($6, eta),
			       updated_at   = now()
			 where product_id = $1`, id,
			mul100(e.Price), mul100(e.MRP), e.InStockQty, e.Available, e.Eta); err != nil {
			return SellerProduct{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return SellerProduct{}, false, err
	}
	return r.sellerProductByID(ctx, id)
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
		mrpPaisa  *int64
		updatedAt time.Time
	)
	if err := row.Scan(&p.ID, &p.Name, &p.App, &p.Category, &p.Status, &p.SellerID, &p.StoreID,
		&p.Price, &mrpPaisa, &p.Description, &p.Unit, &p.Emoji, &p.ImageURL, &p.ImageKey,
		&p.IsVeg, &p.IsPrescription, &p.InStockQty, &p.Available, &p.Eta, &updatedAt); err != nil {
		return SellerProduct{}, err
	}
	p.Price /= 100
	p.MRP = moneyPtr(mrpPaisa)
	p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return p, nil
}

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
