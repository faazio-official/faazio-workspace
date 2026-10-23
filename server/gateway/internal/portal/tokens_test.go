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
	token, jti, exp, err := m.MintAccess("pu-super-1", auth.RoleSuperAdmin, "", "", "", false)
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

func TestScopedAccessTokens(t *testing.T) {
	m := NewMinter("portal-secret")
	v := auth.NewPortalVerifier([]byte("portal-secret"), nil)

	seller, _, _, err := m.MintAccess("pu-seller-1", auth.RoleSeller, "slr-1", "", "", false)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := v.Verify(context.Background(), seller)
	if err != nil {
		t.Fatalf("seller verify: %v", err)
	}
	if claims.AppRole != auth.RoleSeller || claims.SellerID != "slr-1" {
		t.Fatalf("unexpected seller claims: %+v", claims)
	}

	state, _, _, err := m.MintAccess("pu-district-1", auth.RoleDistrictAdmin, "", "tch", "tn", false)
	if err != nil {
		t.Fatal(err)
	}
	claims, err = v.Verify(context.Background(), state)
	if err != nil {
		t.Fatalf("state verify: %v", err)
	}
	if claims.StateCode != "TN" || claims.DistrictCode != "TCH" {
		t.Fatalf("district/state scope not normalized: %+v", claims)
	}

	noScope, _, _, err := m.MintAccess("pu-seller-2", auth.RoleSeller, "", "", "", false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := v.Verify(context.Background(), noScope); err == nil {
		t.Fatal("seller token without seller_id verified")
	}
}

func TestExpiredAccessRejected(t *testing.T) {
	m := NewMinter("portal-secret")
	m.now = func() time.Time { return time.Now().Add(-2 * AccessTTL) }
	token, _, _, err := m.MintAccess("pu-super-1", auth.RoleSuperAdmin, "", "", "", true)
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
