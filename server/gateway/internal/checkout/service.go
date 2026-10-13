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
}

// Service orchestrates order placement with the idempotency lock + stock decrement.
type Service struct {
	repo    *Repo
	stock   contracts.StockWriter
	rewards contracts.RewardsWriter
	cache   *cache.Cache
}

// NewService builds the checkout service. rewards may be nil (rewards disabled / unit contexts).
func NewService(repo *Repo, stock contracts.StockWriter, cache *cache.Cache, rewards contracts.RewardsWriter) *Service {
	return &Service{repo: repo, stock: stock, cache: cache, rewards: rewards}
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

	lines := make([]OrderLineItem, 0, len(req.Items))
	vendorSet := map[string]struct{}{}
	for i, it := range req.Items {
		snap, ok := snapshots[it.ProductID]
		if !ok {
			return Order{}, fmt.Errorf("unknown product %s", it.ProductID)
		}
		qty := it.Qty
		if qty <= 0 || qty > 99 {
			return Order{}, errors.New("invalid quantity")
		}
		if _, ok, err := s.stock.Decrement(ctx, it.ProductID, qty); err != nil {
			return Order{}, err
		} else if !ok {
			return Order{}, ErrInsufficientStock
		}
		// Invalidate the stock read-through cache so the next GET reflects the decrement.
		s.cache.Del(ctx, cache.Stock(it.ProductID))
		lines = append(lines, OrderLineItem{
			LineID:    fmt.Sprintf("%s-l%d", newOrderID(), i+1),
			ProductID: it.ProductID,
			Name:      snap.Name,
			Qty:       qty,
			UnitPrice: snap.PricePaisa / 100,
		})
		if snap.StoreID != nil && *snap.StoreID != "" {
			vendorSet[*snap.StoreID] = struct{}{}
		}
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

	// Durable payment ledger: recorded in the same transaction as the order. The amount is derived
	// server-side from the priced lines minus the coins redeemed (client never dictates the amount).
	totalRupees := int64(0)
	for _, li := range lines {
		totalRupees += li.Qty * li.UnitPrice
	}
	coins := req.CoinsRedeemed
	if coins < 0 {
		coins = 0
	}
	paidRupees := totalRupees - coins/coinsPerRupee
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
