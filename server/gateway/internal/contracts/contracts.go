// Package contracts declares the cross-context interfaces and JSON DTOs of the
// monolith. These shapes mirror the intended scaling-stage gRPC proto messages and the
// mobile @data/* mock twins, so extracting a context is an implementation swap.
//
// Boundary rule (docs/architecture/monolith-breakdown.md §2): contexts depend on these
// interfaces only — never on a sibling context's repo.
package contracts

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

// ------------------------------------------------------------------ blood-donor DTOs (blood schema)

// BloodDonor is a blood.donors row (own profile) or a blood.donor_directory projection.
type BloodDonor struct {
	UserID          string          `json:"userId"`
	Name            string          `json:"name"`
	BloodGroup      string          `json:"bloodGroup"`
	AgeRange        string          `json:"ageRange,omitempty"`
	WeightKg        *int64          `json:"weightKg,omitempty"`
	City            string          `json:"city"`
	WillingToTravel bool            `json:"willingToTravel"`
	DonationType    string          `json:"donationType,omitempty"`
	Notif           json.RawMessage `json:"notif,omitempty"`
	Available       bool            `json:"available"`
	Consent         bool            `json:"consent"`
}

// BloodRequest is a blood.requests row (contact/address redacted for anon).
type BloodRequest struct {
	ID             string `json:"id"`
	Hospital       string `json:"hospital"`
	City           string `json:"city"`
	State          string `json:"state"`
	CreatedBy      string `json:"createdBy,omitempty"`
	BloodGroup     string `json:"bloodGroup"`
	UnitsRequired  int64  `json:"unitsRequired"`
	PatientContext string `json:"patientContext"`
	NeededWithin   string `json:"neededWithin"`
	Verified       bool   `json:"verified"`
	Urgency        string `json:"urgency"`
	Contact        string `json:"contact,omitempty"`
	Address        string `json:"address,omitempty"`
	Remarks        string `json:"remarks,omitempty"`
	PostedAt       string `json:"postedAt"`
	PostedHoursAgo int64  `json:"postedHoursAgo"`
	ExpiresAt      string `json:"expiresAt,omitempty"`
}

// DonorMatch is a blood.match_requests row. Status is pending|accepted|declined|completed;
// RespondedAt is set when the recipient (donor) accepts/declines.
type DonorMatch struct {
	ID              string `json:"id"`
	RequesterUserID string `json:"requesterUserId"`
	DonorUserID     string `json:"donorUserId"`
	BloodGroup      string `json:"bloodGroup"`
	City            string `json:"city"`
	Status          string `json:"status"`
	CreatedAt       string `json:"createdAt"`
	RespondedAt     string `json:"respondedAt,omitempty"`
}

// Money freeze (monolith-breakdown.md §4): the DB stores INT8 paisa (₹1 = 100); every
// JSON DTO here exposes whole rupees as an integer. The repo layer is the single
// conversion boundary (paisa → rupees on read, rupees → paisa on write) — no floats.
//
// App is the sub-app brand. Frozen enum (contract-freeze §4).
type App = string

const (
	AppMart   App = "MART"
	AppFood   App = "FOOD"
	AppPharma App = "PHARMA"
)

// Stock is one inventory row (inventory.stock), JSON shaped for StockRow.
type Stock struct {
	ProductID      string `json:"productId"`
	Available      bool   `json:"available"`
	InStockQty     int64  `json:"inStockQty"`
	Price          int64  `json:"price"` // rupees
	MRP            *int64 `json:"mrp,omitempty"`
	ETA            string `json:"eta"`
	IsPrescription bool   `json:"isPrescription,omitempty"`
}

// Product is a catalog row joined with its live stock (CatalogEntry + ProductView).
type Product struct {
	ID            string         `json:"id"`
	App           App            `json:"app"`
	Category      string         `json:"category"`
	Name          string         `json:"name"`
	SearchTokens  []string       `json:"searchTokens"`
	Price         int64          `json:"price"` // rupees
	OriginalPrice *int64         `json:"originalPrice,omitempty"`
	Rating        float64        `json:"rating"`
	Emoji         string         `json:"emoji"`
	Image         string         `json:"image"`
	Desc          string         `json:"desc"`
	Badge         string         `json:"badge,omitempty"`
	Shop          string         `json:"shop,omitempty"`
	StoreID       string         `json:"storeId,omitempty"`
	ReviewsCount  *int64         `json:"reviewsCount,omitempty"`
	Unit          string         `json:"unit,omitempty"`
	Attributes    map[string]any `json:"attributes,omitempty"`
	Stock         *Stock         `json:"stock,omitempty"`
	// DistanceKm is set only by GET /products/nearby (straight-line km from the caller).
	DistanceKm *float64 `json:"distanceKm,omitempty"`
}

