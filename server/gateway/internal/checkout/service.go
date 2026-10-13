package checkout

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
)

// ErrEmptyItems is returned for an order with no line items.
var ErrEmptyItems = errors.New("order has no items")

// ErrInsufficientStock is returned when an item cannot be reserved.
var ErrInsufficientStock = errors.New("insufficient stock")

// PlaceOrderRequest is the POST /orders body.
type PlaceOrderRequest struct {
	Items []struct {
		ProductID string `json:"productId"`
		Qty       int64  `json:"qty"`
	} `json:"items"`
	AddressID      string `json:"addressId"`
	Fulfillment    string `json:"fulfillment"`
	IdempotencyKey string `json:"idempotencyKey"`
}

// Service orchestrates order placement with the idempotency lock + stock decrement.
type Service struct {
	repo  *Repo
	stock contracts.StockWriter
	cache *cache.Cache
}

// NewService builds the checkout service.
func NewService(repo *Repo, stock contracts.StockWriter, c *cache.Cache) *Service {
	return &Service{repo: repo, stock: stock, cache: c}
}

// CreateOrder places an order: idempotency lock → price → stock decrement → insert.
func (s *Service) CreateOrder(ctx context.Context, userID string, req PlaceOrderRequest) (Order, error) {
	if len(req.Items) == 0 {
		return Order{}, ErrEmptyItems
	}
	if req.IdempotencyKey != "" {
		lockKey := cache.Idempotency(req.IdempotencyKey)
		if err := s.cache.AcquireLock(ctx, lockKey, 300*time.Second); err != nil {
			return Order{}, err
		}
		defer s.cache.ReleaseLock(ctx, lockKey)
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
	}
	if err := s.repo.InsertOrder(ctx, order, lines); err != nil {
		return Order{}, err
	}
	s.cache.Del(ctx, cache.Orders(userID))
	return order, nil
}

func newOrderID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "ORD-" + hex.EncodeToString(b)
}
