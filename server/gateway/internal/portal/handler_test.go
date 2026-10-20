package portal

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPUsesProxyHeaders(t *testing.T) {
	r := httptest.NewRequest("POST", "/auth/portal/login", nil)
	r.RemoteAddr = "10.0.0.5:1234"

	r.Header.Set("X-Forwarded-For", "203.0.113.9, 10.0.0.5")
	if got := clientIP(r); got != "203.0.113.9" {
		t.Fatalf("forwarded-for client ip = %q", got)
	}

	r.Header.Set("CF-Connecting-IP", "198.51.100.7")
	if got := clientIP(r); got != "198.51.100.7" {
		t.Fatalf("cf-connecting-ip = %q", got)
	}

	r.Header.Set("CF-Connecting-IP", "not-an-ip")
	if got := clientIP(r); got != "203.0.113.9" {
		t.Fatalf("invalid cf header fell through to %q", got)
	}
}
