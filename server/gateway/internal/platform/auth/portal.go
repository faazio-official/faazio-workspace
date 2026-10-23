package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/geo"
)

// Portal token contract — a distinct issuer/audience from Firebase and legacy Supabase tokens.
const (
	PortalIssuer   = "faazio-portal"
	PortalAudience = "portal"
)

// PortalVerifier validates the gateway-native portal access JWT (HS256) minted by
// internal/portal. It pins iss/aud/exp/app_role and checks the logout jti denylist.
type PortalVerifier struct {
	secret []byte
	cache  *cache.Cache
}

// NewPortalVerifier builds a verifier. A nil cache simply means logout cannot denylist an
// already-issued token (documented Valkey-off degradation).
func NewPortalVerifier(secret []byte, c *cache.Cache) *PortalVerifier {
	return &PortalVerifier{secret: secret, cache: c}
}

// Verify checks the signature + claims. Any malformation is a hard failure (no partial acceptance).
func (v *PortalVerifier) Verify(ctx context.Context, token string) (jwtClaims, error) {
	if len(v.secret) == 0 {
		return jwtClaims{}, errors.New("portal verifier not configured")
	}
	if token == "" {
		return jwtClaims{}, errNoToken
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return jwtClaims{}, errors.New("malformed portal token")
	}
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return jwtClaims{}, errors.New("bad portal header")
	}
	var header struct {
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil || header.Alg != "HS256" {
		return jwtClaims{}, errors.New("bad portal alg")
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return jwtClaims{}, errors.New("bad portal signature encoding")
	}
	mac := hmac.New(sha256.New, v.secret)
	mac.Write([]byte(parts[0] + "." + parts[1]))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return jwtClaims{}, errors.New("portal signature mismatch")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return jwtClaims{}, errors.New("bad portal payload encoding")
	}
	var claims jwtClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return jwtClaims{}, errors.New("bad portal claims")
	}
	if claims.Iss != PortalIssuer || claims.Aud != PortalAudience {
		return jwtClaims{}, errors.New("portal issuer/audience mismatch")
	}
	if claims.Exp == 0 || time.Unix(claims.Exp, 0).Before(time.Now()) {
		return jwtClaims{}, errors.New("portal token expired")
	}
	if claims.Sub == "" || claims.Jti == "" {
		return jwtClaims{}, errors.New("portal token missing subject/jti")
	}
	role := strings.ToUpper(strings.TrimSpace(claims.AppRole))
	claims.AppRole = role
	switch role {
	case RoleSuperAdmin:
		// Seeded operational accounts; no scope.
	case RoleSeller:
		claims.SellerID = strings.TrimSpace(claims.SellerID)
		if claims.SellerID == "" {
			return jwtClaims{}, errors.New("portal seller token missing seller_id")
		}
	case RoleDistrictAdmin:
		claims.DistrictCode = geo.Normalise(claims.DistrictCode)
		claims.StateCode = strings.ToUpper(strings.TrimSpace(claims.StateCode))
		if claims.DistrictCode != "" {
			if !geo.IsValid(claims.DistrictCode) {
				return jwtClaims{}, errors.New("portal token has an unknown district_code")
			}
			if claims.StateCode == "" {
				claims.StateCode = geo.StateForDistrict(claims.DistrictCode)
			}
		}
		// Legacy state-scoped admins (created before the district rollout) carry only state_code.
		if claims.DistrictCode == "" && len(claims.StateCode) != 2 {
			return jwtClaims{}, errors.New("portal district-admin token missing district_code/state_code")
		}
	default:
		return jwtClaims{}, errors.New("portal token role not allowed")
	}
	if v.cache != nil && v.cache.Exists(ctx, cache.PortalDeny(claims.Jti)) {
		return jwtClaims{}, errors.New("portal token revoked")
	}
	claims.Portal = true
	return claims, nil
}
