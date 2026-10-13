package sellers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func handlerRouter(t *testing.T, pool *pgxpool.Pool) http.Handler {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(auth.Middleware(auth.Config{Disabled: true, DevUserID: "user-1"}))
	NewHandler(New(pool), c, nil).Register(r)
	return r
}

func do(t *testing.T, h http.Handler, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestSellerRoleGating(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)

	// Onboarding (any authenticated caller) creates a PENDING_REVIEW seller.
	create := do(t, h, http.MethodPost, "/sellers",
		`{"businessName":"Gate Test","ownerName":"O","category":"FOOD","stateCode":"KA"}`, nil)
	if create.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", create.Code, create.Body.String())
	}
	var created Seller
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from sellers.sellers where seller_id=$1`, created.SellerID)
	})

	// Unauthenticated role (no app_role) cannot read the seller directory.
	if rec := do(t, h, http.MethodGet, "/sellers/"+created.SellerID, "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no-role read status = %d, want 401", rec.Code)
	}

	// The seller themself can read.
	self := do(t, h, http.MethodGet, "/sellers/"+created.SellerID, "",
		map[string]string{"X-Dev-Role": "SELLER", "X-Dev-Seller": created.SellerID})
	if self.Code != http.StatusOK {
		t.Fatalf("seller read status = %d body=%s", self.Code, self.Body.String())
	}

	// A seller may not change their own status (moderation is admin-only).
	if rec := do(t, h, http.MethodPatch, "/sellers/"+created.SellerID+"/status", `{"status":"ACTIVE"}`,
		map[string]string{"X-Dev-Role": "SELLER", "X-Dev-Seller": created.SellerID}); rec.Code != http.StatusForbidden {
		t.Fatalf("seller status change status = %d, want 403", rec.Code)
	}

	// A state admin in the seller's state can activate.
	admin := do(t, h, http.MethodPatch, "/sellers/"+created.SellerID+"/status", `{"status":"ACTIVE"}`,
		map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "KA"})
	if admin.Code != http.StatusOK {
		t.Fatalf("admin status change status = %d body=%s", admin.Code, admin.Body.String())
	}

	// A state admin from another state cannot see the seller.
	other := do(t, h, http.MethodGet, "/sellers/"+created.SellerID, "",
		map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "MH"})
	if other.Code != http.StatusNotFound {
		t.Fatalf("out-of-state read status = %d, want 404", other.Code)
	}
}
