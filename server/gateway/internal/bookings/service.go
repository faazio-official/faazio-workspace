package bookings

import (
	"context"
	"errors"
	"fmt"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
)

// Service orchestrates the booking money flow: hold → (Razorpay order) → accept/capture or
// reject/refund. The repo owns the DB; the gateway owns Razorpay; this type is the only place they
// meet, so the accept/reject path is a money-safe unit rather than a bare status flip.
type Service struct {
	repo     *Repo
	gw       PaymentGateway
	notifier contracts.Notifier
	cache    *cache.Cache
}

// NewService builds the bookings service. gw, notifier and c may be nil (degrade gracefully).
func NewService(repo *Repo, gw PaymentGateway, notifier contracts.Notifier, c *cache.Cache) *Service {
	if gw == nil {
		gw = mockGateway{}
	}
	return &Service{repo: repo, gw: gw, notifier: notifier, cache: c}
}

// ErrNotFound is returned when a booking id is unknown or outside the caller's scope.
var ErrNotFound = errors.New("bookings: not found")

// ErrPaymentNotReady is returned when a real capture is attempted before the payment is authorized.
var ErrPaymentNotReady = errors.New("bookings: payment not authorized yet")

// Create places a pending hold, then creates the Razorpay order for the server-derived fee. The
// booking is cancelled + payment marked FAILED if order creation fails, so no half-held row lingers.
func (s *Service) Create(ctx context.Context, userID string, b contracts.Booking) (contracts.Booking, error) {
	held, err := s.repo.Create(ctx, userID, b)
	if err != nil {
		return contracts.Booking{}, err
	}
	orderID, err := s.gw.CreateOrder(ctx, held.AmountPaisa, held.ID, map[string]string{
		"vendorId": held.VendorID,
		"seats":    fmt.Sprintf("%d", held.Seats),
	})
	if err != nil {
		_ = s.repo.FailPayment(ctx, held.ID)
		return contracts.Booking{}, err
	}
	if err := s.repo.AttachOrder(ctx, held.ID, orderID); err != nil {
		return contracts.Booking{}, err
	}
	held.RazorpayOrderID = orderID
	held.PaymentKeyID = s.gw.KeyID()
	held.Currency = "INR"
	s.invalidateAvail(ctx, held.VendorID)
	s.notify(ctx, userID, "BOOKING_REQUESTED", "Booking requested",
		fmt.Sprintf("Hold placed for %d seat(s). Awaiting the restaurant.", held.Seats),
		map[string]any{"bookingId": held.ID, "status": held.Status})
	return held, nil
}

// Decide accepts (capture) or rejects (refund) a pending booking. The state transition is atomic;
// money is captured/refunded on the same payment that was authorized at request time.
func (s *Service) Decide(ctx context.Context, id, sellerID, action string, admin bool) (contracts.Booking, error) {
	b, ok, err := s.repo.ForSeller(ctx, id, sellerID, admin)
	if err != nil {
		return contracts.Booking{}, err
	}
	if !ok {
		return contracts.Booking{}, ErrNotFound
	}
	if b.Status != "pending" {
		return contracts.Booking{}, ErrNotPending
	}

	switch action {
	case "accept":
		if s.gw.Enabled() {
			if b.RazorpayPaymentID == "" {
				return contracts.Booking{}, ErrPaymentNotReady
			}
			if err := s.gw.Capture(ctx, b.RazorpayPaymentID, b.AmountPaisa); err != nil {
				return contracts.Booking{}, err
			}
		}
		decided, err := s.repo.Decide(ctx, id, "confirmed")
		if err != nil {
			return contracts.Booking{}, err
		}
		_ = s.repo.SetPaymentStatus(ctx, id, "CAPTURED", b.RazorpayPaymentID)
		decided.PaymentStatus = "CAPTURED"
		s.invalidateAvail(ctx, decided.VendorID)
		s.notify(ctx, decided.UserID, "BOOKING_CONFIRMED", "Booking confirmed",
			fmt.Sprintf("Your table for %d is confirmed.", decided.Seats),
			map[string]any{"bookingId": decided.ID, "status": "confirmed"})
		return decided, nil

	case "reject":
		if s.gw.Enabled() && b.RazorpayPaymentID != "" {
			if err := s.gw.Refund(ctx, b.RazorpayPaymentID, b.AmountPaisa); err != nil {
				return contracts.Booking{}, err
			}
		}
		decided, err := s.repo.Decide(ctx, id, "rejected")
		if err != nil {
			return contracts.Booking{}, err
		}
		_ = s.repo.SetPaymentStatus(ctx, id, "REFUNDED", b.RazorpayPaymentID)
		decided.PaymentStatus = "REFUNDED"
		s.invalidateAvail(ctx, decided.VendorID)
		// Fixed copy: no rejection reasons (a rushed floor never writes one).
		s.notify(ctx, decided.UserID, "BOOKING_REJECTED", "Booking not confirmed",
			"Restaurant couldn't accommodate — likely limited seats. Refund initiated.",
			map[string]any{"bookingId": decided.ID, "status": "rejected"})
		return decided, nil
	}
	return contracts.Booking{}, errors.New("bookings: invalid decision")
}

