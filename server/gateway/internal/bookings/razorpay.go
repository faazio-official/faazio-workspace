package bookings

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// PaymentGateway is the thin payment seam for bookings. This file is the only place that speaks
// Razorpay, so the accept/reject transaction stays unit-testable with a mock and Razorpay Route
// transfer/reversal calls (future, if the fee is ever shared) slot in here without touching the repo.
//
// v1 is plain authorize → capture-on-accept / refund-on-reject: 100% of the ₹50/seat fee is platform
// revenue, so no Route splits are needed (cheaper to operate, less KYC surface).
type PaymentGateway interface {
	// Enabled reports whether real Razorpay calls should be made. False = mock mode (dev/test):
	// CreateOrder returns a synthetic id and Capture/Refund are no-ops.
	Enabled() bool
	// KeyID is the publishable key handed to the client checkout (never the secret).
	KeyID() string
	CreateOrder(ctx context.Context, amountPaisa int64, receipt string, notes map[string]string) (orderID string, err error)
	Capture(ctx context.Context, paymentID string, amountPaisa int64) error
	Refund(ctx context.Context, paymentID string, amountPaisa int64) error
	// VerifyWebhook validates the X-Razorpay-Signature over the raw body.
	VerifyWebhook(body []byte, signature string) bool
}

// ErrGatewayUnavailable is returned when a real payment action is requested without a configured
// gateway (or without an authorized payment id to act on).
var ErrGatewayUnavailable = errors.New("bookings: payment gateway unavailable")

// NewGateway builds the payment gateway from config. Empty keys → mock mode so local dev, CI and
// unit tests never make network calls (documented in mvp-backend.md).
func NewGateway(keyID, keySecret, webhookSecret string) PaymentGateway {
	if strings.TrimSpace(keyID) == "" || strings.TrimSpace(keySecret) == "" {
		return mockGateway{}
	}
	return &RazorpayClient{
		keyID:         strings.TrimSpace(keyID),
		keySecret:     strings.TrimSpace(keySecret),
		webhookSecret: strings.TrimSpace(webhookSecret),
		baseURL:       "https://api.razorpay.com/v1",
		http:          &http.Client{Timeout: 10 * time.Second},
	}
}

// mockGateway simulates the payment rail in dev/test. It is intentionally always "disabled" so the
// service records the lifecycle (CREATED → CAPTURED/REFUNDED) without a network hop.
type mockGateway struct{}

func (mockGateway) Enabled() bool { return false }
func (mockGateway) KeyID() string { return "" }
func (mockGateway) CreateOrder(context.Context, int64, string, map[string]string) (string, error) {
	return "order_mock_" + shortID(), nil
}
func (mockGateway) Capture(context.Context, string, int64) error { return nil }
func (mockGateway) Refund(context.Context, string, int64) error  { return nil }
func (mockGateway) VerifyWebhook([]byte, string) bool            { return false }

// RazorpayClient is the real HTTP client. Secrets live only in memory (loaded from env; never logged).
type RazorpayClient struct {
	keyID         string
	keySecret     string
	webhookSecret string
	baseURL       string
	http          *http.Client
}

// Enabled satisfies PaymentGateway.
func (c *RazorpayClient) Enabled() bool { return c != nil && c.keyID != "" && c.keySecret != "" }

// KeyID satisfies PaymentGateway.
func (c *RazorpayClient) KeyID() string {
	if c == nil {
		return ""
	}
	return c.keyID
}

// CreateOrder creates a Razorpay order for the fee (amount in paisa, server-derived).
func (c *RazorpayClient) CreateOrder(ctx context.Context, amountPaisa int64, receipt string, notes map[string]string) (string, error) {
	if !c.Enabled() {
		return "", ErrGatewayUnavailable
	}
	body := map[string]any{
		"amount":   amountPaisa,
		"currency": "INR",
		"receipt":  receipt,
		"notes":    notes,
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := c.do(ctx, http.MethodPost, "/orders", body, &out); err != nil {
		return "", err
	}
	if out.ID == "" {
		return "", errors.New("razorpay: order id missing")
	}
	return out.ID, nil
}

// Capture settles an authorized payment (server capture on accept).
func (c *RazorpayClient) Capture(ctx context.Context, paymentID string, amountPaisa int64) error {
	if !c.Enabled() || paymentID == "" {
		return ErrGatewayUnavailable
	}
	body := map[string]any{"amount": amountPaisa, "currency": "INR"}
	return c.do(ctx, http.MethodPost, "/payments/"+paymentID+"/capture", body, nil)
}

// Refund releases/returns the fee (refund on reject/cancel; covers authorized-not-captured too).
func (c *RazorpayClient) Refund(ctx context.Context, paymentID string, amountPaisa int64) error {
	if !c.Enabled() || paymentID == "" {
		return ErrGatewayUnavailable
	}
	body := map[string]any{"amount": amountPaisa}
	return c.do(ctx, http.MethodPost, "/payments/"+paymentID+"/refund", body, nil)
}

// VerifyWebhook checks the HMAC-SHA256 signature Razorpay sends over the raw request body.
func (c *RazorpayClient) VerifyWebhook(body []byte, signature string) bool {
	if c == nil || c.webhookSecret == "" || signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(c.webhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (c *RazorpayClient) do(ctx context.Context, method, path string, payload any, out any) error {
	var reader io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return err
	}
	req.SetBasicAuth(c.keyID, c.keySecret)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("razorpay: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		// Never surface the upstream body (may echo credentials/PCI data) — status only.
		return fmt.Errorf("razorpay: unexpected status %d", res.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(out)
}