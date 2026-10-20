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

func TestNormalizeScope(t *testing.T) {
	cases := []struct {
		role, seller, state string
		ok                  bool
	}{
		{"SELLER", "slr-1", "", true},
		{"seller", "slr-1", "", true},
		{"SELLER", "", "", false},
		{"SELLER", "slr-1", "KA", false},
		{"STATE_ADMIN", "", "ka", true},
		{"STATE_ADMIN", "", "K", false},
		{"STATE_ADMIN", "slr-1", "KA", false},
		{"SUPER_ADMIN", "", "", false},
		{"", "", "", false},
	}
	for _, c := range cases {
		role, seller, state, err := normalizeScope(c.role, c.seller, c.state)
		if c.ok {
			if err != nil {
				t.Fatalf("%+v: unexpected error: %v", c, err)
			}
			if role != "SELLER" && role != "STATE_ADMIN" {
				t.Fatalf("unexpected role %q", role)
			}
			if state != "" && state != "KA" {
				t.Fatalf("state not normalized: %q", state)
			}
			_ = seller
		} else if err == nil {
			t.Fatalf("%+v: expected error", c)
		}
	}
}
