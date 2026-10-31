// Package razorpaypay is the platform seam for Razorpay customer payments (order creation for
// the mobile UPI intent + webhook reconciliation). It is domain-free: checkout owns the order
// and the payment ledger, this package only talks to Razorpay.
//
// Secrets are loaded from env and never logged. When the key pair is unset the gateway runs in
// mock mode: ids are synthetic, no network call is made, and CreateOrder reports a paid result so
// local dev, CI and unit tests never depend on a live Razorpay account.
package razorpaypay

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
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

// ErrUnavailable is returned when a real action is requested without configured credentials.
var ErrUnavailable = errors.New("razorpaypay: gateway unavailable")

// OrderInput is the minimum needed to create a Razorpay order. Amount is in paisa.
type OrderInput struct {
	AmountPaisa int64
	// Receipt is Razorpay's idempotency-ish reference (the Faazio order id).
	Receipt string
	Notes   map[string]string
}

// Order is the created Razorpay order.
type Order struct {
	ID          string
	AmountPaisa int64
	Currency    string
	Status      string
}

// Gateway is the customer-payment seam used by checkout.
type Gateway interface {
	// Enabled reports whether real Razorpay calls should be made.
	Enabled() bool
	// KeyID is the public Razorpay key id (safe to hand to the client intent).
	KeyID() string
	CreateOrder(ctx context.Context, in OrderInput) (Order, error)
	// VerifyWebhook validates the X-Razorpay-Signature over the raw body.
	VerifyWebhook(body []byte, signature string) bool
}

// New builds a customer-payment gateway. Empty credentials → mock mode (never a half-configured
// client).
func New(keyID, keySecret, webhookSecret string) Gateway {
	if strings.TrimSpace(keyID) == "" || strings.TrimSpace(keySecret) == "" {
		return mockGateway{}
	}
	return &Client{
		keyID:         strings.TrimSpace(keyID),
		keySecret:     strings.TrimSpace(keySecret),
		webhookSecret: strings.TrimSpace(webhookSecret),
		baseURL:       "https://api.razorpay.com/v1",
		http:          &http.Client{Timeout: 12 * time.Second},
	}
}

type mockGateway struct{}

func (mockGateway) Enabled() bool { return false }
func (mockGateway) KeyID() string { return "" }
func (m mockGateway) CreateOrder(_ context.Context, in OrderInput) (Order, error) {
	return Order{
		ID:          "order_mock_" + shortID(),
		AmountPaisa: in.AmountPaisa,
		Currency:    "INR",
		Status:      "paid",
	}, nil
}
func (mockGateway) VerifyWebhook([]byte, string) bool { return false }

// Client is the real Razorpay customer-payment HTTP client.
type Client struct {
	keyID         string
	keySecret     string
	webhookSecret string
	baseURL       string
	http          *http.Client
}

// Enabled satisfies Gateway.
func (c *Client) Enabled() bool { return c != nil && c.keyID != "" && c.keySecret != "" }

// KeyID satisfies Gateway.
func (c *Client) KeyID() string {
	if c == nil {
		return ""
	}
	return c.keyID
}

// CreateOrder creates a Razorpay order (`order_*`) with auto-capture so a UPI payment settles
// without a second capture call.
func (c *Client) CreateOrder(ctx context.Context, in OrderInput) (Order, error) {
	if !c.Enabled() {
		return Order{}, ErrUnavailable
	}
	if in.AmountPaisa <= 0 {
		return Order{}, ErrUnavailable
	}
	body := map[string]any{
		"amount":          in.AmountPaisa,
		"currency":        "INR",
		"receipt":         in.Receipt,
		"payment_capture": 1,
	}
	if len(in.Notes) > 0 {
		body["notes"] = in.Notes
	}
	var out struct {
		ID       string `json:"id"`
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
		Status   string `json:"status"`
	}
	if err := c.do(ctx, http.MethodPost, "/orders", body, &out); err != nil {
		return Order{}, err
	}
	if out.ID == "" {
		return Order{}, errors.New("razorpaypay: order id missing")
	}
	return Order{ID: out.ID, AmountPaisa: out.Amount, Currency: fallback(out.Currency, "INR"), Status: out.Status}, nil
}

// VerifyWebhook checks the HMAC-SHA256 signature over the raw request body.
func (c *Client) VerifyWebhook(body []byte, signature string) bool {
	if c == nil || c.webhookSecret == "" || signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(c.webhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (c *Client) do(ctx context.Context, method, path string, payload, out any) error {
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
		return fmt.Errorf("razorpaypay: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		// Never surface the upstream body (may echo credentials/PCI data) — status only.
		return fmt.Errorf("razorpaypay: unexpected status %d", res.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(out)
}

func fallback(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
