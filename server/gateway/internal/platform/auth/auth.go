// Package auth verifies Supabase JWTs and resolves the app user id + role claims. Platform
// code carries no domain knowledge: the auth_uid → app user_id mapping is injected as a
// UserResolver by the checkout context.
//
// Partner roles (portal) travel as custom JWT claims — `app_role`, `seller_id`, `state_code` —
// either top-level or under `app_metadata`. In local dev (AUTH_DISABLED) they come from the
// `X-Dev-Role` / `X-Dev-Seller` / `X-Dev-State` headers so integration tests can act as any role.
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
type identityKey struct{}

// Role constants (mirror the portal's Role union).
const (
	RoleSeller     = "SELLER"
	RoleStateAdmin = "STATE_ADMIN"
	RoleSuperAdmin = "SUPER_ADMIN"
)

// Identity is the resolved caller: app user id (may be empty for admins with no checkout.users
// row) plus the partner role claims.
type Identity struct {
	UserID    string
	Role      string
	SellerID  string
	StateCode string
}

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

// Middleware returns a chi-compatible middleware that attaches the caller identity to the
// request context. It never rejects here; use Require / RequireRole on protected routes.
func Middleware(cfg Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := Identity{}
			if cfg.Disabled {
				id.UserID = strings.TrimSpace(r.Header.Get("X-Dev-User"))
				if id.UserID == "" {
					id.UserID = cfg.DevUserID
				}
				id.Role = strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Dev-Role")))
				id.SellerID = strings.TrimSpace(r.Header.Get("X-Dev-Seller"))
				id.StateCode = strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Dev-State")))
			} else if claims, err := claimsFromRequest(r, cfg.JWTSecret); err == nil {
				if cfg.Resolver != nil {
					if resolved, rerr := cfg.Resolver.ResolveUserID(r.Context(), claims.Sub); rerr == nil {
						id.UserID = resolved
					}
				}
				id.Role = claims.appRole()
				id.SellerID = claims.sellerID()
				id.StateCode = claims.stateCode()
			}
			if id.UserID != "" || id.Role != "" || id.SellerID != "" {
				ctx := context.WithValue(r.Context(), identityKey{}, id)
				if id.UserID != "" {
					ctx = context.WithValue(ctx, ctxKey{}, id.UserID)
				}
				r = r.WithContext(ctx)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Require rejects unauthenticated requests (no resolved app user id).
func Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if UserID(r.Context()) == "" {
			unauthorized(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireRole rejects callers whose app_role is not one of roles. A resolved app user id with no
// role is not accepted (partner routes are role-gated).
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[strings.ToUpper(role)] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, ok := allowed[Role(r.Context())]; !ok {
				unauthorized(w)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"error":"authentication required","code":"unauthorized"}`))
}

// UserID returns the resolved app user id, or "" when unauthenticated.
func UserID(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKey{}).(string); ok {
		return v
	}
	return ""
}

// Role returns the caller's app_role, or "".
func Role(ctx context.Context) string {
	if id, ok := ctx.Value(identityKey{}).(Identity); ok {
		return id.Role
	}
	return ""
}

// SellerID returns the caller's seller_id claim, or "".
func SellerID(ctx context.Context) string {
	if id, ok := ctx.Value(identityKey{}).(Identity); ok {
		return id.SellerID
	}
	return ""
}

// StateCode returns the caller's state_code claim, or "".
func StateCode(ctx context.Context) string {
	if id, ok := ctx.Value(identityKey{}).(Identity); ok {
		return id.StateCode
	}
	return ""
}

// IsAdmin reports whether the caller is a state or super admin.
func IsAdmin(ctx context.Context) bool {
	switch Role(ctx) {
	case RoleStateAdmin, RoleSuperAdmin:
		return true
	default:
		return false
	}
}

// CanActForSeller reports whether the caller may act on the given seller's data: the seller
// themself, a super admin, or a state admin whose state matches.
func CanActForSeller(ctx context.Context, sellerID, stateCode string) bool {
	switch Role(ctx) {
	case RoleSuperAdmin:
		return true
	case RoleStateAdmin:
		return StateCode(ctx) != "" && StateCode(ctx) == stateCode
	case RoleSeller:
		return SellerID(ctx) != "" && SellerID(ctx) == sellerID
	default:
		return false
	}
}

var errNoToken = errors.New("no token")

// jwtClaims is the subset of a Supabase JWT we read.
type jwtClaims struct {
	Sub         string `json:"sub"`
	Exp         int64  `json:"exp"`
	AppRole     string `json:"app_role"`
	SellerID    string `json:"seller_id"`
	StateCode   string `json:"state_code"`
	AppMetadata struct {
		AppRole   string `json:"app_role"`
		Role      string `json:"role"`
		SellerID  string `json:"seller_id"`
		StateCode string `json:"state_code"`
	} `json:"app_metadata"`
}

func (c jwtClaims) appRole() string {
	if c.AppRole != "" {
		return strings.ToUpper(c.AppRole)
	}
	if c.AppMetadata.AppRole != "" {
		return strings.ToUpper(c.AppMetadata.AppRole)
	}
	switch strings.ToUpper(c.AppMetadata.Role) {
	case RoleSeller, RoleStateAdmin, RoleSuperAdmin:
		return strings.ToUpper(c.AppMetadata.Role)
	}
	return ""
}

func (c jwtClaims) sellerID() string {
	if c.SellerID != "" {
		return c.SellerID
	}
	return c.AppMetadata.SellerID
}

func (c jwtClaims) stateCode() string {
	if c.StateCode != "" {
		return strings.ToUpper(c.StateCode)
	}
	return strings.ToUpper(c.AppMetadata.StateCode)
}

func claimsFromRequest(r *http.Request, secret []byte) (jwtClaims, error) {
	if len(secret) == 0 {
		return jwtClaims{}, errors.New("auth secret not configured")
	}
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return jwtClaims{}, errNoToken
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return jwtClaims{}, errors.New("malformed token")
	}
	signingInput := parts[0] + "." + parts[1]
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return jwtClaims{}, errors.New("bad signature encoding")
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingInput))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return jwtClaims{}, errors.New("signature mismatch")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return jwtClaims{}, errors.New("bad payload encoding")
	}
	var claims jwtClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return jwtClaims{}, errors.New("bad claims")
	}
	if claims.Exp != 0 && time.Unix(claims.Exp, 0).Before(time.Now()) {
		return jwtClaims{}, errors.New("token expired")
	}
	if claims.Sub == "" {
		return jwtClaims{}, errors.New("no subject")
	}
	return claims, nil
}
