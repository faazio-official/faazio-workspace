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
	"github.com/faazio/server/gateway/internal/geo"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/taxmath"
	"github.com/faazio/server/gateway/internal/pricing"
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

// ErrInsufficientCoins is returned when a redemption exceeds the caller's server-held balance.
// The payment amount is settled server-side, so the client can never mint free value by asserting
// more coins than it owns.
var ErrInsufficientCoins = errors.New("insufficient coins")

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
	repo    *Repo
	stock   contracts.StockWriter
	rewards contracts.RewardsWriter
	// rewardCoins reads the server-held balance so a redemption can never exceed it. Optional: the
	// rewards repo implements both writer and reader, so it is wired by type assertion below.
	rewardCoins contracts.RewardsReader
	coupons     contracts.CouponValidator
	discounts   contracts.DiscountReader
	ads         contracts.AdAttributor
	surge       contracts.SurgeReader
	weather     contracts.WeatherChecker
	festivals   contracts.FestivalLookup
	cache       *cache.Cache
}

// NewService builds the checkout service. rewards/coupons/discounts/ads/surge/weather/festivals may
// be nil (disabled / unit contexts); pricing then falls back to the base rate card with no surges.
func NewService(repo *Repo, stock contracts.StockWriter, cache *cache.Cache, rewards contracts.RewardsWriter, coupons contracts.CouponValidator, discounts contracts.DiscountReader, ads contracts.AdAttributor, surge contracts.SurgeReader, weather contracts.WeatherChecker, festivals contracts.FestivalLookup) *Service {
	s := &Service{
		repo: repo, stock: stock, cache: cache, rewards: rewards, coupons: coupons, discounts: discounts,
		ads: ads, surge: surge, weather: weather, festivals: festivals,
	}
	if reader, ok := rewards.(contracts.RewardsReader); ok {
		s.rewardCoins = reader
	}
	return s
}

