package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func signHS256(t *testing.T, secret []byte, claims map[string]any) string {
	t.Helper()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	p := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(header + "." + p))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return header + "." + p + "." + sig
}

type resolverFunc func(ctx context.Context, authUID string) (string, error)

func (f resolverFunc) ResolveUserID(ctx context.Context, authUID string) (string, error) {
	return f(ctx, authUID)
}

func TestMiddlewareResolvesSubject(t *testing.T) {
	secret := []byte("test-secret")
	token := signHS256(t, secret, map[string]any{"sub": "auth-uid-1", "exp": time.Now().Add(time.Hour).Unix()})

	var got string
	h := Middleware(Config{
		JWTSecret: secret,
		Resolver: resolverFunc(func(_ context.Context, uid string) (string, error) {
			if uid != "auth-uid-1" {
				t.Errorf("resolver got %q", uid)
			}
			return "user-1", nil
		}),
	})(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		got = UserID(r.Context())
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	h.ServeHTTP(httptest.NewRecorder(), req)
	if got != "user-1" {
		t.Fatalf("UserID = %q, want user-1", got)
	}
}

func TestMiddlewareRejectsBadTokens(t *testing.T) {
	secret := []byte("test-secret")
	cases := map[string]string{
		"bad signature": signHS256(t, []byte("other"), map[string]any{"sub": "x"}),
		"expired":       signHS256(t, secret, map[string]any{"sub": "x", "exp": time.Now().Add(-time.Hour).Unix()}),
		"malformed":     "not.a.jwt.at.all",
		"missing":       "",
	}
	for name, token := range cases {
		t.Run(name, func(t *testing.T) {
			var got string
			h := Middleware(Config{
				JWTSecret: secret,
				Resolver:  resolverFunc(func(context.Context, string) (string, error) { return "user-1", nil }),
			})(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { got = UserID(r.Context()) }))
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if token != "" {
				req.Header.Set("Authorization", "Bearer "+token)
			}
			h.ServeHTTP(httptest.NewRecorder(), req)
			if got != "" {
				t.Fatalf("UserID = %q, want empty", got)
			}
		})
	}
}

func TestDevModeUsesHeaderThenDefault(t *testing.T) {
	var got string
	h := Middleware(Config{Disabled: true, DevUserID: "user-1"})(
		http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { got = UserID(r.Context()) }),
	)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Dev-User", "user-42")
	h.ServeHTTP(httptest.NewRecorder(), req)
	if got != "user-42" {
		t.Fatalf("UserID = %q, want user-42", got)
	}
}

func TestRequireUnauthenticated(t *testing.T) {
	h := Require(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
