package portal

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/auth"
)

// credentialsReq builds a JSON request carrying a portal identity (or none when withPortal is false).
func credentialsReq(method, path, body string, withPortal bool) *http.Request {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if withPortal {
		ctx := auth.WithIdentity(context.Background(), auth.Identity{
			UserID: "pu-test",
			Role:   auth.RoleSeller,
			Portal: true,
			Jti:    "jti-test",
		})
		r = r.WithContext(ctx)
	}
	return r
}

// A credential rotation must never run without a portal session.
func TestChangeEmailRequiresPortalSession(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	rec := httptest.NewRecorder()
	h.changeEmail(rec, credentialsReq(http.MethodPut, "/auth/portal/email", `{"currentPassword":"x","newEmail":"new@example.com"}`, false))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "unauthorized" {
		t.Fatalf("code = %q, want unauthorized", code)
	}
}

func TestChangeEmailRejectsNonJSON(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	r := credentialsReq(http.MethodPut, "/auth/portal/email", `{}`, true)
	r.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	h.changeEmail(rec, r)
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415", rec.Code)
	}
}

// Validation happens before the DB read, so an invalid address is a clean 400 even without a DB.
func TestChangeEmailRejectsInvalidEmail(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	rec := httptest.NewRecorder()
	h.changeEmail(rec, credentialsReq(http.MethodPut, "/auth/portal/email", `{"currentPassword":"x","newEmail":"not-an-email"}`, true))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "bad_request" {
		t.Fatalf("code = %q, want bad_request", code)
	}
}

func TestChangePasswordRequiresPortalSession(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	rec := httptest.NewRecorder()
	h.changePassword(rec, credentialsReq(http.MethodPut, "/auth/portal/password", `{"currentPassword":"x","newPassword":"a-very-long-password"}`, false))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "unauthorized" {
		t.Fatalf("code = %q, want unauthorized", code)
	}
}

func TestChangePasswordRejectsNonJSON(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	r := credentialsReq(http.MethodPut, "/auth/portal/password", `{}`, true)
	r.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	h.changePassword(rec, r)
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415", rec.Code)
	}
}

func TestChangePasswordRejectsWeakPassword(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	cases := []struct{ name, body string }{
		{"too short", `{"currentPassword":"short","newPassword":"short"}`},
		{"same as current", `{"currentPassword":"a-very-long-password","newPassword":"a-very-long-password"}`},
		{"common value", `{"currentPassword":"a-very-long-password","newPassword":"administrator"}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.changePassword(rec, credentialsReq(http.MethodPut, "/auth/portal/password", c.body, true))
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			if code, _ := portalError(t, rec); code != "weak_password" {
				t.Fatalf("code = %q, want weak_password", code)
			}
		})
	}
}

func TestValidEmail(t *testing.T) {
	cases := []struct {
		email string
		ok    bool
	}{
		{"ops@faazio.in", true},
		{"a@b.co", true},
		{"", false},
		{"no-at-sign", false},
		{"@faazio.in", false},
		{"ops@faazio", false},
		{"ops@.faazio.in", false},
		{"ops@faazio.in.", false},
		{"ops @faazio.in", false},
		{strings.Repeat("a", 250) + "@faazio.in", false},
	}
	for _, c := range cases {
		if got := validEmail(c.email); got != c.ok {
			t.Errorf("validEmail(%q) = %v, want %v", c.email, got, c.ok)
		}
	}
}
