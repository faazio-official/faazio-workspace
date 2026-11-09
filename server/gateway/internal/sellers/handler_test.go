package sellers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/authtest"
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
	r.Use(authtest.Middleware())
	NewHandler(New(pool), c, nil, nil).Register(r)
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
		`{"businessName":"Gate Test","ownerName":"O","stateCode":"TN","districtCode":"TTC",`+
			`"gstin":"29ABCDE1234F1Z5","pan":"ABCDE1234F","contactPhone":"9876543210",`+
			`"contactEmail":"o@example.com","otpVerified":true,`+
			`"bankName":"HDFC Bank","bankAccountNumber":"123456789012","bankIfsc":"HDFC0001234",`+
			`"bankBeneficiary":"Gate Test","passbookFileKey":"kyc/gate/passbook.jpg",`+
			`"vendors":[{"name":"Gate Store","app":"FOOD","platformFeePct":10,`+
			`"fssaiNumber":"12345678901234","fssaiFileKey":"kyc/gate/fssai.jpg"}]}`,
		map[string]string{"X-Dev-Phone": "9876543210"})
	if create.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", create.Code, create.Body.String())
	}
	var created Seller
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from directory.stores where seller_id=$1`, created.SellerID)
		_, _ = pool.Exec(context.Background(), `delete from sellers.sellers where seller_id=$1`, created.SellerID)
	})

	// An authenticated caller with no app_role is forbidden (not unauthenticated): 403, not 401.
	if rec := do(t, h, http.MethodGet, "/sellers/"+created.SellerID, "", nil); rec.Code != http.StatusForbidden {
		t.Fatalf("no-role read status = %d, want 403", rec.Code)
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
		map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "TN"})
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

// TestSellerMeRead covers GET /sellers/me: a still-shopper account (no SELLER role) can read its
// own latest application across sessions, and an applicant with no row gets 404.
func TestSellerMeRead(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)

	if rec := do(t, h, http.MethodGet, "/sellers/me", "",
		map[string]string{"X-Dev-User": "user-me-empty"}); rec.Code != http.StatusNotFound {
		t.Fatalf("me before apply status = %d body=%s, want 404", rec.Code, rec.Body.String())
	}

	created := createTestSeller(t, pool, h, "Me Test")

	rec := do(t, h, http.MethodGet, "/sellers/me", "", map[string]string{"X-Dev-User": "user-1"})
	if rec.Code != http.StatusOK {
		t.Fatalf("me status = %d body=%s", rec.Code, rec.Body.String())
	}
	var got Seller
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.SellerID != created.SellerID {
		t.Fatalf("me sellerId = %q, want %q", got.SellerID, created.SellerID)
	}
}

// TestSellerCreateRejectsInvalidState covers the write-authority check: a code that is not an
// active ISO 3166-2:IN state/UT (admins.states) is rejected instead of persisted.
func TestSellerCreateRejectsInvalidState(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)

	rec := do(t, h, http.MethodPost, "/sellers",
		`{"businessName":"Bad State","ownerName":"O","stateCode":"ZZ",`+
			`"pan":"ABCDE1234F","contactPhone":"9876500001",`+
			`"contactEmail":"bad-state@example.com","otpVerified":true,`+
			`"bankName":"HDFC Bank","bankAccountNumber":"123456789012","bankIfsc":"HDFC0001234",`+
			`"bankBeneficiary":"Bad State","passbookFileKey":"kyc/gate/passbook.jpg",`+
			`"vendors":[{"name":"Bad Store","app":"FOOD","platformFeePct":10}]}`,
		map[string]string{"X-Dev-Phone": "9876500001"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid state status = %d body=%s, want 400", rec.Code, rec.Body.String())
	}
}

// TestSellerCreateDuplicateEmailConflict covers the 409 mapping for the lower(contact_email)
// uniqueness constraint (0068): a second application is a clean conflict, never an opaque 500.
func TestSellerCreateDuplicateEmailConflict(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)

	const email = "dupe-create@example.com"
	cleanup := func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, `delete from directory.stores where seller_id in `+
			`(select seller_id from sellers.sellers where lower(contact_email)=lower($1))`, email)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where lower(contact_email)=lower($1)`, email)
	}
	cleanup()
	t.Cleanup(cleanup)

	body := func(phone, name string) string {
		return `{"businessName":"` + name + `","ownerName":"O","stateCode":"TN",` +
			`"districtCode":"TTC","pan":"ABCDE1234F","contactPhone":"` + phone + `",` +
			`"contactEmail":"` + email + `","otpVerified":true,` +
			`"bankName":"HDFC Bank","bankAccountNumber":"123456789012","bankIfsc":"HDFC0001234",` +
			`"bankBeneficiary":"` + name + `","passbookFileKey":"kyc/gate/passbook.jpg",` +
			`"vendors":[{"name":"` + name + ` Store","app":"FOOD","platformFeePct":10}]}`
	}

	first := do(t, h, http.MethodPost, "/sellers", body("9876500002", "Dupe One"),
		map[string]string{"X-Dev-Phone": "9876500002"})
	if first.Code != http.StatusCreated {
		t.Fatalf("first create status = %d body=%s", first.Code, first.Body.String())
	}
	second := do(t, h, http.MethodPost, "/sellers", body("9876500003", "Dupe Two"),
		map[string]string{"X-Dev-Phone": "9876500003"})
	if second.Code != http.StatusConflict {
		t.Fatalf("duplicate email status = %d body=%s, want 409", second.Code, second.Body.String())
	}
}