// Store is a directory.stores row, JSON shaped for StoreRecord.
type Store struct {
	ID           string   `json:"id"`
	App          App      `json:"app"`
	Name         string   `json:"name"`
	Categories   []string `json:"categories"`
	Rating       float64  `json:"rating"`
	ReviewsCount *int64   `json:"reviewsCount,omitempty"`
	DeliveryTime string   `json:"deliveryTime"`
	Distance     string   `json:"distance"`
	CoverImage   string   `json:"coverImage"`
	Emoji        string   `json:"emoji"`
	Desc         string   `json:"desc"`
	OfferTag     string   `json:"offerTag,omitempty"`
	IsVeg        *bool    `json:"isVeg,omitempty"`
	Address      string   `json:"address,omitempty"` // PII — auth-scoped only
	Phone        string   `json:"phone,omitempty"`   // PII
	Hours        string   `json:"hours,omitempty"`
	// StateCode scopes dispatch to riders in the store's state (2-letter code). Internal only.
	StateCode string `json:"-"`
	// Public coordinates. DistanceKm is set only by GET /stores/nearby.
	Latitude   *float64 `json:"latitude,omitempty"`
	Longitude  *float64 `json:"longitude,omitempty"`
	DistanceKm *float64 `json:"distanceKm,omitempty"`
}

// PickupPoint is a durable inventory.pickup_points row (a business location; no customer PII).
type PickupPoint struct {
	ID       string `json:"id"`
	StoreID  string `json:"storeId,omitempty"`
	Name     string `json:"name"`
	Address  string `json:"address"`
	Phone    string `json:"phone,omitempty"`
	Hours    string `json:"hours,omitempty"`
	IsActive bool   `json:"isActive"`
}

// MenuDish is one directory.menus row (a vendor menu item; price in rupees). The display fields
// (Description/Emoji/DeliveryTime) mirror the app's SpecialDish card so the Food restaurant
// screens can leave the `@data/food/menus.ts` fixture (migration 0019). OriginalPrice is the MRP
// (list price) and is present only when authored — a discount is `MRP > Price`, never synthesized.
type MenuDish struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Price         int64    `json:"price"`
	OriginalPrice *int64   `json:"mrp,omitempty"`
	IsVeg         *bool    `json:"isVeg,omitempty"`
	Cuisine       string   `json:"cuisine,omitempty"`
	Rating        *float64 `json:"rating,omitempty"`
	Image         string   `json:"image,omitempty"`
	Description   string   `json:"description,omitempty"`
	Emoji         string   `json:"emoji,omitempty"`
	DeliveryTime  string   `json:"deliveryTime,omitempty"`
}

// Venue is a directory.dining_venues row (a pure dining room / food venue). Public list reads use
// the PII-free projection; address/phone are only present on an authenticated read.
type Venue struct {
	ID         string   `json:"id"`
	App        App      `json:"app"`
	Name       string   `json:"name"`
	Rating     *float64 `json:"rating,omitempty"`
	CoverImage string   `json:"coverImage"`
	Categories []string `json:"categories"`
	Address    string   `json:"address,omitempty"` // PII — auth-scoped only
	Phone      string   `json:"phone,omitempty"`   // PII
	Hours      string   `json:"hours,omitempty"`
	Latitude   *float64 `json:"latitude,omitempty"`
	Longitude  *float64 `json:"longitude,omitempty"`
	DistanceKm *float64 `json:"distanceKm,omitempty"`
}

// Review is one product review row, JSON shaped for ReviewRow.
type Review struct {
	ID        string `json:"id"`
	ProductID string `json:"productId"`
	App       App    `json:"app"`
	User      string `json:"user"`
	Avatar    string `json:"avatar,omitempty"`
	Rating    int64  `json:"rating"`
	Comment   string `json:"comment"`
	Date      string `json:"date"`
}

// VendorReview is the public projection of reviews.vendor_reviews — no user_id/order_ids.
type VendorReview struct {
	ID       string `json:"id"`
	VendorID string `json:"vendorId"`
	App      App    `json:"app"`
	UserName string `json:"userName"`
	Rating   int64  `json:"rating"`
	Comment  string `json:"comment"`
	Date     string `json:"date"`
}

