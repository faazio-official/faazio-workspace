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

func TestOTPSigned(t *testing.T) {
	with := func(id Identity) context.Context { return context.WithValue(context.Background(), identityKey{}, id) }

	cases := []struct {
		name  string
		id    Identity
		phone string
		want  bool
	}{
		{"matching e.164 phone", Identity{Phone: "+919876543210"}, "9876543210", true},
		{"matching with spaces", Identity{Phone: "+91 98765 43210"}, " 9 8 7 6 5 4 3 2 1 0 ", true},
		{"mismatched phone", Identity{Phone: "+919999999999"}, "9876543210", false},
		{"no verified phone", Identity{UserID: "u-1"}, "9876543210", false},
		{"short phone never matches", Identity{Phone: "+91987"}, "9876543210", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := OTPSigned(with(tc.id), tc.phone); got != tc.want {
				t.Fatalf("OTPSigned = %v, want %v", got, tc.want)
			}
		})
	}

	if OTPSigned(context.Background(), "9876543210") {
		t.Fatal("no identity must never sign an OTP")
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

func TestRequireRoleStatusCodes(t *testing.T) {
	h := RequireRole(RoleSeller, RoleDistrictAdmin)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Anonymous (no identity on the context) → 401: the client must sign in.
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status = %d, want 401", rec.Code)
	}

	// Authenticated with no app role (e.g. a shopper) → 403: known caller, missing privilege.
	rec = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(WithIdentity(req.Context(), Identity{UserID: "u-1"}))
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("no-role status = %d, want 403", rec.Code)
	}

	// Authenticated with a disallowed role → 403.
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(WithIdentity(req.Context(), Identity{UserID: "u-1", Role: RoleSuperAdmin}))
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("wrong-role status = %d, want 403", rec.Code)
	}

	// Authenticated with an allowed role → passes through.
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(WithIdentity(req.Context(), Identity{UserID: "u-1", Role: RoleSeller}))
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("allowed-role status = %d, want 200", rec.Code)
	}
}

func TestPortalMustChangeIsConfined(t *testing.T) {
	secret := []byte("portal-secret")
	newToken := func(role string, extra map[string]any) string {
		claims := map[string]any{
			"sub":         "pu-1",
			"iss":         PortalIssuer,
			"aud":         PortalAudience,
			"app_role":    role,
			"jti":         "jti-1",
			"must_change": true,
			"exp":         time.Now().Add(time.Hour).Unix(),
		}
		for k, v := range extra {
			claims[k] = v
		}
		return signHS256(t, secret, claims)
	}
	h := Middleware(Config{Portal: NewPortalVerifier(secret, nil)})(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }),
	)

	t.Run("scoped role is confined", func(t *testing.T) {
		token := newToken(RoleSeller, map[string]any{"seller_id": "slr-1"})
		blocked := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/admin/state/sellers", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		h.ServeHTTP(blocked, req)
		if blocked.Code != http.StatusForbidden {
			t.Fatalf("control-plane status = %d, want 403", blocked.Code)
		}

		allowed := httptest.NewRecorder()
		req = httptest.NewRequest(http.MethodPut, "/auth/portal/password", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		h.ServeHTTP(allowed, req)
		if allowed.Code != http.StatusOK {
			t.Fatalf("password route status = %d, want 200", allowed.Code)
		}
	})

	t.Run("superadmin is exempt", func(t *testing.T) {
		token := newToken(RoleSuperAdmin, nil)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/admin/state/sellers", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("superadmin control-plane status = %d, want 200", rec.Code)
		}
	})
}

func TestWithIdentitySetsRole(t *testing.T) {
	ctx := WithIdentity(context.Background(), Identity{Role: RoleDistrictAdmin})
	if got := Role(ctx); got != RoleDistrictAdmin {
		t.Fatalf("role = %q, want %q", got, RoleDistrictAdmin)
	}
}

