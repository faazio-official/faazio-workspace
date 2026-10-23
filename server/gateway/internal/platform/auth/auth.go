// Package auth verifies caller tokens (Firebase ID tokens for the mobile app; legacy Supabase
// HS256 for the partner portal) and resolves the app user id + role claims. Platform code carries
// no domain knowledge: the auth_uid → app user_id mapping is injected as a UserResolver by the
// checkout context.
//
// Partner roles (portal) travel as custom JWT claims — `app_role`, `seller_id`, `state_code`,
// `district_code` — either top-level or under `app_metadata`. The retired `STATE_ADMIN` spelling is
// canonicalised to `DISTRICT_ADMIN` on read. In local dev (AUTH_DISABLED) they come from the
// `X-Dev-Role` / `X-Dev-Seller` / `X-Dev-State` / `X-Dev-District` headers so integration tests can
// act as any role.
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

	"github.com/faazio/server/gateway/internal/platform/geo"
)

type ctxKey struct{}
type identityKey struct{}

// Role constants (mirror the portal's Role union).
const (
	RoleSeller = "SELLER"
	// RoleDistrictAdmin is the scoped partner admin: one district (state_code is still minted as the
	// coarse parent scope for legacy read models).
	RoleDistrictAdmin = "DISTRICT_ADMIN"
	// RoleStateAdmin is the deprecated spelling kept as an alias so existing call sites and tests
	// keep compiling; the wire value is DISTRICT_ADMIN.
	RoleStateAdmin = RoleDistrictAdmin
	RoleSuperAdmin = "SUPER_ADMIN"
)

// canonicalRole maps the retired STATE_ADMIN wiring value onto its DISTRICT_ADMIN replacement so
// legacy tokens, dev headers and old tests keep working after the rename.
func canonicalRole(raw string) string {
	role := strings.ToUpper(strings.TrimSpace(raw))
	if role == "STATE_ADMIN" {
		return RoleDistrictAdmin
	}
	return role
}

// Identity is the resolved caller: app user id (may be empty for admins with no checkout.users
// row) plus the partner role claims.
type Identity struct {
	UserID       string
	Role         string
	SellerID     string
	StateCode    string
	DistrictCode string
	// Jti is the access-token id (portal tokens only) — used for logout denylisting.
	Jti string
	// Portal marks a gateway-native portal session (sub is a admins.portal_users id, not an app
	// user id), so the middleware never tries to resolve it against checkout.users.
	Portal bool
	// MustChange is set when a portal user still has the initial password; every route except
	// /auth/portal/* is refused until they rotate it. SUPER_ADMIN is never issued a forced
	// rotation, so this is only ever set for SELLER/STATE_ADMIN.
	MustChange bool
	// Phone is the verified `phone_number` claim of a Firebase ID token. Empty for portal/legacy
	// tokens and for the dev X-Dev-* cheat headers — a caller with an empty Phone has no
	// server-verified phone, so OTPSigned must reject them in production.
	Phone string
	// Dev marks an AUTH_DISABLED identity. Dev identities trust the client assertion (the whole
	// identity comes from X-Dev-* headers); production never sets this flag.
	Dev bool
}

// UserResolver maps a verified auth subject (Firebase UID / legacy auth.uid) to an app user slug.
type UserResolver interface {
	ResolveUserID(ctx context.Context, authUID string) (string, error)
}

// UserProvisioner is the optional stronger contract: resolve-or-create. Phone-OTP users have no
// pre-existing checkout.users row, so the checkout resolver implements this to link the subject on
// first authenticated call (and record the phone/email from the verified token).
type UserProvisioner interface {
	ProvisionUserID(ctx context.Context, authUID, phone, email string) (string, error)
}

// Config is the auth middleware configuration.
type Config struct {
	Disabled  bool
	DevUserID string
	// JWTSecret verifies legacy Supabase/GoTrue HS256 tokens (portal partners). Mobile phone
	// OTP uses Firebase and is verified by Firebase when set.
	JWTSecret []byte
	Firebase  *FirebaseVerifier
	// Portal verifies gateway-native portal tokens (HS256, iss/aud pinned; role + scope checked). Distinct
	// from JWTSecret so a portal token can never pass the legacy GoTrue verifier.
	Portal   *PortalVerifier
	Resolver UserResolver
}