// SduiSection is one ID-only Home section (Mongo sdui_layouts).
type SduiSection struct {
	ID         string         `json:"id"`
	Title      string         `json:"title"`
	Subtitle   string         `json:"subtitle,omitempty"`
	Accent     string         `json:"accent"`
	ProductIDs []string       `json:"productIds"`
	StoreIDs   []string       `json:"storeIds,omitempty"`
	Chips      []SduiChip     `json:"chips,omitempty"`
	Banners    []SduiBanner   `json:"banners,omitempty"`
	Campaigns  []SduiCampaign `json:"campaigns,omitempty"`
}

// SduiCampaign is one editorial vendor campaign carried by a Home section (ID-only refs to a
// directory store + its catalog products). The gateway compiles it (joins store + products) into the
// anon `GET /home/campaigns(/{id})` projection — never a money-bearing row in the doc itself.
type SduiCampaign struct {
	ID         string   `json:"id"`
	StoreID    string   `json:"storeId"`
	ProductIDs []string `json:"productIds"`
	Carousel   int      `json:"carousel"`
}

// CampaignView is a compiled editorial campaign: the ID-only definition joined to its store and
// products. Display-only (no counters) — the anon merchandising read for the Home "Deals of the day"
// drill-in, distinct from the seller-scoped ads.campaigns hero control plane.
type CampaignView struct {
	ID       string    `json:"id"`
	Carousel int       `json:"carousel"`
	StoreID  string    `json:"storeId"`
	Store    *Store    `json:"store,omitempty"`
	Products []Product `json:"products"`
}

// SduiChip is a filter-feed chip (ID-only product refs).
type SduiChip struct {
	ID         string   `json:"id"`
	Label      string   `json:"label"`
	Accent     string   `json:"accent"`
	ProductIDs []string `json:"productIds"`
}

// SduiBanner is one editorial hero banner (image + copy) carried by a section. It is the only
// non-ID leaf in the SDUI doc: an image URL + display copy, never money or a joined row — so the
// Mart hero rail can be controlled from the portal without a backing SQL table (db-schema §8).
type SduiBanner struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle,omitempty"`
	Accent   string `json:"accent,omitempty"`
	ImageURL string `json:"imageUrl,omitempty"`
}

// MediaAsset is a media.assets registry row: the single SQL identity for an image whose bytes live in
// Cloudflare R2. `Key` is the immutable object key; `URL` is the resolved CDN URL (PUBLIC assets only).
// PRIVATE assets (Rx/KYC) never carry a public URL — callers request a short-lived presigned GET.
type MediaAsset struct {
	ID        string `json:"id"`
	OwnerType string `json:"ownerType,omitempty"`
	OwnerID   string `json:"ownerId,omitempty"`
	Kind      string `json:"kind"`
	Bucket    string `json:"bucket,omitempty"`
	Key       string `json:"key,omitempty"`
	URL       string `json:"url,omitempty"`
	Mime      string `json:"mime,omitempty"`
	Bytes     int64  `json:"bytes,omitempty"`
	Width     *int   `json:"width,omitempty"`
	Height    *int   `json:"height,omitempty"`
	Hash      string `json:"hash,omitempty"`
	Status    string `json:"status"`
	CreatedBy string `json:"createdBy,omitempty"`
	CreatedAt string `json:"createdAt,omitempty"`
}

// MediaReader resolves a media asset id (or its object key) to its registry row (implemented by
// internal/media). Owning contexts (catalog/directory) use it to link an uploaded asset into their
// `*_key`/`*_asset_id` columns without importing the media package (boundary rule §2).
type MediaReader interface {
	ByID(ctx context.Context, id string) (MediaAsset, bool, error)
	ByKey(ctx context.Context, key string) (MediaAsset, bool, error)
}

// ProductReader reads catalog products (implemented by internal/catalog).
type ProductReader interface {
	ByID(ctx context.Context, id string) (Product, bool, error)
	ByIDs(ctx context.Context, ids []string) ([]Product, error)
	Search(ctx context.Context, q, app string, limit int) ([]Product, error)
}

// StoreReader reads directory stores (implemented by internal/directory).
type StoreReader interface {
	ByApp(ctx context.Context, app string) ([]Store, error)
	ByID(ctx context.Context, id string) (Store, bool, error)
	ByIDs(ctx context.Context, ids []string) ([]Store, error)
}

// LayoutSource reads ID-only SDUI layouts (implemented by internal/reco). Home returns the
// layout version alongside its sections so the gateway can emit a stable ETag per publish.
type LayoutSource interface {
	Home(ctx context.Context) ([]SduiSection, int64, error)
}

