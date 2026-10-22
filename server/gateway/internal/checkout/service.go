package checkout

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
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

	lines := make([]OrderLineItem, 0, len(req.Items))
	vendorSet := map[string]struct{}{}
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
		unit := discountedUnitPaisa(snap.PricePaisa, discountByID[it.ProductID]) / 100
		lines = append(lines, OrderLineItem{
			LineID:    fmt.Sprintf("%s-l%d", newOrderID(), i+1),
			ProductID: it.ProductID,
			Name:      snap.Name,
			Qty:       qty,
			UnitPrice: unit,
		})
		totalRupees += qty * unit
		if snap.StoreID != nil && *snap.StoreID != "" {
			vendorSet[*snap.StoreID] = struct{}{}
		}
	}

	coins := req.CoinsRedeemed
	if coins < 0 {
		coins = 0
	}
	// Coupon settlement: the server re-validates any supplied code against the order's app + state
	// and settles the discount itself (the client's applied discount is display-only). This runs
	// before the stock decrement so an invalid coupon never reserves inventory.
	couponDiscount := int64(0)
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
		couponDiscount = v.DiscountPaisa / 100
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

	// Durable payment ledger: recorded in the same transaction as the order. The amount is derived
	// server-side from the priced lines minus the coupon discount and coins redeemed (client never
	// dictates the amount).
	paidRupees := totalRupees - couponDiscount - coins/coinsPerRupee
	if paidRupees < 0 {
		paidRupees = 0
	}
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

	if err := s.repo.InsertOrder(ctx, order, lines, req.IdempotencyKey, payments...); err != nil {
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
