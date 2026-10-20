package portal

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/auth"
)

func TestMintAccessVerifies(t *testing.T) {
	m := NewMinter("portal-secret")
	token, jti, exp, err := m.MintAccess("pu-super-1", auth.RoleSuperAdmin, false)
	if err != nil {
		t.Fatal(err)
	}
	if jti == "" || !strings.HasPrefix(token, "eyJ") {
		t.Fatalf("unexpected token/jti: %q %q", token, jti)
	}
	if time.Until(exp) < AccessTTL-time.Minute {
		t.Fatalf("unexpected expiry: %v", exp)
	}

	v := auth.NewPortalVerifier([]byte("portal-secret"), nil)
	claims, err := v.Verify(context.Background(), token)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.Sub != "pu-super-1" || claims.AppRole != auth.RoleSuperAdmin || claims.Jti != jti || !claims.Portal {
		t.Fatalf("unexpected claims: %+v", claims)
	}

	if _, err := auth.NewPortalVerifier([]byte("wrong-secret"), nil).Verify(context.Background(), token); err == nil {
		t.Fatal("wrong secret verified")
	}
}

func TestExpiredAccessRejected(t *testing.T) {
	m := NewMinter("portal-secret")
	m.now = func() time.Time { return time.Now().Add(-2 * AccessTTL) }
	token, _, _, err := m.MintAccess("pu-super-1", auth.RoleSuperAdmin, true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := auth.NewPortalVerifier([]byte("portal-secret"), nil).Verify(context.Background(), token); err == nil {
		t.Fatal("expired token verified")
	}
}

func TestRefreshTokenShape(t *testing.T) {
	raw, hash, err := NewRefresh()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(raw, "faazio_pr_") {
		t.Fatalf("unexpected refresh prefix: %s", raw)
	}
	if len(hash) != 64 || hash != HashRefresh(raw) {
		t.Fatal("refresh hash is not stable sha256 hex")
	}
	again, _, err := NewRefresh()
	if err != nil {
		t.Fatal(err)
	}
	if raw == again {
		t.Fatal("refresh tokens must be unique")
	}
}
