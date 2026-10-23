package checkout

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/taxmath"
)

// coinsPerRupee is the redemption rate (100 coins = ₹1) — mirrors @data/rewards COIN_REDEEM_RATE.
// 1 coin = 1 paisa of value (100 paisa/rupee ÷ 100 coins/rupee).
const coinsPerRupee = 100

// ErrEmptyItems is returned for an order with no line items.
var ErrEmptyItems = errors.New("order has no items")

// ErrInsufficientStock is returned when an item cannot be reserved.
var ErrInsufficientStock = errors.New("insufficient stock")

// ErrAddressNotOwned is returned when the supplied addressId does not belong to the caller.
var ErrAddressNotOwned = errors.New("address does not belong to user")

// ErrInvalidCoupon is returned when a supplied coupon code fails server-side validation at
// settlement (unknown/expired/sector/state/min-order). The client must never apply a discount the
// server did not rule valid.
var ErrInvalidCoupon = errors.New("coupon not valid for this order")

// PlaceOrderRequest is the POST /orders body.
type PlaceOrderRequest struct {
	Items []struct {
		ProductID string `json:"productId"`
		Qty       int64  `json:"qty"`
	} `json:"items"`
	AddressID      string          `json:"addressId"`
	Fulfillment    string          `json:"fulfillment"`
	IdempotencyKey string          `json:"idempotencyKey"`
	Pickup         json.RawMessage `json:"pickup,omitempty"`
	Pickups        json.RawMessage `json:"pickups,omitempty"`
	PaymentMethod  string          `json:"paymentMethod,omitempty"`
	CoinsRedeemed  int64           `json:"coinsRedeemed,omitempty"`
	// CouponCode + StateCode are optional. When CouponCode is set the server re-validates it against
	// the order's app (derived from the products) and settles the discount authoritatively — the
	// client's applied discount is display-only.
	CouponCode string `json:"couponCode,omitempty"`
	StateCode  string `json:"stateCode,omitempty"`
	// Attribution carries the last-clicked sponsored slot id (closed-loop ads). Best-effort.
	Attribution struct {
		SlotID string `json:"slotId,omitempty"`
	} `json:"attribution,omitempty"`
	// DeliveryLocation is the customer's live fix at placement (delivery fulfillment only). It is
	// persisted for order-ready auto-dispatch; self-pickup orders leave it empty.
	DeliveryLocation *struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"deliveryLocation,omitempty"`
}

// Service orchestrates order placement with the idempotency lock + stock decrement.
type Service struct {
	repo      *Repo
	stock     contracts.StockWriter
	rewards   contracts.RewardsWriter
	coupons   contracts.CouponValidator
	discounts contracts.DiscountReader
	ads       contracts.AdAttributor
	cache     *cache.Cache
}

// NewService builds the checkout service. rewards/coupons/discounts/ads may be nil (rewards
// disabled / unit contexts / promo or ads not wired).
func NewService(repo *Repo, stock contracts.StockWriter, cache *cache.Cache, rewards contracts.RewardsWriter, coupons contracts.CouponValidator, discounts contracts.DiscountReader, ads contracts.AdAttributor) *Service {
	return &Service{repo: repo, stock: stock, cache: cache, rewards: rewards, coupons: coupons, discounts: discounts, ads: ads}
}

func validLatitude(v float64) bool { return v >= -90 && v <= 90 }

func validLongitude(v float64) bool { return v >= -180 && v <= 180 }

// discountedUnitPaisa applies an active festival discount (percent off) to a catalog price. A
// discount outside (0,100) is ignored, so a malformed value can never raise the price.
func discountedUnitPaisa(pricePaisa int64, discountPercent int) int64 {
	if discountPercent <= 0 || discountPercent >= 100 {
		return pricePaisa
	}
	return pricePaisa * int64(100-discountPercent) / 100
}

// CreateOrder places an order: idempotency lock → price → stock decrement → insert.
func (s *Service) CreateOrder(ctx context.Context, userID string, req PlaceOrderRequest) (Order, error) {
	if len(req.Items) == 0 {
		return Order{}, ErrEmptyItems
	}
	// Replay: a completed order for this key returns as-is (no snapshots, no decrements).
	if req.IdempotencyKey != "" {
		if orderID, found, err := s.repo.OrderByIdempotencyKey(ctx, userID, req.IdempotencyKey); err != nil {
			return Order{}, err
		} else if found {
			if existing, ok, err := s.repo.OrderByID(ctx, orderID); err != nil {
				return Order{}, err
			} else if ok {
				return existing, nil
			}
		}
		lockKey := cache.Idempotency(req.IdempotencyKey)
		if err := s.cache.AcquireLock(ctx, lockKey, 300*time.Second); err != nil {
			return Order{}, err
		}
		defer s.cache.ReleaseLock(ctx, lockKey)
	}
	// Server-side address ownership: never let a caller ship to someone else's address.
	if req.AddressID != "" {
		owned, err := s.repo.OwnsAddress(ctx, userID, req.AddressID)
		if err != nil {
			return Order{}, err
		}
		if !owned {
			return Order{}, ErrAddressNotOwned
		}
	}

	ids := make([]string, 0, len(req.Items))
	for _, it := range req.Items {
		ids = append(ids, it.ProductID)
	}
	snapshots, err := s.repo.ProductSnapshots(ctx, ids)
	if err != nil {
		return Order{}, err
	}

	// Festival discounts are part of the price the shopper sees, so the server must honor them at
	// settlement too. A failure here aborts the order rather than silently charging the base price.
	discountByID := map[string]int{}
	if s.discounts != nil {
		active, err := s.discounts.ActiveDiscounts(ctx, ids)
		if err != nil {
			return Order{}, err
		}
		for _, a := range active {
			discountByID[a.ProductID] = a.DiscountPercent
		}
	}

	// Tax config is loaded once per order: the category rates and the singleton platform rate card.
	platformRates, err := s.repo.PlatformRates(ctx)
	if err != nil {
		return Order{}, err
	}
	categoryRates, err := s.repo.TaxRates(ctx)
	if err != nil {
		return Order{}, err
	}

	lines := make([]OrderLineItem, 0, len(req.Items))
	type pricedLine struct {
		grossPaisa int64
		ratePct    int
		sellerID   string
	}
	priced := make([]pricedLine, 0, len(req.Items))
	vendorSet := map[string]struct{}{}
	sellerSet := map[string]struct{}{}
	orderApp := ""
	totalRupees := int64(0)
	for i, it := range req.Items {
		snap, ok := snapshots[it.ProductID]
		if !ok {
			return Order{}, fmt.Errorf("unknown product %s", it.ProductID)
		}
		qty := it.Qty
		if qty <= 0 || qty > 99 {
			return Order{}, errors.New("invalid quantity")
		}
		if orderApp == "" && snap.App != "" {
			orderApp = snap.App
		}
		// Money is computed in paisa (the catalog truth); the line item wire shape stays rupees.
		unitPaisa := discountedUnitPaisa(snap.PricePaisa, discountByID[it.ProductID])
		grossPaisa := qty * unitPaisa
		unit := unitPaisa / 100
		lines = append(lines, OrderLineItem{
			LineID:    fmt.Sprintf("%s-l%d", newOrderID(), i+1),
			ProductID: it.ProductID,
			Name:      snap.Name,
			Qty:       qty,
			UnitPrice: unit,
		})
		totalRupees += qty * unit
		priced = append(priced, pricedLine{
			grossPaisa: grossPaisa,
			ratePct:    taxRateFor(categoryRates, snap.App, snap.Category),
			sellerID:   snap.SellerID,
		})
		if snap.SellerID != "" {
			sellerSet[snap.SellerID] = struct{}{}
		}
		if snap.StoreID != nil && *snap.StoreID != "" {
			vendorSet[*snap.StoreID] = struct{}{}
		}
	}

	sellerIDs := make([]string, 0, len(sellerSet))
	for id := range sellerSet {
		sellerIDs = append(sellerIDs, id)
	}
	profiles, err := s.repo.SellerTaxProfiles(ctx, sellerIDs)
	if err != nil {
		return Order{}, err
	}
	taxLines := make([]taxmath.Line, 0, len(priced))
	for _, p := range priced {
		feePct := 10 // ignored by Compute (commission removed); kept for structural compatibility
		if prof, ok := profiles[p.sellerID]; ok && prof.PlatformFeePct > 0 {
			feePct = prof.PlatformFeePct
		}
		taxLines = append(taxLines, taxmath.Line{
			GrossPaisa: p.grossPaisa, GSTRatePct: p.ratePct, PlatformFeePct: feePct,
		})
	}

	// Delivery fee is dynamic: PICKUP waives it; DELIVERY distances the order's pinned stores to
	// the customer's live drop fix (Haversine) and applies the tax.delivery_fee_settings rate card
	// (base + per-extra-km). The flat platform_settings fee is the fallback when there is no fix or
	// no pinned store. The server is the money authority — the client quote is display-only.
	deliverySettings, err := s.repo.DeliveryFeeSettings(ctx)
	if err != nil {
		return Order{}, err
	}
	orderDeliveryFeePaisa := platformRates.DeliveryFeePaisa
	if req.Fulfillment == "PICKUP" {
		orderDeliveryFeePaisa = 0
	} else if req.DeliveryLocation != nil && validLatitude(req.DeliveryLocation.Latitude) && validLongitude(req.DeliveryLocation.Longitude) {
		storeIDs := make([]string, 0, len(vendorSet))
		for id := range vendorSet {
			storeIDs = append(storeIDs, id)
		}
		coords, err := s.repo.StoreCoordinates(ctx, storeIDs)
		if err != nil {
			return Order{}, err
		}
		if len(coords) > 0 {
			// Charge for the furthest store in a multi-store order (honest worst case).
			var furthestKm float64
			for _, c := range coords {
				if d := haversineKm(req.DeliveryLocation.Latitude, req.DeliveryLocation.Longitude, c.Latitude, c.Longitude); d > furthestKm {
					furthestKm = d
				}
			}
			orderDeliveryFeePaisa = feeForDistanceKm(furthestKm, deliverySettings)
		}
	}
	platformRates.DeliveryFeePaisa = orderDeliveryFeePaisa
	breakdown := taxmath.Compute(taxLines, platformRates)

	coins := req.CoinsRedeemed
	if coins < 0 {
		coins = 0
	}
	// Coupon settlement: the server re-validates any supplied code against the order's app + state
	// and settles the discount itself (the client's applied discount is display-only). This runs
	// before the stock decrement so an invalid coupon never reserves inventory.
	couponDiscountPaisa := int64(0)
	if req.CouponCode != "" {
		if s.coupons == nil {
			return Order{}, ErrInvalidCoupon
		}
		v, err := s.coupons.ValidateCoupon(ctx, req.CouponCode, orderApp, req.StateCode, totalRupees*100)
		if err != nil {
			return Order{}, err
		}
		if !v.Valid {
			return Order{}, fmt.Errorf("%w: %s", ErrInvalidCoupon, v.Reason)
		}
		couponDiscountPaisa = v.DiscountPaisa
	}

	// Reserve inventory only after all pricing/validation has passed.
	for _, it := range req.Items {
		if _, ok, err := s.stock.Decrement(ctx, it.ProductID, it.Qty); err != nil {
			return Order{}, err
		} else if !ok {
			return Order{}, ErrInsufficientStock
		}
		// Invalidate the stock read-through cache so the next GET reflects the decrement.
		s.cache.Del(ctx, cache.Stock(it.ProductID))
	}

	vendors := make([]string, 0, len(vendorSet))
	for v := range vendorSet {
		vendors = append(vendors, v)
	}
	order := Order{
		ID:             newOrderID(),
		OrderNumber:    "#" + newOrderID(),
		UserID:         userID,
		AddressID:      req.AddressID,
		PlacedAt:       time.Now().UTC().Format(time.RFC3339),
		Status:         "Processing",
		Fulfillment:    req.Fulfillment,
		VendorStoreIDs: vendors,
		LineItems:      lines,
		Pickup:         req.Pickup,
		Pickups:        req.Pickups,
	}
	if req.Fulfillment == "DELIVERY" && req.DeliveryLocation != nil &&
		validLatitude(req.DeliveryLocation.Latitude) && validLongitude(req.DeliveryLocation.Longitude) {
		lat, lng := req.DeliveryLocation.Latitude, req.DeliveryLocation.Longitude
		order.DeliveryLatitude, order.DeliveryLongitude = &lat, &lng
	}

	// Tax + invoice snapshot. Coupons are platform-funded, so they reduce what the customer pays but
	// never the seller's gross; coins are a payment tender, not a discount on the taxable value.
	order.TaxableValuePaisa = breakdown.TaxableValuePaisa
	order.ProductTaxPaisa = breakdown.ProductTaxPaisa
	order.PlatformFeePaisa = breakdown.PlatformFeePaisa
	order.PlatformGSTPaisa = breakdown.PlatformGSTPaisa
	order.DeliveryFeePaisa = breakdown.DeliveryFeePaisa
	order.TCSPaisa = breakdown.TCSPaisa
	order.TDSPaisa = breakdown.TDSPaisa

	sellerID, sellerName, sellerGSTIN := "", "", ""
	if len(profiles) == 1 {
		for _, p := range profiles {
			sellerID, sellerName, sellerGSTIN = p.SellerID, p.BusinessName, p.GSTIN
		}
	} else if len(profiles) > 1 {
		sellerName = "Faazio Marketplace (multi-seller order)"
	}
	invoice := taxmath.NewInvoice(order.ID, order.OrderNumber, userID, sellerID, sellerName, sellerGSTIN,
		breakdown, couponDiscountPaisa)
	order.InvoiceID = invoice.InvoiceID
	order.TotalChargedPaisa = invoice.TotalPaisa

	// Durable payment ledger: recorded in the same transaction as the order. The amount is derived
	// server-side from the invoice total minus coins redeemed (client never dictates the amount).
	paidPaisa := invoice.TotalPaisa - coins
	if paidPaisa < 0 {
		paidPaisa = 0
	}
	paidRupees := paidPaisa / 100
	var payments []Payment
	if req.PaymentMethod != "" || coins > 0 {
		method := req.PaymentMethod
		if method == "" {
			method = "COINS"
		}
		payments = append(payments, Payment{
			ID:            newPaymentID(),
			OrderID:       order.ID,
			UserID:        userID,
			Method:        method,
			Amount:        paidRupees,
			CoinsRedeemed: coins,
			Status:        "PAID",
		})
	}

	if err := s.repo.InsertOrder(ctx, order, lines, req.IdempotencyKey, []taxmath.Invoice{invoice}, payments...); err != nil {
		return Order{}, err
	}
	s.cache.Del(ctx, cache.Orders(userID))

	// Server-authoritative rewards: best-effort, since the order is already committed. The client
	// mirrors this optimistically and reconciles on the next GET /rewards.
	if s.rewards != nil {
		if err := s.rewards.Earn(ctx, userID, order.ID, paidRupees, coins); err != nil {
			_ = err
		} else {
			s.cache.Del(ctx, cache.Rewards(userID))
		}
	}
	// Closed-loop ads: credit the last-clicked sponsored slot. Best-effort — the order is committed,
	// so an attribution hiccup must not fail checkout.
	if s.ads != nil && req.Attribution.SlotID != "" {
		_ = s.ads.AttributeOrder(ctx, req.Attribution.SlotID)
	}
	return order, nil
}

// DeliveryFeeQuote is the server-authoritative delivery fee for one store → drop.
type DeliveryFeeQuote struct {
	DistanceKm float64 `json:"distanceKm"`
	FeePaisa   int64   `json:"feePaisa"`
}

// DeliveryFeeForStore computes the delivery fee between one store's pinned location and the
// customer's fix using the tax.delivery_fee_settings rate card. An unpinned store returns the base
// fee (honest default; road distance is unknown).
func (s *Service) DeliveryFeeForStore(ctx context.Context, storeID string, lat, lng float64) (DeliveryFeeQuote, error) {
	coords, err := s.repo.StoreCoordinates(ctx, []string{storeID})
	if err != nil {
		return DeliveryFeeQuote{}, err
	}
	settings, err := s.repo.DeliveryFeeSettings(ctx)
	if err != nil {
		return DeliveryFeeQuote{}, err
	}
	c, ok := coords[storeID]
	if !ok {
		return DeliveryFeeQuote{DistanceKm: 0, FeePaisa: settings.BaseFeePaisa}, nil
	}
	distanceKm := haversineKm(lat, lng, c.Latitude, c.Longitude)
	return DeliveryFeeQuote{DistanceKm: distanceKm, FeePaisa: feeForDistanceKm(distanceKm, settings)}, nil
}

// taxRateFor resolves a product's GST rate from tax.tax_rates, defaulting conservatively to 5%.
func taxRateFor(rates map[string]int, app, category string) int {
	if rate, ok := rates[app+"|"+strings.ToLower(category)]; ok {
		return rate
	}
	return taxmath.DefaultProductGSTRate
}

func newPaymentID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "pay-" + hex.EncodeToString(b)
}

func newOrderID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "ORD-" + hex.EncodeToString(b)
}
