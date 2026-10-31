package checkout

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/razorpaypay"
)

func signRazorpay(body, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestRazorpayWebhookDisabledGateway(t *testing.T) {
	h := &Handler{pay: razorpaypay.New("", "", "", "")} // mock mode → not Enabled
	req := httptest.NewRequest(http.MethodPost, "/webhooks/razorpay/payments", strings.NewReader(`{"event":"payment.captured"}`))
	rec := httptest.NewRecorder()
	h.razorpayPaymentWebhook(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("disabled gateway = %d, want 503", rec.Code)
	}
}

func TestRazorpayWebhookRejectsBadSignature(t *testing.T) {
	h := &Handler{pay: razorpaypay.New("k", "s", "whsec", "")}
	body := `{"event":"payment.captured"}`
	req := httptest.NewRequest(http.MethodPost, "/webhooks/razorpay/payments", strings.NewReader(body))
	req.Header.Set("X-Razorpay-Signature", "deadbeef")
	rec := httptest.NewRecorder()
	h.razorpayPaymentWebhook(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("bad signature = %d, want 401", rec.Code)
	}
}

func TestRazorpayWebhookIgnoresUnknownEvent(t *testing.T) {
	h := &Handler{pay: razorpaypay.New("k", "s", "whsec", "")}
	body := `{"event":"refund.created","payload":{"payment":{"entity":{"id":"pay_1","order_id":"order_1","status":"captured"}}}}`
	req := httptest.NewRequest(http.MethodPost, "/webhooks/razorpay/payments", strings.NewReader(body))
	req.Header.Set("X-Razorpay-Signature", signRazorpay(body, "whsec"))
	rec := httptest.NewRecorder()
	h.razorpayPaymentWebhook(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("unknown event = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ignored") {
		t.Fatalf("unknown event body = %s", rec.Body.String())
	}
}