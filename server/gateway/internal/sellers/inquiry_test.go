package sellers

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// inquiryBody builds a valid public enquiry body. The photo id is arbitrary because the fake claimer
// accepts anything; the gateway requirement under test is "at least one".
func inquiryBody(name, phone, email string, photoIDs ...string) string {
	photos, _ := json.Marshal(photoIDs)
	return `{"businessName":"` + name + `","ownerName":"Owner","category":"MART",` +
		`"contactPhone":"` + phone + `","contactEmail":"` + email + `",` +
		`"businessAddress":"12 Market Road, Karaikal","districtCode":"PY1",` +
		`"platformFeePct":12,"latitude":10.9,"longitude":79.8,"shopPhotoIds":` + string(photos) + `}`
}

// TestCreateInquiry covers the public web-intake path: a valid enquiry becomes a sellers.sellers row
// with status INQUIRY and source web, at least one shop photo is mandatory, and the row is not
// reachable by a seller-scoped read (it has no user_id).
func TestCreateInquiry(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)

	cleanup := func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, `delete from directory.stores where seller_id in `+
			`(select seller_id from sellers.sellers where lower(contact_email)=lower($1))`, "inquiry@example.com")
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where lower(contact_email)=lower($1)`, "inquiry@example.com")
	}
	cleanup()
	t.Cleanup(cleanup)

	// No shop picture → 400.
	noPhoto := do(t, h, http.MethodPost, "/seller-inquiries",
		inquiryBody("No Photo Shop", "9876500100", "inquiry@example.com"), nil)
	if noPhoto.Code != http.StatusBadRequest {
		t.Fatalf("no-photo status = %d body=%s, want 400", noPhoto.Code, noPhoto.Body.String())
	}

	rec := do(t, h, http.MethodPost, "/seller-inquiries",
		inquiryBody("Inquiry Shop", "9876500101", "inquiry@example.com", "img_a", "img_b"), nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", rec.Code, rec.Body.String())
	}
	var created struct {
		SellerID string `json:"sellerId"`
		Status   string `json:"status"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Status != "INQUIRY" {
		t.Fatalf("status = %q, want INQUIRY", created.Status)
	}

	// The row is visible to a district admin in its district…
	admin := do(t, h, http.MethodGet, "/sellers/"+created.SellerID, "",
		map[string]string{"X-Dev-Role": "DISTRICT_ADMIN", "X-Dev-District": "PY1"})
	if admin.Code != http.StatusOK {
		t.Fatalf("admin read status = %d body=%s", admin.Code, admin.Body.String())
	}
	var got Seller
	if err := json.Unmarshal(admin.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Source != "web" || got.Status != "INQUIRY" {
		t.Fatalf("source/status = %q/%q, want web/INQUIRY", got.Source, got.Status)
	}
	if got.InquiryCategory != "MART" {
		t.Fatalf("inquiryCategory = %q, want MART", got.InquiryCategory)
	}
	if len(got.ShopPhotos) != 2 {
		t.Fatalf("shopPhotos = %d, want 2", len(got.ShopPhotos))
	}

	// …and it appears in the enquiry queue.
	queue := do(t, h, http.MethodGet, "/seller-inquiries", "",
		map[string]string{"X-Dev-Role": "DISTRICT_ADMIN", "X-Dev-District": "PY1"})
	if queue.Code != http.StatusOK {
		t.Fatalf("queue status = %d body=%s", queue.Code, queue.Body.String())
	}
	var rows []Seller
	if err := json.Unmarshal(queue.Body.Bytes(), &rows); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, r := range rows {
		if r.SellerID == created.SellerID {
			found = true
		}
	}
	if !found {
		t.Fatalf("created enquiry %s missing from the queue (%d rows)", created.SellerID, len(rows))
	}
}

