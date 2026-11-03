package razorpayroute

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewWithoutCredentialsIsAConfigError(t *testing.T) {
	for _, tc := range []struct{ id, secret string }{
		{"", ""}, {"", "secret"}, {"key", ""}, {"  ", "secret"},
	} {
		g, err := New(tc.id, tc.secret, "")
		if err == nil {
			t.Fatalf("New(%q,%q) = %v, want configuration error", tc.id, tc.secret, g)
		}
		if g != nil {
			t.Fatalf("New(%q,%q) returned a gateway with a missing key", tc.id, tc.secret)
		}
	}
}

func TestNewWithCredentials(t *testing.T) {
	g, err := New("key", "secret", "whsec")
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if !g.Enabled() {
		t.Fatal("configured gateway must be enabled")
	}
}

func TestVerifyWebhook(t *testing.T) {
	g, err := New("key", "secret", "whsec")
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	body := []byte(`{"event":"transfer.released"}`)
	mac := hmac.New(sha256.New, []byte("whsec"))
	mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))
	if !g.VerifyWebhook(body, sig) {
		t.Fatal("valid signature rejected")
	}
	if g.VerifyWebhook(body, "deadbeef") {
		t.Fatal("invalid signature accepted")
	}
	if g.VerifyWebhook(body, "") {
		t.Fatal("empty signature accepted")
	}
}

func TestClientNeverEchoesUpstreamBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"error":"secret account 1234"}`)
	}))
	defer srv.Close()

	c := &Client{keyID: "k", keySecret: "s", baseURL: srv.URL, http: srv.Client()}
	_, err := c.CreateLinkedAccount(context.Background(), LinkedAccountInput{LegalBusinessName: "Test"})
	if err == nil {
		t.Fatal("expected an error for a non-2xx response")
	}
	if strings.Contains(err.Error(), "secret") || strings.Contains(err.Error(), "1234") {
		t.Fatalf("error leaked the upstream body: %v", err)
	}
}

func TestCreateTransferRequiresInputs(t *testing.T) {
	c := &Client{keyID: "k", keySecret: "s", baseURL: "http://127.0.0.1:1", http: http.DefaultClient}
	if _, err := c.CreateTransfer(context.Background(), TransferInput{PaymentID: "pay_1"}); err == nil {
		t.Fatal("missing account/amount must be rejected before any call")
	}
	if err := c.ReleaseTransfer(context.Background(), ""); err == nil {
		t.Fatal("empty transfer id must be rejected")
	}
}