// LayoutWriter persists an ID-only SDUI layout (implemented by internal/reco, Mongo sdui_layouts).
// SaveHome replaces the Home sections and returns the new version (a monotonic bump), which the
// caller uses to purge the compiled-feed cache so the next read recompiles and the ETag changes.
type LayoutWriter interface {
	SaveHome(ctx context.Context, sections []SduiSection) (int64, error)
}

// Querier is the row-returning handle shared by the Postgres pool and a pgx.Tx, so a context can
// run a write (e.g. a stock decrement) inside the same DB transaction as a second context's insert.
// `*db.Pool` (pgxpool.Pool) and `pgx.Tx` both implement it.
type Querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// StockWriter atomically decrements inventory.stock (implemented by internal/cartstock). It runs on
// the caller-provided Querier so checkout can move stock in the same transaction as the order
// insert — a failed insert rolls the decrement back instead of silently draining inventory.
// Future service: Go + DynamoDB (monolith-breakdown §1).
type StockWriter interface {
	Decrement(ctx context.Context, q Querier, productID string, qty int64) (remaining int64, ok bool, err error)
}

// PurchaseGate derives rating eligibility from order history (implemented by
// internal/checkout, db-schema §7.7). Never a stored flag.
type PurchaseGate interface {
	PurchaseProof(ctx context.Context, userID, vendorID string) (eligible bool, orderIDs []string, err error)
}

// RewardsWriter applies an order's reward effect during checkout (implemented by internal/rewards).
// The server is the money-adjacent authority: the client is optimistic and reconciles via
// GET /rewards. chosen over a public reconcile endpoint so coins can never be forged.
type RewardsWriter interface {
	Earn(ctx context.Context, userID, orderID string, paidRupees, coinsRedeemed int64) error
}

// RewardsReader exposes the caller's coin balance so checkout can reject a redemption larger than
// the balance the server actually holds (implemented by internal/rewards). The ledger writer clamps
// the same value, but the payment amount must be settled against the clamped figure too.
type RewardsReader interface {
	Coins(ctx context.Context, userID string) (int64, error)
}

// CouponValidation is the server-authoritative verdict on a coupon code for a given cart. Money is
// paisa internally; the HTTP layer projects whole rupees. Reason is a machine code when invalid
// (not_found|inactive|expired|wrong_sector|wrong_state|min_order) and empty when valid.
type CouponValidation struct {
	Valid            bool
	Reason           string
	Code             string
	ValuePercent     int
	MaxDiscountPaisa int64
	MinOrderPaisa    int64
	DiscountPaisa    int64 // server-computed: min(subtotal*valuePercent, maxDiscount)
	FreeDelivery     bool
}

// CouponValidator validates a coupon code against an app/sector, state and cart subtotal
// (implemented by internal/promo). Checkout is the money authority: it calls this both for the
// public preview endpoint and again at order settlement — the client never dictates the discount.
type CouponValidator interface {
	ValidateCoupon(ctx context.Context, code, app, stateCode string, subtotalPaisa int64) (CouponValidation, error)
}

// ActiveDiscount is the best live festival discount for one product — a percent off the catalog
// price, derived from a LIVE campaign + APPROVED opt-in capped by sector policy (db-schema §7).
type ActiveDiscount struct {
	ProductID       string `json:"productId"`
	CampaignID      string `json:"campaignId"`
	DiscountPercent int    `json:"discountPercent"`
}

// DiscountReader returns the active festival discount per requested product (implemented by
// internal/promo). Checkout calls it to re-price authoritatively, so a shopper is charged the same
// festival price the app overlays — the client never dictates the discounted amount.
type DiscountReader interface {
	ActiveDiscounts(ctx context.Context, productIDs []string) ([]ActiveDiscount, error)
}

// AdAttributor records a closed-loop ad conversion (implemented by internal/ads). Checkout calls it
// best-effort after an order commits, crediting the last-clicked sponsored slot.
type AdAttributor interface {
	AttributeOrder(ctx context.Context, slotID string) error
}

// AuditEntry is one admins.audit_logs row (who did what to which entity). Before/After are opaque
// JSON snapshots, guarded ≤ 8 KB at the DB.
type AuditEntry struct {
	ActorID   string
	ActorRole string
	Action    string
	Entity    string
	EntityID  string
	Before    json.RawMessage
	After     json.RawMessage
}

// AuditWriter records a partner-console mutation (implemented by internal/admins). Every mutation
// in a partner context should write one row; the caller never trusts a client-supplied actor.
type AuditWriter interface {
	Audit(ctx context.Context, e AuditEntry) error
}

