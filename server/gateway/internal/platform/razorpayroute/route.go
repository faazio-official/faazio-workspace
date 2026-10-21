// Package razorpayroute is the platform seam for Razorpay Route (linked accounts + split
// transfers). It is domain-free: sellers provisions a linked account and settlement holds/releases
// transfers, but neither context owns an HTTP client.
//
// Secrets are loaded from env and never logged. When the key pair is unset the gateway runs in mock
// mode: ids are synthetic and no network call is made, so local dev, CI and unit tests stay offline.
package razorpayroute

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
var ErrUnavailable = errors.New("razorpayroute: gateway unavailable")

// LinkedAccountInput is the minimum profile needed to create a Route linked account. It carries the
// full account number only in memory; callers must never persist it.
type LinkedAccountInput struct {
	Email             string
	Phone             string
	LegalBusinessName string
	ContactName       string
	BusinessType      string
	Category          string
	AddressLine       string
	City              string
	StateCode         string
	PostalCode        string
	BankName          string
	AccountNumber     string
	IFSC              string
	BeneficiaryName   string
}

// TransferInput creates a split transfer. When OnHoldUntil is non-zero the funds stay in escrow
// until that time (the 14-day buyer-protection window).
type TransferInput struct {
	PaymentID   string
	AccountID   string
	AmountPaisa int64
	OnHoldUntil time.Time
	Notes       map[string]string
}

// Gateway is the Route seam used by sellers + settlement.
type Gateway interface {
	// Enabled reports whether real Razorpay calls should be made.
	Enabled() bool
	CreateLinkedAccount(ctx context.Context, in LinkedAccountInput) (accountID string, err error)
	CreateTransfer(ctx context.Context, in TransferInput) (transferID string, err error)
	ReleaseTransfer(ctx context.Context, transferID string) error
	ReverseTransfer(ctx context.Context, transferID string) error
	// VerifyWebhook validates the X-Razorpay-Signature over the raw body.
	VerifyWebhook(body []byte, signature string) bool
}

// New builds a Route gateway. Empty credentials → mock mode (never a half-configured client).
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
func (mockGateway) CreateLinkedAccount(context.Context, LinkedAccountInput) (string, error) {
	return "acc_mock_" + shortID(), nil
}
func (mockGateway) CreateTransfer(context.Context, TransferInput) (string, error) {
	return "trf_mock_" + shortID(), nil
}
func (mockGateway) ReleaseTransfer(context.Context, string) error { return nil }
func (mockGateway) ReverseTransfer(context.Context, string) error { return nil }
func (mockGateway) VerifyWebhook([]byte, string) bool             { return false }

// Client is the real Razorpay Route HTTP client.
type Client struct {
	keyID         string
	keySecret     string
	webhookSecret string
	baseURL       string
	http          *http.Client
}

// Enabled satisfies Gateway.
func (c *Client) Enabled() bool { return c != nil && c.keyID != "" && c.keySecret != "" }

// CreateLinkedAccount creates a Route account (`acc_*`). The bank account is optional: Razorpay
// accepts an account without one, and the seller can complete it later from the Route dashboard.
func (c *Client) CreateLinkedAccount(ctx context.Context, in LinkedAccountInput) (string, error) {
	if !c.Enabled() {
		return "", ErrUnavailable
	}
	profile := map[string]any{
		"category":    fallback(in.Category, "ecommerce"),
		"subcategory": "ecommerce",
		"addresses": map[string]any{
			"registered": map[string]any{
				"street1":     in.AddressLine,
				"city":        in.City,
				"state":       in.StateCode,
				"postal_code": in.PostalCode,
				"country":     "IN",
			},
		},
	}
	body := map[string]any{
		"email":               in.Email,
		"phone":               in.Phone,
		"legal_business_name": in.LegalBusinessName,
		"business_type":       fallback(in.BusinessType, "individual"),
		"contact_name":        in.ContactName,
		"profile":             profile,
	}
	if in.AccountNumber != "" && in.IFSC != "" {
		body["bank_account"] = map[string]any{
			"bank_name":        in.BankName,
			"account_number":   in.AccountNumber,
			"ifsc":             in.IFSC,
			"beneficiary_name": fallback(in.BeneficiaryName, in.LegalBusinessName),
		}
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := c.do(ctx, http.MethodPost, "/accounts", body, &out); err != nil {
		return "", err
	}
	if out.ID == "" {
		return "", errors.New("razorpayroute: account id missing")
	}
	return out.ID, nil
}

// CreateTransfer moves the seller slice to the linked account. With OnHoldUntil set the transfer is
// created on_hold and settles only after release.
func (c *Client) CreateTransfer(ctx context.Context, in TransferInput) (string, error) {
	if !c.Enabled() {
		return "", ErrUnavailable
	}
	if in.PaymentID == "" || in.AccountID == "" || in.AmountPaisa <= 0 {
		return "", ErrUnavailable
	}
	body := map[string]any{
		"payment_id": in.PaymentID,
		"account":    in.AccountID,
		"amount":     in.AmountPaisa,
		"currency":   "INR",
	}
	if !in.OnHoldUntil.IsZero() {
		body["on_hold"] = true
		body["on_hold_until"] = in.OnHoldUntil.Unix()
	}
	if len(in.Notes) > 0 {
		body["notes"] = in.Notes
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := c.do(ctx, http.MethodPost, "/transfers", body, &out); err != nil {
		return "", err
	}
	if out.ID == "" {
		return "", errors.New("razorpayroute: transfer id missing")
	}
	return out.ID, nil
}

// ReleaseTransfer settles a held transfer to the seller's bank.
func (c *Client) ReleaseTransfer(ctx context.Context, transferID string) error {
	if !c.Enabled() || transferID == "" {
		return ErrUnavailable
	}
	return c.do(ctx, http.MethodPost, "/transfers/"+transferID+"/release", nil, nil)
}

// ReverseTransfer claws back an unsettled transfer (refund / return).
func (c *Client) ReverseTransfer(ctx context.Context, transferID string) error {
	if !c.Enabled() || transferID == "" {
		return ErrUnavailable
	}
	return c.do(ctx, http.MethodPost, "/transfers/"+transferID+"/reverse", nil, nil)
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
		return fmt.Errorf("razorpayroute: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		// Never surface the upstream body (may echo credentials/PCI data) — status only.
		return fmt.Errorf("razorpayroute: unexpected status %d", res.StatusCode)
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
