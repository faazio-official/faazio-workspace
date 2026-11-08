package delivery

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
)

// Pickup handover tokens are stateless: the seller console asks the gateway to mint one for an
// active delivery job, renders it as a QR, and the rider scans it. The gateway recomputes the HMAC
// on verify — no token is ever stored, only the verification timestamp (0088).

const (
	pickupTokenVersion = "v1"
	pickupTokenTTL     = 2 * time.Hour
	// handoverKeyLabel domain-separates the pickup key from the portal JWT secret when the two
	// intentionally share one configured value.
	handoverKeyLabel = "faazio/pickup-handover/v1"
)

var (
	// ErrInvalidPickupToken is returned for a malformed, mismatched or forged QR token.
	ErrInvalidPickupToken = errors.New("delivery: invalid pickup token")
	// ErrPickupTokenExpired is returned when a valid QR token is past its expiry.
	ErrPickupTokenExpired = errors.New("delivery: pickup token expired")
)

// WithHandoverSecret configures the pickup-QR signer. An empty secret leaves the flow disabled.
func (h *Handler) WithHandoverSecret(secret string) *Handler {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		h.handoverKey = nil
		return h
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(handoverKeyLabel))
	h.handoverKey = mac.Sum(nil)
	return h
}

// IssuePickupHandover mints the seller pickup QR for the customer order's active delivery job.
func (h *Handler) IssuePickupHandover(ctx context.Context, customerOrderID string) (contracts.PickupHandover, error) {
	if len(h.handoverKey) == 0 {
		return contracts.PickupHandover{}, contracts.ErrPickupHandoverUnavailable
	}
	customerOrderID = strings.TrimSpace(customerOrderID)
	if customerOrderID == "" {
		return contracts.PickupHandover{}, ErrNotFound
	}
	stopID, _, err := h.repo.PickupStopByCustomerOrder(ctx, customerOrderID)
	if err != nil {
		return contracts.PickupHandover{}, err
	}
	expires := time.Now().UTC().Add(pickupTokenTTL).Truncate(time.Second)
	return contracts.PickupHandover{
		CustomerOrderID: customerOrderID,
		StopID:          stopID,
		Token:           h.signPickupToken(stopID, expires),
		ExpiresAt:       expires,
	}, nil
}

// signPickupToken produces "<stopID>.<unixExpiry>.<hmac>". The stop id is the capability subject;
// the signature binds it to the expiry so a leaked QR cannot be replayed indefinitely.
func (h *Handler) signPickupToken(stopID string, expires time.Time) string {
	exp := strconv.FormatInt(expires.Unix(), 10)
	mac := hmac.New(sha256.New, h.handoverKey)
	mac.Write([]byte(pickupTokenVersion + "|" + stopID + "|" + exp))
	return stopID + "." + exp + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// verifyPickupToken validates the scanned token against the stop the rider selected.
func (h *Handler) verifyPickupToken(stopID, token string) error {
	if len(h.handoverKey) == 0 {
		return ErrHandoverUnconfigured
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] != stopID {
		return ErrInvalidPickupToken
	}
	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || exp <= 0 {
		return ErrInvalidPickupToken
	}
	if time.Now().UTC().Unix() > exp {
		return ErrPickupTokenExpired
	}
	want := h.signPickupToken(stopID, time.Unix(exp, 0).UTC())
	if subtle.ConstantTimeCompare([]byte(want), []byte(token)) != 1 {
		return ErrInvalidPickupToken
	}
	return nil
}