// Notifier enqueues a durable user-facing notification (implemented by internal/notifications).
// Contexts that trigger a customer event (pharma Rx READY, order status) call this; delivery
// (push/polling) is drained by the notifications context. data must stay PII-free.
type Notifier interface {
	Enqueue(ctx context.Context, userID, kind, title, body string, data map[string]any) error
	// EnqueueSeller fans a notification out to every active portal login that owns one of the
	// given stores. Used for the seller app's new-order ping (no customer PII in data).
	EnqueueSeller(ctx context.Context, storeIDs []string, kind, title, body string, data map[string]any) error
}

// Drainer runs one synchronous notification-outbox drain (implemented by notifications.Worker). The
// admin endpoint uses it as a manual trigger when no background worker is deployed.
type Drainer interface {
	DrainOnce(ctx context.Context) error
}

// Sweeper runs one media GC pass — deletes orphaned DRAFT assets (R2 object + registry row) past the
// draft TTL (implemented by media.Sweeper). The admin endpoint uses it as a manual trigger when no
// background worker is deployed; it returns the number of assets reclaimed.
type Sweeper interface {
	SweepOnce(ctx context.Context) (int, error)
}

// AuditPurger runs one audit-log retention pass (implemented by internal/admins.Purger). The
// SUPER_ADMIN endpoint uses it as a manual trigger; main.go schedules the daily 00:00 IST pass via
// Purger.Run. It returns the number of rows purged. 0037 owns the batched DELETE.
type AuditPurger interface {
	PurgeOnce(ctx context.Context, actorID, actorRole string) (int, error)
}

// HomeSection is a compiled Home section (SduiSection + joined products/stores).
type HomeSection struct {
	SduiSection
	Products []Product `json:"products"`
	// Stores are the rows joined from the section's StoreIDs (dining rails). Empty for
	// product-only sections.
	Stores []Store `json:"stores,omitempty"`
}

// SellerSettlementProfile is the server-owned split input for one seller.
type SellerSettlementProfile struct {
	PlatformFeePct  int
	LinkedAccountID string
}

// SellerProfileReader resolves a seller's platform fee + Route account (implemented by sellers.Repo).
// The settlement context uses it to split a capture server-side; the client never supplies the fee.
type SellerProfileReader interface {
	SettlementProfile(ctx context.Context, sellerID string) (SellerSettlementProfile, error)
}

// OrderOwnership reports whether a checkout order belongs to a user (implemented by checkout.Repo).
// The delivery context uses it to refuse cross-user delivery ratings.
type OrderOwnership interface {
	OrderOwnedBy(ctx context.Context, orderID, userID string) (bool, error)
}

// DeliveryDispatchRequest is the internal order-ready → dispatch call. Checkout composes the
// customer drop (PII, server-side only) and the store pickup, then delivery owns candidate
// selection, assignment and the rider ping. Never logged.
type DeliveryDispatchRequest struct {
	CustomerOrderID   string
	StoreID           string
	StoreName         string
	StoreAddress      string
	StoreLatitude     float64
	StoreLongitude    float64
	StateCode         string
	CustomerName      string
	CustomerPhone     string
	CustomerAddress   string
	DropLatitude      float64
	DropLongitude     float64
	RequireOTP        bool
	PayoutAmountPaisa int64
}

// DeliveryDispatcher assigns a ready order to the best rider. Implemented by delivery.Handler.
// A nil error with assigned=false means no eligible rider; checkout must not fail the order.
type DeliveryDispatcher interface {
	DispatchOrder(ctx context.Context, req DeliveryDispatchRequest) (assigned bool, err error)
}

// SurgeRates is the server-owned surcharge card in paisa (delivery.payout_settings). Checkout reads
// it through SurgeReader so the customer bill and rider payout use one authoritative card without
// importing the delivery context.
type SurgeRates struct {
	NightPaisa    int64
	WeatherPaisa  int64
	FestivalPaisa int64
}

// SurgeReader exposes the surcharge card (implemented by delivery.Handler).
type SurgeReader interface {
	SurgeSettings(ctx context.Context) (SurgeRates, error)
}

// WeatherChecker resolves whether a zone is raining now (implemented by weather.Checker). A failure
// must degrade to "not raining" at the caller — checkout is never blocked by weather.
type WeatherChecker interface {
	IsRaining(ctx context.Context, cellID string) (bool, error)
}

// Festival is the active super-admin festival window projection.
type Festival struct {
	ID         string
	Name       string
	SurgePaisa int64
}

// FestivalLookup resolves the active festival for a day (implemented by festival.Repo).
type FestivalLookup interface {
	ActiveFestival(ctx context.Context, day time.Time) (Festival, bool, error)
}
