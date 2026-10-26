// Package catalog serves the catalog context (product detail + batch joins).
// Future service: Go + Postgres/CockroachDB (monolith-breakdown §1).
package catalog

import (
	"context"
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
       p.emoji, p.image_url, p.image_key, p.desc_text, p.badge, p.shop, p.unit, p.attributes,
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
       p.emoji, p.image_url, p.image_key, ''::text as desc_text, p.badge, null::text as shop, p.unit, null::jsonb as attributes,
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
		       null::text as shop, p.unit, null::jsonb as attributes,
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
			&p.Emoji, &p.Image, &imageKey, &p.Desc, &badge, &shop, &unit, &attrsRaw,
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
type SellerProduct struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	App       string `json:"app"`
	Category  string `json:"category"`
	Status    string `json:"status"`
	SellerID  string `json:"sellerId,omitempty"`
	StoreID   string `json:"storeId,omitempty"`
	Price     int64  `json:"price"` // rupees
	UpdatedAt string `json:"updatedAt"`
}

const sellerProductSelect = `
select p.id, p.name, p.app::text, p.category, p.status::text, coalesce(p.seller_id,''),
       coalesce(p.store_id,''), p.price_paisa, p.updated_at
from catalog.products p`

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

// ProductEdit is the seller price/stock/image edit payload (money in whole rupees; nil = leave
// unchanged). ImageKey/ImageAssetID link a confirmed media asset; a pointer to "" clears the image.
type ProductEdit struct {
	Price        *int64
	MRP          *int64
	InStockQty   *int64
	Available    *bool
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
	if e.InStockQty != nil || e.Available != nil || e.Price != nil || e.MRP != nil {
		if _, err := tx.Exec(ctx, `
			update inventory.stock
			   set price_paisa  = coalesce($2, price_paisa),
			       mrp_paisa    = coalesce($3, mrp_paisa),
			       in_stock_qty = coalesce($4, in_stock_qty),
			       available    = coalesce($5, available),
			       updated_at   = now()
			 where product_id = $1`, id,
			mul100(e.Price), mul100(e.MRP), e.InStockQty, e.Available); err != nil {
			return SellerProduct{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return SellerProduct{}, false, err
	}
	return r.sellerProductByID(ctx, id)
}

func (r *Repo) sellerProductByID(ctx context.Context, id string) (SellerProduct, bool, error) {
	var (
		p         SellerProduct
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, sellerProductSelect+` where p.id = $1`, id).
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

func mul100(v *int64) *int64 {
	if v == nil {
		return nil
	}
	r := *v * 100
	return &r
}

func scanSellerProducts(rows pgx.Rows) ([]SellerProduct, error) {
	out := []SellerProduct{}
	for rows.Next() {
		var (
			p         SellerProduct
			updatedAt time.Time
		)
		if err := rows.Scan(&p.ID, &p.Name, &p.App, &p.Category, &p.Status, &p.SellerID, &p.StoreID, &p.Price, &updatedAt); err != nil {
			return nil, err
		}
		p.Price /= 100
		p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, p)
	}
	return out, rows.Err()
}
