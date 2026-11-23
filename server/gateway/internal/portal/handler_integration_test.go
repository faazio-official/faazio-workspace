package portal

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// deleteReq builds a DELETE/POST request for the credential-management routes, carrying a
// SUPER_ADMIN portal identity unless withPortal is false.
func mgmtReq(method, path, body string, withPortal bool, id string) *http.Request {
	r := credentialsReq(method, path, body, withPortal)
	if id != "" {
		ctx := chi.NewRouteContext()
		ctx.URLParams.Add("id", id)
		r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, ctx))
	}
	return r
}

// The delete endpoint must never run without a portal session: a trashed credential stops
// authenticating immediately, so an unauthenticated call must be a 401, not a silent success.
func TestDeleteCredentialRequiresPortalSession(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	rec := httptest.NewRecorder()
	h.deleteCredential(rec, mgmtReq(http.MethodDelete, "/admin/portal-users/pu-x", "", false, "pu-x"))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "unauthorized" {
		t.Fatalf("code = %q, want unauthorized", code)
	}
}

// The restore endpoint is equally gated — it can make a trashed login live again.
func TestRestoreCredentialRequiresPortalSession(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	rec := httptest.NewRecorder()
	h.restoreCredential(rec, mgmtReq(http.MethodPost, "/admin/portal-users/pu-x/restore", "", false, "pu-x"))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "unauthorized" {
		t.Fatalf("code = %q, want unauthorized", code)
	}
}

// The trash listing is superadmin-only in the router, but the handler still refuses a non-portal
// caller (defence in depth, matching listCredentials).
func TestListDeletedCredentialsRequiresPortalSession(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	rec := httptest.NewRecorder()
	h.listDeletedCredentials(rec, mgmtReq(http.MethodGet, "/admin/portal-users/trash", "", false, ""))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

// An over-long delete reason is rejected before any DB work, so a garbage payload is a clean 400.
func TestDeleteCredentialRejectsOverlongReason(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, "configured-secret", "")
	reason := make([]byte, 501)
	for i := range reason {
		reason[i] = 'a'
	}
	body := `{"reason":"` + string(reason) + `"}`
	rec := httptest.NewRecorder()
	h.deleteCredential(rec, mgmtReq(http.MethodDelete, "/admin/portal-users/pu-x", body, true, "pu-x"))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if code, _ := portalError(t, rec); code != "bad_request" {
		t.Fatalf("code = %q, want bad_request", code)
	}
}

// The trash window is 7 days, matching the catalogue product trash (0089).
func TestCredentialTrashWindowIsSevenDays(t *testing.T) {
	if CredentialTrashWindow.Hours() != 168 {
		t.Fatalf("trash window = %v, want 168h", CredentialTrashWindow)
	}
}