// ValidateCoins rejects a redemption larger than the caller's server-held balance. A non-positive
// request is always valid. When no rewards reader is wired (unit contexts), validation is skipped.
func (s *Service) ValidateCoins(ctx context.Context, userID string, coins int64) error {
	if coins <= 0 || s.rewardCoins == nil {
		return nil
	}
	balance, err := s.rewardCoins.Coins(ctx, userID)
	if err != nil {
		return err
	}
	if coins > balance {
		return ErrInsufficientCoins
	}
	return nil
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

// customerDeliveryFeePaisa applies a free-delivery coupon to the customer's delivery line. A
// negative fee is clamped to zero; the rider payout is unaffected (it reuses the stored basis).
func customerDeliveryFeePaisa(feePaisa int64, freeDelivery bool) int64 {
	if freeDelivery || feePaisa < 0 {
		return 0
	}
	return feePaisa
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
	// the customer's live drop fix (Haversine), resolves the drop zone and applies the rate card
	// plus the active night/weather/festival surges. The same breakdown is stored on the order so
	// the rider payout reuses the customer-paid surges 1:1. With no live fix the base card applies.
	deliverySettings, err := s.repo.DeliveryFeeSettings(ctx)
	if err != nil {
		return Order{}, err
	}
	deliveryPrice := pricing.PriceBreakdown{}
	if req.Fulfillment != "PICKUP" {
		distanceKm := 0.0
		cellID := ""
		if req.DeliveryLocation != nil && validLatitude(req.DeliveryLocation.Latitude) && validLongitude(req.DeliveryLocation.Longitude) {
			lat, lng := req.DeliveryLocation.Latitude, req.DeliveryLocation.Longitude
			cellID = geo.GeoCell(lat, lng)
			storeIDs := make([]string, 0, len(vendorSet))
			for id := range vendorSet {
				storeIDs = append(storeIDs, id)
			}
			coords, err := s.repo.StoreCoordinates(ctx, storeIDs)
			if err != nil {
				return Order{}, err
			}
			// Charge for the furthest store in a multi-store order (honest worst case).
			for _, c := range coords {
				if d := haversineKm(lat, lng, c.Latitude, c.Longitude); d > distanceKm {
					distanceKm = d
				}
			}
		}
		deliveryPrice = s.priceDelivery(ctx, distanceKm, deliverySettings, time.Now(), cellID)
	}
	orderDeliveryFeePaisa := deliveryPrice.TotalPaisa

	coins := req.CoinsRedeemed
	if coins < 0 {
		coins = 0
	}
	// Reject a redemption the caller does not actually hold before reserving stock or settling money.
	if err := s.ValidateCoins(ctx, userID, coins); err != nil {
		return Order{}, err
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
		// A free-delivery coupon is platform-funded: the customer's delivery line is zero while the
		// rider is still paid from the stored distance/surge. Apply it before the invoice is built so
		// the settled total matches what the client displayed.
		orderDeliveryFeePaisa = customerDeliveryFeePaisa(orderDeliveryFeePaisa, v.FreeDelivery)
	}

	platformRates.DeliveryFeePaisa = orderDeliveryFeePaisa
	breakdown := taxmath.Compute(taxLines, platformRates)

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
	// Persist the customer-paid basis; payout reuses it (never re-derives surges from query params).
	order.DeliveryZoneID = deliveryPrice.ZoneID
	order.DeliveryDistanceKm = deliveryPrice.DistanceKm
	order.DeliverySurgePaisa = deliveryPrice.NightSurgePaisa + deliveryPrice.WeatherSurgePaisa + deliveryPrice.FestivalSurgePaisa
	order.DeliverySurgeReason = strings.Join(deliveryPrice.SurgeReasons, ",")
	if req.Fulfillment != "PICKUP" {
		if basis, err := json.Marshal(deliveryPrice); err == nil {
			order.DeliveryBillingBasis = basis
		}
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
			AmountPaisa:   paidPaisa,
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

// DeliveryFeeQuote is the server-authoritative delivery bill for one store → drop, including every
// surge line. It is the same shape persisted on the order at settlement.
type DeliveryFeeQuote = pricing.PriceBreakdown

// DeliveryFeeForStore computes the full delivery bill between one store's pinned location and the
// customer's fix: rate card + zone + active surges. An unpinned store returns the base card plus
// any time-based surge (distance is unknown, so the honest default is the base fee).
func (s *Service) DeliveryFeeForStore(ctx context.Context, storeID string, lat, lng float64) (DeliveryFeeQuote, error) {
	coords, err := s.repo.StoreCoordinates(ctx, []string{storeID})
	if err != nil {
		return DeliveryFeeQuote{}, err
	}
	settings, err := s.repo.DeliveryFeeSettings(ctx)
	if err != nil {
		return DeliveryFeeQuote{}, err
	}
	distanceKm := 0.0
	if c, ok := coords[storeID]; ok {
		distanceKm = haversineKm(lat, lng, c.Latitude, c.Longitude)
	}
	return s.priceDelivery(ctx, distanceKm, settings, time.Now(), geo.GeoCell(lat, lng)), nil
}

// priceDelivery resolves the active surge reasons and computes the customer bill. Surge lookup
// failures degrade to no surcharge (checkout is never blocked); night is derived from the clock.
func (s *Service) priceDelivery(ctx context.Context, distanceKm float64, settings DeliveryFeeSettings, at time.Time, cellID string) pricing.PriceBreakdown {
	rates := pricing.SurgeRates{}
	if s.surge != nil {
		if r, err := s.surge.SurgeSettings(ctx); err == nil {
			rates.NightPaisa, rates.WeatherPaisa, rates.FestivalPaisa = r.NightPaisa, r.WeatherPaisa, r.FestivalPaisa
		}
	}
	// Weather only applies when the zone is actually raining (manual overrides honoured by the checker).
	if s.weather == nil || cellID == "" {
		rates.WeatherPaisa = 0
	} else if raining, err := s.weather.IsRaining(ctx, cellID); err != nil || !raining {
		rates.WeatherPaisa = 0
	}
	// Festival only applies inside an active super-admin window; that row's amount is authoritative.
	if s.festivals == nil {
		rates.FestivalPaisa = 0
	} else if f, ok, err := s.festivals.ActiveFestival(ctx, at); err != nil || !ok {
		rates.FestivalPaisa = 0
	} else {
		rates.FestivalPaisa = f.SurgePaisa
	}
	b := pricing.ComputeDeliveryPrice(distanceKm, settings.BaseDistanceKm, settings.BaseFeePaisa,
		settings.PerExtraKmPaisa, rates, at)
	b.ZoneID = cellID
	return b
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
