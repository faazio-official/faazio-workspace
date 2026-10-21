package portal

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

// portalError decodes the httpx error envelope.
func portalError(t *testing.T, rec *httptest.ResponseRecorder) (string, string) {
	t.Helper()
	var body struct {
		Error string `json:"error"`
		Code  string `json:"code"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error envelope: %v (body=%s)", err, rec.Body.String())
	}
	return body.Code, body.Error
}

func loginPost(body string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/auth/portal/login", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}

func TestLoginEmptySecretReturns503(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "", "")
	rec := httptest.NewRecorder()
	h.login(rec, loginPost(`{"email":"ops@faazio.in","password":"whatever12345"}`))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "portal_auth_unavailable" {
		t.Fatalf("code = %q, want portal_auth_unavailable", code)
	}
}

func TestRefreshEmptySecretReturns503(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "", "")
	rec := httptest.NewRecorder()
	h.refresh(rec, loginPost(`{"refreshToken":"faazio_pr_x"}`))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "portal_auth_unavailable" {
		t.Fatalf("code = %q, want portal_auth_unavailable", code)
	}
}

// Regression for the post-503 path: with a configured secret but a missing DB/schema (0033 absent),
// login must return 500 portal_unavailable, never panic or 503.
func TestLoginSchemaFailureReturns500(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	rec := httptest.NewRecorder()
	h.login(rec, loginPost(`{"email":"ops@faazio.in","password":"whatever12345"}`))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "portal_unavailable" {
		t.Fatalf("code = %q, want portal_unavailable", code)
	}
}

// The 500 path logs only SQLSTATE/object names: a future missing migration is diagnosable in Render
// logs without ever leaking query values, hosts or credentials.
func TestSafeErrorFields(t *testing.T) {
	wrapped := fmt.Errorf("query: %w", &pgconn.PgError{
		Code: "42703", TableName: "portal_sessions", ColumnName: "absolute_expires_at",
	})
	if got := safeErrorFields(wrapped); got != "sqlstate=42703 table=portal_sessions column=absolute_expires_at" {
		t.Fatalf("pg fields = %q", got)
	}

	secret := errors.New("host=db.internal password=hunter2")
	got := safeErrorFields(secret)
	if !strings.HasPrefix(got, "err_type=") || strings.Contains(got, "db.internal") || strings.Contains(got, "hunter2") {
		t.Fatalf("non-pg error leaked detail: %q", got)
	}
}

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

func TestDefaultForceChange(t *testing.T) {
	yes, no := true, false
	cases := []struct {
		role     string
		override *bool
		want     bool
	}{
		{"SUPER_ADMIN", nil, false},
		{"SELLER", nil, true},
		{"STATE_ADMIN", nil, true},
		{"SUPER_ADMIN", &yes, true},
		{"SELLER", &no, false},
	}
	for _, c := range cases {
		if got := defaultForceChange(c.role, c.override); got != c.want {
			t.Errorf("defaultForceChange(%q, %v) = %v, want %v", c.role, c.override, got, c.want)
		}
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
