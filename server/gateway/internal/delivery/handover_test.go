package delivery

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestPickupTokenRoundTrip(t *testing.T) {
	h := (&Handler{}).WithHandoverSecret("test-secret")
	expires := time.Now().UTC().Add(time.Hour).Truncate(time.Second)
	token := h.signPickupToken("stop-abc", expires)

	if err := h.verifyPickupToken("stop-abc", token); err != nil {
		t.Fatalf("valid token rejected: %v", err)
	}
	if err := h.verifyPickupToken("stop-other", token); !errors.Is(err, ErrInvalidPickupToken) {
		t.Fatalf("mismatched stop: got %v", err)
	}
}

func TestPickupTokenRejectsForgeryAndExpiry(t *testing.T) {
	h := (&Handler{}).WithHandoverSecret("test-secret")

	expired := time.Now().UTC().Add(-time.Minute).Truncate(time.Second)
	if err := h.verifyPickupToken("stop-abc", h.signPickupToken("stop-abc", expired)); !errors.Is(err, ErrPickupTokenExpired) {
		t.Fatalf("expired token: got %v", err)
	}

	other := (&Handler{}).WithHandoverSecret("another-secret")
	valid := h.signPickupToken("stop-abc", time.Now().UTC().Add(time.Hour).Truncate(time.Second))
	forged := other.signPickupToken("stop-abc", time.Now().UTC().Add(time.Hour).Truncate(time.Second))
	if err := h.verifyPickupToken("stop-abc", forged); !errors.Is(err, ErrInvalidPickupToken) {
		t.Fatalf("forged token: got %v", err)
	}
	// Tampering with any segment must fail.
	parts := strings.Split(valid, ".")
	parts[1] = "9999999999"
	if err := h.verifyPickupToken("stop-abc", strings.Join(parts, ".")); !errors.Is(err, ErrInvalidPickupToken) {
		t.Fatalf("tampered expiry: got %v", err)
	}
}

func TestPickupTokenDisabledWithoutSecret(t *testing.T) {
	h := &Handler{}
	if _, err := h.IssuePickupHandover(context.Background(), "ord-1"); err == nil {
		t.Fatal("expected an error when the signing secret is unset")
	}
}
