// Package contracts declares the cross-context interfaces and JSON DTOs of the
// monolith. These shapes mirror the intended Future Prod gRPC proto messages and the
// mobile @data/* mock twins, so extracting a context is an implementation swap.
//
// Boundary rule (docs/architecture/monolith-breakdown.md §2): contexts depend on these
// interfaces only — never on a sibling context's repo.
package contracts

import "context"

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
	ReviewsCount  *int64         `json:"reviewsCount,omitempty"`
	Unit          string         `json:"unit,omitempty"`
	Attributes    map[string]any `json:"attributes,omitempty"`
	Stock         *Stock         `json:"stock,omitempty"`
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

// MenuDish is one directory.menus row (a vendor menu item; price in rupees).
type MenuDish struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Price   int64    `json:"price"`
	IsVeg   *bool    `json:"isVeg,omitempty"`
	Cuisine string   `json:"cuisine,omitempty"`
	Rating  *float64 `json:"rating,omitempty"`
	Image   string   `json:"image,omitempty"`
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
	ID         string     `json:"id"`
	Title      string     `json:"title"`
	Subtitle   string     `json:"subtitle,omitempty"`
	Accent     string     `json:"accent"`
	ProductIDs []string   `json:"productIds"`
	StoreIDs   []string   `json:"storeIds,omitempty"`
	Chips      []SduiChip `json:"chips,omitempty"`
}

// SduiChip is a filter-feed chip (ID-only product refs).
type SduiChip struct {
	ID         string   `json:"id"`
	Label      string   `json:"label"`
	Accent     string   `json:"accent"`
	ProductIDs []string `json:"productIds"`
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
}

// LayoutSource reads ID-only SDUI layouts (implemented by internal/reco). Home returns the
// layout version alongside its sections so the gateway can emit a stable ETag per publish.
type LayoutSource interface {
	Home(ctx context.Context) ([]SduiSection, int64, error)
}

// StockWriter atomically decrements inventory.stock (implemented by internal/cartstock).
// Future service: Go + DynamoDB (monolith-breakdown §1).
type StockWriter interface {
	Decrement(ctx context.Context, productID string, qty int64) (remaining int64, ok bool, err error)
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

// HomeSection is a compiled Home section (SduiSection + joined products).
type HomeSection struct {
	SduiSection
	Products []Product `json:"products"`
}