// Middleware returns a chi-compatible middleware that attaches the caller identity to the
// request context. The one exception is a portal session that still has the initial password:
// it is confined to /auth/portal/* so a shared default can never reach the control plane.
// SUPER_ADMIN is exempt: it is never issued a forced rotation (see portal.defaultForceChange).
func Middleware(cfg Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := Identity{}
			if cfg.Disabled {
				id.UserID = strings.TrimSpace(r.Header.Get("X-Dev-User"))
				if id.UserID == "" {
					id.UserID = cfg.DevUserID
				}
				id.Role = canonicalRole(r.Header.Get("X-Dev-Role"))
				id.SellerID = strings.TrimSpace(r.Header.Get("X-Dev-Seller"))
				id.StateCode = strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Dev-State")))
				id.DistrictCode = geo.Normalise(r.Header.Get("X-Dev-District"))
				id.Dev = true
			} else if claims, err := verifyToken(r, cfg); err == nil {
				if claims.Portal {
					// A portal subject is already the portal user id (never an app user id).
					id.UserID = claims.Sub
					id.Portal = true
				} else if cfg.Resolver != nil {
					// Prefer resolve-or-create so a first phone-OTP login links auth.users.id →
					// checkout.users without a portal/manual row; fall back to read-only resolution.
					if p, ok := cfg.Resolver.(UserProvisioner); ok {
						if resolved, rerr := p.ProvisionUserID(r.Context(), claims.Sub, claims.Phone, claims.Email); rerr == nil {
							id.UserID = resolved
						}
					} else if resolved, rerr := cfg.Resolver.ResolveUserID(r.Context(), claims.Sub); rerr == nil {
						id.UserID = resolved
					}
				}
				id.Role = claims.appRole()
				id.SellerID = claims.sellerID()
				id.StateCode = claims.stateCode()
				id.DistrictCode = claims.districtCode()
				id.Jti = claims.Jti
				id.MustChange = claims.MustChange
				id.Phone = claims.Phone
			}
			if id.Portal && id.MustChange && id.Role != RoleSuperAdmin && !strings.HasPrefix(r.URL.Path, "/auth/portal/") {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusForbidden)
				_, _ = w.Write([]byte(`{"error":"password change required","code":"password_change_required"}`))
				return
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

// DistrictCode returns the caller's district_code claim, or "" for state-scoped legacy admins.
func DistrictCode(ctx context.Context) string {
	if id, ok := ctx.Value(identityKey{}).(Identity); ok {
		return id.DistrictCode
	}
	return ""
}

// Jti returns the access-token id (portal sessions only), or "".
func Jti(ctx context.Context) string {
	if id, ok := ctx.Value(identityKey{}).(Identity); ok {
		return id.Jti
	}
	return ""
}

// IsPortal reports whether the caller authenticated with a gateway-native portal token.
func IsPortal(ctx context.Context) bool {
	if id, ok := ctx.Value(identityKey{}).(Identity); ok {
		return id.Portal
	}
	return false
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
// themself, a super admin, or a district/state admin whose scope matches.
func CanActForSeller(ctx context.Context, sellerID, stateCode string) bool {
	switch Role(ctx) {
	case RoleSuperAdmin:
		return true
	case RoleDistrictAdmin:
		return StateCode(ctx) != "" && StateCode(ctx) == stateCode
	case RoleSeller:
		return SellerID(ctx) != "" && SellerID(ctx) == sellerID
	default:
		return false
	}
}

// CanActForSellerDistrict is the district-precise predicate used by the sellers context. A district
// admin with a district claim may only act on sellers in that district; a legacy state-scoped admin
// (district claim empty) falls back to the state match. Super admins may act anywhere.
func CanActForSellerDistrict(ctx context.Context, sellerID, districtCode, stateCode string) bool {
	switch Role(ctx) {
	case RoleSuperAdmin:
		return true
	case RoleDistrictAdmin:
		// A district claim is authoritative when the seller has a district; legacy sellers without
		// one still fall back to the parent-state match (migration 0047 backfill is best-effort).
		if d := DistrictCode(ctx); d != "" && districtCode != "" {
			return d == districtCode
		}
		return StateCode(ctx) != "" && StateCode(ctx) == stateCode
	case RoleSeller:
		return SellerID(ctx) != "" && SellerID(ctx) == sellerID
	default:
		return false
	}
}

// OTPSigned reports whether the caller's identity carries a server-verified phone that matches the
// given contact phone. The OTP is the "digital signature" on a seller application: trusting a
// client-asserted `otpVerified` flag without binding it to a verified phone would let any caller
// sign an application for an arbitrary contact phone. Dev mode (AUTH_DISABLED) always reports true
// — the whole identity comes from the X-Dev-* cheat headers and is never production.
func OTPSigned(ctx context.Context, contactPhone string) bool {
	id, ok := ctx.Value(identityKey{}).(Identity)
	if !ok {
		return false
	}
	if id.Dev {
		return true
	}
	if id.Phone == "" {
		return false
	}
	return samePhone(id.Phone, contactPhone)
}

// samePhone compares two phone strings by their trailing 10 digits (robust to +91, spaces, dashes).
func samePhone(a, b string) bool {
	da, db := phoneDigits(a), phoneDigits(b)
	if len(da) < 10 || len(db) < 10 {
		return false
	}
	return da[len(da)-10:] == db[len(db)-10:]
}

// phoneDigits keeps only the digits of a phone string.
func phoneDigits(v string) string {
	var b strings.Builder
	for _, r := range v {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

var errNoToken = errors.New("no token")

// jwtClaims is the subset of a verified JWT we read.
type jwtClaims struct {
	Sub          string `json:"sub"`
	Exp          int64  `json:"exp"`
	Iss          string `json:"iss"`
	Aud          string `json:"aud"`
	Jti          string `json:"jti"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	AppRole      string `json:"app_role"`
	SellerID     string `json:"seller_id"`
	StateCode    string `json:"state_code"`
	DistrictCode string `json:"district_code"`
	AppMetadata  struct {
		AppRole      string `json:"app_role"`
		Role         string `json:"role"`
		SellerID     string `json:"seller_id"`
		StateCode    string `json:"state_code"`
		DistrictCode string `json:"district_code"`
	} `json:"app_metadata"`
	// MustChange confines a first-login portal session to the password-change routes.
	MustChange bool `json:"must_change"`
	// Portal marks a gateway-native portal token (never serialized from the wire).
	Portal bool `json:"-"`
}

func (c jwtClaims) appRole() string {
	if c.AppRole != "" {
		return canonicalRole(c.AppRole)
	}
	if c.AppMetadata.AppRole != "" {
		return canonicalRole(c.AppMetadata.AppRole)
	}
	role := canonicalRole(c.AppMetadata.Role)
	switch role {
	case RoleSeller, RoleDistrictAdmin, RoleSuperAdmin:
		return role
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

func (c jwtClaims) districtCode() string {
	if c.DistrictCode != "" {
		return geo.Normalise(c.DistrictCode)
	}
	return geo.Normalise(c.AppMetadata.DistrictCode)
}

// verifyToken accepts a Firebase ID token when configured, then falls back to the legacy
// Supabase/GoTrue HS256 verifier so the partner portal keeps working during the migration.
// A token must still pass one full signature+claim check; the fallback is not a bypass.
func verifyToken(r *http.Request, cfg Config) (jwtClaims, error) {
	if cfg.Firebase != nil {
		claims, err := cfg.Firebase.Verify(r.Context(), tokenFromRequest(r))
		if err == nil {
			return claims, nil
		}
		if len(cfg.JWTSecret) == 0 && cfg.Portal == nil {
			return jwtClaims{}, err
		}
	}
	if cfg.Portal != nil {
		claims, err := cfg.Portal.Verify(r.Context(), tokenFromRequest(r))
		if err == nil {
			return claims, nil
		}
		if len(cfg.JWTSecret) == 0 {
			return jwtClaims{}, err
		}
	}
	return claimsFromRequest(r, cfg.JWTSecret)
}

// tokenFromRequest returns the raw bearer token (empty when absent); Firebase verification
// reports the malformed/missing-token error itself.
func tokenFromRequest(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
}

func bearerToken(r *http.Request) (string, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return "", errNoToken
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if token == "" {
		return "", errNoToken
	}
	return token, nil
}

func claimsFromRequest(r *http.Request, secret []byte) (jwtClaims, error) {
	if len(secret) == 0 {
		return jwtClaims{}, errors.New("auth secret not configured")
	}
	token, err := bearerToken(r)
	if err != nil {
		return jwtClaims{}, err
	}
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

// Phone returns the verified `phone_number` claim (E.164), or "" for anonymous/legacy/dev callers.
func Phone(ctx context.Context) string {
	if id, ok := ctx.Value(identityKey{}).(Identity); ok {
		return id.Phone
	}
	return ""
}

// Dev reports whether the identity came from AUTH_DISABLED X-Dev-* headers. Production is always false.
func Dev(ctx context.Context) bool {
	if id, ok := ctx.Value(identityKey{}).(Identity); ok {
		return id.Dev
	}
	return false
}