func TestCanActForDistrict(t *testing.T) {
	districtAdmin := context.WithValue(context.Background(), identityKey{}, Identity{
		Role: RoleDistrictAdmin, StateCode: "TN", DistrictCode: "TCH",
	})
	legacyStateAdmin := context.WithValue(context.Background(), identityKey{}, Identity{
		Role: RoleDistrictAdmin, StateCode: "TN",
	})
	superAdmin := context.WithValue(context.Background(), identityKey{}, Identity{Role: RoleSuperAdmin})

	cases := []struct {
		name                string
		ctx                 context.Context
		district, stateCode string
		want                bool
	}{
		{"district match", districtAdmin, "TCH", "TN", true},
		{"other district", districtAdmin, "TCO", "TN", false},
		{"row without district is not claimable", districtAdmin, "", "TN", false},
		{"legacy state admin falls back to state", legacyStateAdmin, "TCO", "TN", true},
		{"legacy state admin other state", legacyStateAdmin, "TCO", "KA", false},
		{"super admin anywhere", superAdmin, "TCO", "KA", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := CanActForDistrict(tc.ctx, tc.district, tc.stateCode); got != tc.want {
				t.Fatalf("CanActForDistrict = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestCanActForSellerDistrict(t *testing.T) {
	ctx := context.WithValue(context.Background(), identityKey{}, Identity{
		Role: RoleDistrictAdmin, StateCode: "TN", DistrictCode: "TCH",
	})
	cases := []struct {
		name                string
		district, stateCode string
		want                bool
	}{
		{"same district", "TCH", "TN", true},
		{"other district", "TCO", "TN", false},
		{"legacy seller without district", "", "TN", true},
		{"legacy seller in another state", "", "KA", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := CanActForSellerDistrict(ctx, "sel-1", tc.district, tc.stateCode); got != tc.want {
				t.Fatalf("CanActForSellerDistrict = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestCanActForState(t *testing.T) {
	districtAdmin := context.WithValue(context.Background(), identityKey{}, Identity{
		Role: RoleDistrictAdmin, StateCode: "TN", DistrictCode: "TCH",
	})
	superAdmin := context.WithValue(context.Background(), identityKey{}, Identity{Role: RoleSuperAdmin})
	seller := context.WithValue(context.Background(), identityKey{}, Identity{Role: RoleSeller, SellerID: "sel-1"})

	cases := []struct {
		name      string
		ctx       context.Context
		stateCode string
		want      bool
	}{
		{"district admin same state", districtAdmin, "TN", true},
		{"district admin other state", districtAdmin, "KA", false},
		{"district admin unscoped row", districtAdmin, "", false},
		{"super admin anywhere", superAdmin, "KA", true},
		{"seller is not an admin", seller, "TN", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := CanActForState(tc.ctx, tc.stateCode); got != tc.want {
				t.Fatalf("CanActForState = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestAdminScope(t *testing.T) {
	cases := []struct {
		name         string
		ctx          context.Context
		wantDistrict string
		wantSuper    bool
		wantOK       bool
	}{
		{
			name:      "super admin sees all",
			ctx:       context.WithValue(context.Background(), identityKey{}, Identity{Role: RoleSuperAdmin}),
			wantSuper: true, wantOK: true,
		},
		{
			name:         "district admin is district scoped",
			ctx:          context.WithValue(context.Background(), identityKey{}, Identity{Role: RoleDistrictAdmin, DistrictCode: "TCH"}),
			wantDistrict: "TCH", wantOK: true,
		},
		{
			name: "district admin without district is denied",
			ctx:  context.WithValue(context.Background(), identityKey{}, Identity{Role: RoleDistrictAdmin, StateCode: "TN"}),
		},
		{
			name: "seller is not an admin",
			ctx:  context.WithValue(context.Background(), identityKey{}, Identity{Role: RoleSeller, SellerID: "sel-1"}),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			district, super, ok := AdminScope(tc.ctx)
			if district != tc.wantDistrict || super != tc.wantSuper || ok != tc.wantOK {
				t.Fatalf("AdminScope = (%q, %v, %v), want (%q, %v, %v)",
					district, super, ok, tc.wantDistrict, tc.wantSuper, tc.wantOK)
			}
		})
	}
}

func TestRequireSellerOwner(t *testing.T) {
	h := RequireSellerOwner(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	cases := []struct {
		name string
		id   Identity
		want int
	}{
		{"owner seller", Identity{Role: RoleSeller, SellerID: "s1"}, http.StatusOK},
		{"staff sub-user", Identity{Role: RoleSeller, SellerID: "s1", SubRole: "STAFF"}, http.StatusForbidden},
		{"viewer sub-user", Identity{Role: RoleSeller, SellerID: "s1", SubRole: "VIEWER"}, http.StatusForbidden},
		{"district admin", Identity{Role: RoleDistrictAdmin, DistrictCode: "TCH", StateCode: "TN"}, http.StatusOK},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/seller/sub-users", nil)
		h.ServeHTTP(rec, req.WithContext(WithIdentity(context.Background(), tc.id)))
		if rec.Code != tc.want {
			t.Fatalf("%s: status=%d want=%d", tc.name, rec.Code, tc.want)
		}
	}
}

func TestEnforceSubUserReadOnly(t *testing.T) {
	h := EnforceSubUserReadOnly()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	cases := []struct {
		name, method, path, subRole string
		want                        int
	}{
		{"viewer GET", http.MethodGet, "/seller/inventory", "VIEWER", http.StatusOK},
		{"viewer write", http.MethodPut, "/seller/inventory/p1", "VIEWER", http.StatusForbidden},
		{"viewer delete", http.MethodDelete, "/seller/products/p1", "VIEWER", http.StatusForbidden},
		{"viewer password", http.MethodPut, "/auth/portal/password", "VIEWER", http.StatusOK},
		{"viewer logout", http.MethodPost, "/auth/portal/logout", "VIEWER", http.StatusOK},
		{"staff write", http.MethodPut, "/seller/inventory/p1", "STAFF", http.StatusOK},
		{"owner write", http.MethodPut, "/seller/inventory/p1", "", http.StatusOK},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(tc.method, tc.path, nil)
		ctx := WithIdentity(context.Background(), Identity{Role: RoleSeller, SellerID: "s1", SubRole: tc.subRole})
		h.ServeHTTP(rec, req.WithContext(ctx))
		if rec.Code != tc.want {
			t.Fatalf("%s: status=%d want=%d", tc.name, rec.Code, tc.want)
		}
	}
}