func createTestSeller(t *testing.T, pool *pgxpool.Pool, h http.Handler, name string) Seller {
	t.Helper()
	create := do(t, h, http.MethodPost, "/sellers",
		`{"businessName":"`+name+`","ownerName":"O","stateCode":"TN","districtCode":"TTC",`+
			`"gstin":"29ABCDE1234F1Z5","pan":"ABCDE1234F","contactPhone":"9876543210",`+
			`"contactEmail":"o@example.com","otpVerified":true,`+
			`"bankName":"HDFC Bank","bankAccountNumber":"123456789012","bankIfsc":"HDFC0001234",`+
			`"bankBeneficiary":"`+name+`","passbookFileKey":"kyc/gate/passbook.jpg",`+
			`"vendors":[{"name":"`+name+` Store","app":"FOOD","platformFeePct":10,`+
			`"fssaiNumber":"12345678901234","fssaiFileKey":"kyc/gate/fssai.jpg"}]}`,
		map[string]string{"X-Dev-Phone": "9876543210"})
	if create.Code != http.StatusCreated {
		t.Fatalf("create for %s status = %d body=%s", name, create.Code, create.Body.String())
	}
	var s Seller
	if err := json.Unmarshal(create.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from sellers.seller_request_history where seller_id=$1`, s.SellerID)
		_, _ = pool.Exec(context.Background(), `delete from sellers.kyc_verification_log where seller_id=$1`, s.SellerID)
		_, _ = pool.Exec(context.Background(), `delete from sellers.bank_accounts where seller_id=$1`, s.SellerID)
		_, _ = pool.Exec(context.Background(), `delete from sellers.kyc_documents where seller_id=$1`, s.SellerID)
		_, _ = pool.Exec(context.Background(), `delete from directory.stores where seller_id=$1`, s.SellerID)
		_, _ = pool.Exec(context.Background(), `delete from sellers.sellers where seller_id=$1`, s.SellerID)
	})
	return s
}

func TestRejectResubmit(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)
	s := createTestSeller(t, pool, h, "Reject Test")
	adminH := map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "TN"}

	// A short/no reason is rejected.
	short := do(t, h, http.MethodPost, "/sellers/"+s.SellerID+"/reject", `{"reason":"no"}`,
		map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "TN"})
	if short.Code != http.StatusBadRequest {
		t.Fatalf("short reason status = %d, want 400", short.Code)
	}

	// Admin rejects: REJECTED + one history entry.
	reject := do(t, h, http.MethodPost, "/sellers/"+s.SellerID+"/reject",
		`{"reason":"Passbook illegible"}`, adminH)
	if reject.Code != http.StatusOK {
		t.Fatalf("reject status = %d body=%s", reject.Code, reject.Body.String())
	}
	var rejected Seller
	if err := json.Unmarshal(reject.Body.Bytes(), &rejected); err != nil {
		t.Fatal(err)
	}
	if rejected.Status != "REJECTED" || rejected.RejectionReason != "Passbook illegible" {
		t.Fatalf("rejected = %+v", rejected)
	}
	var hist []map[string]any
	if err := json.Unmarshal(rejected.RejectionHistory, &hist); err != nil {
		t.Fatalf("rejection history: %v", err)
	}
	if len(hist) != 1 {
		t.Fatalf("rejection history length = %d, want 1", len(hist))
	}

	// A state admin from another state cannot moderate this seller.
	illegal := do(t, h, http.MethodPost, "/sellers/"+s.SellerID+"/reject",
		`{"reason":"outside scope"}`, map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "MH"})
	if illegal.Code != http.StatusNotFound {
		t.Fatalf("out-of-state reject status = %d, want 404", illegal.Code)
	}

	// The seller (REJECTED only) resubmits with a corrected business name.
	edit := do(t, h, http.MethodPost, "/sellers/"+s.SellerID+"/edit",
		`{"businessName":"Reject Test (corrected)","ownerName":"O","stateCode":"TN","districtCode":"TTC",
		  "gstin":"29ABCDE1234F1Z5","pan":"ABCDE1234F","businessAddress":"","contactPhone":"",
		  "contactEmail":"o@example.com"}`,
		map[string]string{"X-Dev-Role": "SELLER", "X-Dev-Seller": s.SellerID})
	if edit.Code != http.StatusOK {
		t.Fatalf("edit status = %d body=%s", edit.Code, edit.Body.String())
	}
	var resub Seller
	if err := json.Unmarshal(edit.Body.Bytes(), &resub); err != nil {
		t.Fatal(err)
	}
	if resub.Status != "PENDING_REVIEW" || resub.RejectionReason != "" {
		t.Fatalf("resubmitted = status %q reason %q", resub.Status, resub.RejectionReason)
	}
	var n int
	if err := pool.QueryRow(context.Background(),
		`select count(*) from sellers.seller_request_history where seller_id=$1`, s.SellerID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n == 0 {
		t.Fatal("resubmit did not record field history")
	}

	// Editing again while PENDING_REVIEW is a 409.
	again := do(t, h, http.MethodPost, "/sellers/"+s.SellerID+"/edit",
		`{"businessName":"X","ownerName":"O","stateCode":"TN","districtCode":"TTC",
		  "gstin":"29ABCDE1234F1Z5","pan":"ABCDE1234F","businessAddress":"","contactPhone":"",
		  "contactEmail":"o@example.com"}`,
		map[string]string{"X-Dev-Role": "SELLER", "X-Dev-Seller": s.SellerID})
	if again.Code != http.StatusConflict {
		t.Fatalf("non-rejected edit status = %d, want 409", again.Code)
	}
}

func TestVerifyDoc(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)
	s := createTestSeller(t, pool, h, "Verify Doc Test")

	verified := do(t, h, http.MethodPost, "/sellers/"+s.SellerID+"/verify-doc/PASSBOOK", `{}`,
		map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "TN"})
	if verified.Code != http.StatusOK {
		t.Fatalf("verify-doc status = %d body=%s", verified.Code, verified.Body.String())
	}
	var n int
	if err := pool.QueryRow(context.Background(),
		`select count(*) from sellers.kyc_verification_log where seller_id=$1 and doc_type='PASSBOOK'`,
		s.SellerID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("verification log rows = %d, want 1", n)
	}
	var docVerified bool
	if err := pool.QueryRow(context.Background(),
		`select verified from sellers.kyc_documents where seller_id=$1 and doc_type='PASSBOOK'`,
		s.SellerID).Scan(&docVerified); err != nil {
		t.Fatal(err)
	}
	if !docVerified {
		t.Fatal("passbook document was not marked verified")
	}

	// An invalid docType is 400.
	bad := do(t, h, http.MethodPost, "/sellers/"+s.SellerID+"/verify-doc/DRIVING_LICENCE", `{}`,
		map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "TN"})
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("invalid docType status = %d, want 400", bad.Code)
	}
}

// TestSetStatusRecordsReason covers PATCH /sellers/{id}/status accepting a moderator reason: a
// REJECTED transition persists it to rejection_reason + history, and an overlong reason is a 400.
func TestSetStatusRecordsReason(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)
	s := createTestSeller(t, pool, h, "Status Reason Test")
	adminH := map[string]string{"X-Dev-Role": "STATE_ADMIN", "X-Dev-State": "TN"}

	rec := do(t, h, http.MethodPatch, "/sellers/"+s.SellerID+"/status",
		`{"status":"REJECTED","reason":"blurry shop licence"}`, adminH)
	if rec.Code != http.StatusOK {
		t.Fatalf("status reason code = %d body=%s", rec.Code, rec.Body.String())
	}
	var got Seller
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Status != "REJECTED" || got.RejectionReason != "blurry shop licence" {
		t.Fatalf("rejected seller = %+v", got)
	}
	var hist []map[string]any
	if err := json.Unmarshal(got.RejectionHistory, &hist); err != nil {
		t.Fatalf("rejection history: %v", err)
	}
	if len(hist) != 1 {
		t.Fatalf("rejection history length = %d, want 1", len(hist))
	}

	overlong := do(t, h, http.MethodPatch, "/sellers/"+s.SellerID+"/status",
		`{"status":"SUSPENDED","reason":"`+strings.Repeat("x", 501)+`"}`, adminH)
	if overlong.Code != http.StatusBadRequest {
		t.Fatalf("overlong reason status = %d, want 400", overlong.Code)
	}
}

// TestSellerSettingsRouteGating exercises the seller-settings routes without a database: the role
// gate rejects non-sellers and the request validation rejects bad input before any repo call.
func TestSellerSettingsRouteGating(t *testing.T) {
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(authtest.Middleware())
	NewHandler(New(nil), c, nil, nil).Register(r)
	sellerH := map[string]string{"X-Dev-Role": "SELLER", "X-Dev-Seller": "sel-1"}

	if rec := do(t, r, http.MethodGet, "/seller/sub-users", "", map[string]string{"X-Dev-Role": "SUPER_ADMIN"}); rec.Code != http.StatusForbidden {
		t.Fatalf("non-seller GET /seller/sub-users = %d, want 403", rec.Code)
	}
	cases := []struct {
		name, path, body string
	}{
		{"bad role", "/seller/sub-users", `{"name":"A","email":"a@b.com","role":"OWNER"}`},
		{"bad email", "/seller/sub-users", `{"name":"A","email":"nope","role":"STAFF"}`},
		{"blank name", "/seller/sub-users", `{"name":"  ","email":"a@b.com","role":"STAFF"}`},
	}
	for _, tc := range cases {
		rec := do(t, r, http.MethodPost, tc.path, tc.body, sellerH)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: POST %s = %d, want 400 (body=%s)", tc.name, tc.path, rec.Code, rec.Body.String())
		}
	}
}
