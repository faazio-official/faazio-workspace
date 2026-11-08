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

// Service enforces the derived eligibility gates before upserting.
type Service struct {
	repo     *Repo
	gate     contracts.PurchaseGate
	feedback contracts.FeedbackGate
	cache    *cache.Cache
}

// NewService builds the reviews service.
func NewService(repo *Repo, gate contracts.PurchaseGate, feedback contracts.FeedbackGate, c *cache.Cache) *Service {
	return &Service{repo: repo, gate: gate, feedback: feedback, cache: c}
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
	// The store projection embeds rating/reviews_count (24 h cache); a new vendor rating must
	// refresh it right away (review.moderated → directory:store:{id}).
	s.cache.Del(ctx, cache.Store(vendorID))
	return nil
}

// SubmitProductReview upserts the signed-in user's live review for a product after re-checking the
// delivered-purchase gate. The product review list cache is purged so the next read sees it.
func (s *Service) SubmitProductReview(ctx context.Context, userID, productID string, rating int64, comment string) error {
	if rating < 1 || rating > 5 {
		return ErrInvalidRating
	}
	eligible, orderIDs, err := s.feedback.ProductPurchaseProof(ctx, userID, productID)
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
	app, err := s.repo.ProductApp(ctx, productID)
	if err != nil {
		return err
	}
	if len(comment) > 280 {
		comment = comment[:280]
	}
	if err := s.repo.UpsertProductReview(ctx, userID, name, productID, app, rating, comment, orderIDs); err != nil {
		return err
	}
	s.cache.Del(ctx, cache.ProductReviews(productID))
	return nil
}

// SubmitOrderFeedback upserts the signed-in user's post-delivery feedback for one delivered order.
func (s *Service) SubmitOrderFeedback(ctx context.Context, userID, orderID string, rating int64, comment string) error {
	if rating < 1 || rating > 5 {
		return ErrInvalidRating
	}
	eligible, err := s.feedback.OrderDeliveredProof(ctx, userID, orderID)
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
	if len(comment) > 280 {
		comment = comment[:280]
	}
	return s.repo.UpsertOrderFeedback(ctx, userID, name, orderID, rating, comment)
}

// OrderFeedback reads the caller's own feedback for an order (rating 0 = none submitted yet).
func (s *Service) OrderFeedback(ctx context.Context, userID, orderID string) (contracts.OrderFeedback, bool, error) {
	return s.repo.OrderFeedback(ctx, userID, orderID)
}
