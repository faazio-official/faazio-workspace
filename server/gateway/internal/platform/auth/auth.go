// Package auth verifies Supabase JWTs and resolves the app user id. Platform code
// carries no domain knowledge: the auth_uid → app user_id mapping is injected as a
// UserResolver by the checkout context.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

type ctxKey struct{}

// UserResolver maps a Supabase auth subject (auth.uid) to an app user slug.
type UserResolver interface {
	ResolveUserID(ctx context.Context, authUID string) (string, error)
}

// Config is the auth middleware configuration.
type Config struct {
	Disabled  bool
	DevUserID string
	JWTSecret []byte
	Resolver  UserResolver
}

// Middleware returns a chi-compatible middleware that attaches the app user id to the
// request context. It never rejects here; use Require on protected routes.
func Middleware(cfg Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid := ""
			if cfg.Disabled {
				uid = strings.TrimSpace(r.Header.Get("X-Dev-User"))
				if uid == "" {
					uid = cfg.DevUserID
				}
			} else if sub, err := subjectFromRequest(r, cfg.JWTSecret); err == nil && cfg.Resolver != nil {
				if resolved, rerr := cfg.Resolver.ResolveUserID(r.Context(), sub); rerr == nil {
					uid = resolved
				}
			}
			if uid != "" {
				r = r.WithContext(context.WithValue(r.Context(), ctxKey{}, uid))
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Require rejects unauthenticated requests.
func Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if UserID(r.Context()) == "" {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"authentication required","code":"unauthorized"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// UserID returns the resolved app user id, or "" when unauthenticated.
func UserID(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKey{}).(string); ok {
		return v
	}
	return ""
}

var errNoToken = errors.New("no token")

func subjectFromRequest(r *http.Request, secret []byte) (string, error) {
	if len(secret) == 0 {
		return "", errors.New("auth secret not configured")
	}
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return "", errNoToken
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", errors.New("malformed token")
	}
	signingInput := parts[0] + "." + parts[1]
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", errors.New("bad signature encoding")
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingInput))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return "", errors.New("signature mismatch")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("bad payload encoding")
	}
	var claims struct {
		Sub string `json:"sub"`
		Exp int64  `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "", errors.New("bad claims")
	}
	if claims.Exp != 0 && time.Unix(claims.Exp, 0).Before(time.Now()) {
		return "", errors.New("token expired")
	}
	if claims.Sub == "" {
		return "", errors.New("no subject")
	}
	return claims.Sub, nil
}
