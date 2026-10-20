package portal

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/auth"
)

// Token contract (docs/architecture/web-portal.md): distinct iss/aud so a portal token can never be
// mistaken for a Firebase ID token or a legacy Supabase JWT.
const (
	TokenIssuer   = auth.PortalIssuer
	TokenAudience = auth.PortalAudience
	// AccessTTL is deliberately short: a stolen bearer token is useful for minutes, not hours.
	AccessTTL = 15 * time.Minute
	// RefreshTTL is the sliding lifetime of an opaque refresh session.
	RefreshTTL    = 30 * 24 * time.Hour
	refreshPrefix = "faazio_pr_"
)

// Minter signs access JWTs and mints opaque refresh tokens.
type Minter struct {
	secret []byte
	now    func() time.Time
}

// NewMinter builds a minter. An empty secret disables portal login at the handler layer.
func NewMinter(secret string) *Minter {
	return &Minter{secret: []byte(secret), now: time.Now}
}

// Enabled reports whether a signing secret is configured.
func (m *Minter) Enabled() bool { return m != nil && len(m.secret) > 0 }

// MintAccess returns a signed HS256 access JWT and its jti/expiry.
func (m *Minter) MintAccess(userID, role string, mustChange bool) (token, jti string, expiresAt time.Time, err error) {
	if !m.Enabled() {
		return "", "", time.Time{}, errors.New("portal: jwt secret not configured")
	}
	jti, err = randomHex(16)
	if err != nil {
		return "", "", time.Time{}, err
	}
	now := m.now().UTC()
	exp := now.Add(AccessTTL)
	header, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	claims, _ := json.Marshal(map[string]any{
		"iss":         TokenIssuer,
		"aud":         TokenAudience,
		"sub":         userID,
		"app_role":    role,
		"jti":         jti,
		"must_change": mustChange,
		"iat":         now.Unix(),
		"exp":         exp.Unix(),
	})
	signing := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(claims)
	mac := hmac.New(sha256.New, m.secret)
	mac.Write([]byte(signing))
	return signing + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), jti, exp, nil
}

// NewRefresh returns a raw opaque refresh token (given to the client) and its SHA-256 hash (stored).
func NewRefresh() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("portal: refresh token: %w", err)
	}
	raw = refreshPrefix + base64.RawURLEncoding.EncodeToString(b)
	return raw, HashRefresh(raw), nil
}

// HashRefresh is the at-rest representation of a refresh token.
func HashRefresh(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// newSessionID returns a refresh-family id.
func newSessionID() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "ps-" + hex.EncodeToString(b), nil
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// RoleSuperAdmin is the only role the portal credential store issues today.
const RoleSuperAdmin = auth.RoleSuperAdmin
