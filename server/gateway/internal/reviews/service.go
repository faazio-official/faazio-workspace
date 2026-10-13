package reviews

import (
	"context"
	"errors"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
)

// ErrNotEligible is returned when the user has no qualifying purchase from the vendor.
var ErrNotEligible = errors.New("not eligible to rate this vendor")

// ErrInvalidRating is returned for a rating outside 1..5.
var ErrInvalidRating = errors.New("rating must be between 1 and 5")

// Service enforces the derived rating-eligibility gate before upserting.
type Service struct {
	repo  *Repo
	gate  contracts.PurchaseGate
	cache *cache.Cache
}

// NewService builds the reviews service.
func NewService(repo *Repo, gate contracts.PurchaseGate, c *cache.Cache) *Service {
	return &Service{repo: repo, gate: gate, cache: c}
}

// RateVendor upserts the signed-in user's live rating for a vendor.
func (s *Service) RateVendor(ctx context.Context, userID, vendorID string, rating int64, comment string) error {
	if rating < 1 || rating > 5 {
		return ErrInvalidRating
	}
	eligible, orderIDs, err := s.gate.PurchaseProof(ctx, userID, vendorID)
	if err != nil {
		return err
	}
	if !eligible {
		return ErrNotEligible
	}
	name, err := s.repo.UserName(ctx, userID)
	if err != nil {
		return err
	}
	app, err := s.repo.VendorApp(ctx, vendorID)
	if err != nil {
		return err
	}
	if len(comment) > 280 {
		comment = comment[:280]
	}
	if err := s.repo.UpsertRating(ctx, userID, name, vendorID, app, rating, comment, orderIDs); err != nil {
		return err
	}
	s.cache.Del(ctx, cache.VendorReviews(vendorID))
	return nil
}