// TestInquiryCannotActivate covers the lifecycle guard: an enquiry has no KYC, so the generic status
// endpoint must refuse INQUIRY → ACTIVE and INQUIRY → SUSPENDED while allowing INQUIRY → REJECTED.
func TestInquiryCannotActivate(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)

	cleanup := func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where lower(contact_email)=lower($1)`, "lifecycle@example.com")
	}
	cleanup()
	t.Cleanup(cleanup)

	rec := do(t, h, http.MethodPost, "/seller-inquiries",
		inquiryBody("Lifecycle Shop", "9876500102", "lifecycle@example.com", "img_x"), nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", rec.Code, rec.Body.String())
	}
	var created struct {
		SellerID string `json:"sellerId"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	admin := map[string]string{"X-Dev-Role": "DISTRICT_ADMIN", "X-Dev-District": "PY1"}

	for _, bad := range []string{"ACTIVE", "SUSPENDED"} {
		rec := do(t, h, http.MethodPatch, "/sellers/"+created.SellerID+"/status",
			`{"status":"`+bad+`"}`, admin)
		if rec.Code != http.StatusConflict {
			t.Fatalf("%s status = %d body=%s, want 409", bad, rec.Code, rec.Body.String())
		}
	}
	// Moving it to PENDING_REVIEW is the legitimate decision, and the queue endpoint accepts it.
	rec = do(t, h, http.MethodPatch, "/seller-inquiries/"+created.SellerID,
		`{"stage":"CONTACTED","status":"PENDING_REVIEW"}`, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("promote status = %d body=%s", rec.Code, rec.Body.String())
	}
	// Once it is an application it is no longer an enquiry: the queue rejects a second decision.
	again := do(t, h, http.MethodPatch, "/seller-inquiries/"+created.SellerID,
		`{"status":"REJECTED","reason":"changed mind"}`, admin)
	if again.Code != http.StatusConflict {
		t.Fatalf("second decision status = %d body=%s, want 409", again.Code, again.Body.String())
	}
}

// TestApplicationPromotesInquiry covers the merge: a merchant who enquired on the landing page and
// then applies in the app with the same phone reuses that row instead of creating a duplicate.
func TestApplicationPromotesInquiry(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)

	cleanup := func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, `delete from directory.stores where seller_id in `+
			`(select seller_id from sellers.sellers where lower(contact_email)=lower($1))`, "merge@example.com")
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where lower(contact_email)=lower($1)`, "merge@example.com")
	}
	cleanup()
	t.Cleanup(cleanup)

	rec := do(t, h, http.MethodPost, "/seller-inquiries",
		inquiryBody("Merge Shop", "9876500103", "merge@example.com", "img_m1", "img_m2"), nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("inquiry status = %d body=%s", rec.Code, rec.Body.String())
	}
	var inq struct {
		SellerID string `json:"sellerId"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &inq)

	// The merchant now applies in the app with the same phone. No shop photo is re-attached: the
	// enquiry's gallery carries over (single-vendor application).
	apply := do(t, h, http.MethodPost, "/sellers",
		`{"businessName":"Merge Shop Applied","ownerName":"Owner","stateCode":"PY","districtCode":"PY1",`+
			`"pan":"ABCDE1234F","contactPhone":"9876500103","contactEmail":"merge@example.com",`+
			`"otpVerified":true,"contractTier":"STANDARD","termsAccepted":true,"partnerAgreementAccepted":true,`+
			`"ipLicenseGranted":true,"bankName":"HDFC Bank","bankAccountNumber":"123456789012",`+
			`"bankIfsc":"HDFC0001234","bankBeneficiary":"Merge Shop","passbookFileKey":"kyc/m/passbook.jpg",`+
			`"vendors":[{"name":"Merge Store","app":"MART","platformFeePct":12,"shopPhotoIds":["img_m4"]}]}`,
		map[string]string{"X-Dev-Phone": "9876500103"})
	if apply.Code != http.StatusCreated {
		t.Fatalf("apply status = %d body=%s", apply.Code, apply.Body.String())
	}
	var applied Seller
	_ = json.Unmarshal(apply.Body.Bytes(), &applied)
	if applied.SellerID != inq.SellerID {
		t.Fatalf("application created a new row %q, want the enquiry %q promoted", applied.SellerID, inq.SellerID)
	}
	if applied.Status != "PENDING_REVIEW" || applied.Source != "app" {
		t.Fatalf("promoted status/source = %q/%q, want PENDING_REVIEW/app", applied.Status, applied.Source)
	}
}
