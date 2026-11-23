package portal

import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"

    "github.com/faazio/server/gateway/internal/platform/authtest"
    "github.com/faazio/server/gateway/internal/platform/testenv"
    "github.com/go-chi/chi/v5"
)

func TestLoginSuccess(t *testing.T) {
    // Setup test env (requires DB & cache)
    pool := testenv.Pool(t)
    cache := testenv.Cache(t)
    repo := New(pool)
    h := NewHandler(repo)
    r := chi.NewRouter()
    r.Use(authtest.Middleware()) // inject test user context
    h.Register(r)

    // Mock a simple login request (email/password flow)
    body := `{"email":"test@example.com","password":"password123"}`
    req := httptest.NewRequest(http.MethodPost, "/auth/portal/login", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()
    r.ServeHTTP(rec, req)

    if rec.Code != http.StatusOK {
        t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
    }
    // Basic sanity: response should contain a token field
    if !strings.Contains(rec.Body.String(), "token") {
        t.Fatalf("login response missing token: %s", rec.Body.String())
    }
    _ = pool // silence unused
    _ = cache
}