// CancelByUser cancels the caller's booking and refunds any held fee.
func (s *Service) CancelByUser(ctx context.Context, userID, id string) (contracts.Booking, error) {
	b, ok, err := s.repo.CancelByUser(ctx, userID, id)
	if err != nil {
		return contracts.Booking{}, err
	}
	if !ok {
		return contracts.Booking{}, ErrNotFound
	}
	if s.gw.Enabled() && b.RazorpayPaymentID != "" {
		if err := s.gw.Refund(ctx, b.RazorpayPaymentID, b.AmountPaisa); err != nil {
			return contracts.Booking{}, err
		}
	}
	_ = s.repo.SetPaymentStatus(ctx, id, "REFUNDED", b.RazorpayPaymentID)
	b.PaymentStatus = "REFUNDED"
	s.invalidateAvail(ctx, b.VendorID)
	s.notify(ctx, userID, "BOOKING_CANCELLED", "Booking cancelled",
		"Your booking is cancelled. Refund initiated.",
		map[string]any{"bookingId": b.ID, "status": "cancelled"})
	return b, nil
}

// Vacate marks an accepted booking completed (the floor cleared the party).
func (s *Service) Vacate(ctx context.Context, id, sellerID string, admin bool) (contracts.Booking, error) {
	b, ok, err := s.repo.Vacate(ctx, id, sellerID, admin)
	if err != nil {
		return contracts.Booking{}, err
	}
	if !ok {
		return contracts.Booking{}, ErrNotFound
	}
	s.invalidateAvail(ctx, b.VendorID)
	return b, nil
}

// AttachPayment records the payment id from the client checkout callback.
func (s *Service) AttachPayment(ctx context.Context, userID, id, paymentID string) (contracts.Booking, error) {
	b, ok, err := s.repo.AttachPaymentID(ctx, userID, id, paymentID)
	if err != nil {
		return contracts.Booking{}, err
	}
	if !ok {
		return contracts.Booking{}, ErrNotFound
	}
	return b, nil
}

// UpsertConfig writes a vendor config and invalidates the public availability projection.
func (s *Service) UpsertConfig(ctx context.Context, cfg contracts.BookingConfig, sellerID string, admin bool) (contracts.BookingConfig, bool, error) {
	out, ok, err := s.repo.UpsertConfig(ctx, cfg, sellerID, admin)
	if err != nil || !ok {
		return out, ok, err
	}
	if s.cache != nil {
		s.cache.Del(ctx, cache.BookingAvail(out.VendorID))
	}
	return out, true, nil
}

// HandleWebhook applies a signature-verified Razorpay event to the ledger. Returns ok=false when the
// signature is invalid (caller must respond 400) so forged callbacks never touch money state.
func (s *Service) HandleWebhook(ctx context.Context, body []byte, signature, orderID, paymentID, status string) (bool, error) {
	if !s.gw.VerifyWebhook(body, signature) {
		return false, nil
	}
	if orderID == "" || status == "" {
		return true, nil
	}
	if err := s.repo.MarkWebhook(ctx, orderID, paymentID, status); err != nil {
		return true, err
	}
	return true, nil
}

func (s *Service) invalidateAvail(ctx context.Context, vendorID string) {
	if s.cache != nil && vendorID != "" {
		s.cache.Del(ctx, cache.BookingAvail(vendorID))
	}
}

func (s *Service) notify(ctx context.Context, userID, kind, title, body string, data map[string]any) {
	if s.notifier == nil || userID == "" {
		return
	}
	_ = s.notifier.Enqueue(ctx, userID, kind, title, body, data)
}