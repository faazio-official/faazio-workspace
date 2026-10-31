package razorpaypay

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewWithoutCredentialsIsDisabled(t *testing.T) {
	g := New("", "", "")
	if g.Enabled() {
		t.Fatal("empty credentials must be disabled, not mocked")
	}
	if g.KeyID() != "" {
		t.Fatalf("disabled key id must be empty, got %q", g.KeyID())
	}
	if _, err := g.CreateOrder(context.Background(), OrderInput{AmountPaisa: 12345, Receipt: "ord-1"}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("disabled CreateOrder err = %v, want ErrUnavailable", err)
	}
	if g.VerifyWebhook([]byte(`{}`), "sig") {
		t.Fatal("disabled gateway must reject every webhook signature")
	}
}

func TestVerifyWebhook(t *testing.T) {
	g := New("key", "secret", "whsec")
	body := []byte(`{"event":"payment.captured"}`)
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

func TestEnabledRequiresKeys(t *testing.T) {
	if New("key", "", "").Enabled() {
		t.Fatal("half-configured client must stay disabled")
	}
	if !New("key", "secret", "").Enabled() {
		t.Fatal("key pair must enable the client")
	}
}

func TestCreateOrderRequiresAmount(t *testing.T) {
	c := &Client{keyID: "k", keySecret: "s", baseURL: "http://127.0.0.1:1", http: http.DefaultClient}
	if _, err := c.CreateOrder(context.Background(), OrderInput{AmountPaisa: 0}); err == nil {
		t.Fatal("zero amount must be rejected before any call")
	}
}

func TestClientNeverEchoesUpstreamBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"error":"secret key 1234"}`)
	}))
	defer srv.Close()

	c := &Client{keyID: "k", keySecret: "s", baseURL: srv.URL, http: srv.Client()}
	_, err := c.CreateOrder(context.Background(), OrderInput{AmountPaisa: 100})
	if err == nil {
		t.Fatal("expected an error for a non-2xx response")
	}
	if strings.Contains(err.Error(), "secret") || strings.Contains(err.Error(), "1234") {
		t.Fatalf("error leaked the upstream body: %v", err)
	}
}
