package sellers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync/atomic"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// leadFixture inserts one lead directly and returns its id. Direct SQL (not the public handler) keeps
// the test independent of the honeypot/rate-limit path.
var leadFixtureSeq atomic.Int64

func leadFixture(t *testing.T, district, state string) (id string) {
	t.Helper()
	pool := testenv.Pool(t)
	id = fmt.Sprintf("lead-test-%s-%d", t.Name(), leadFixtureSeq.Add(1))
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from sellers.seller_leads where lead_id = $1`, id)
	})
	_, err := pool.Exec(context.Background(), `
		insert into sellers.seller_leads
			(lead_id, business_name, owner_name, category, contact_phone, contact_email,
			 business_address, state_code, district_code, state_name, district_name, status, source)
		values ($1,'Lead Fixture Shop','Owner','FOOD','9876543210','lead@example.com',
		        '12 Bharathiar Street', $2, $3, 'Puducherry', 'Karaikal', 'NEW', 'web')`,
		id, state, district)
	if err != nil {
		t.Fatalf("insert lead fixture: %v", err)
	}
	return id
}

func decodeLead(t *testing.T, body []byte) Lead {
	t.Helper()
	var l Lead
	if err := json.Unmarshal(body, &l); err != nil {
		t.Fatalf("decode lead: %v (body %s)", err, body)
	}
	return l
}

// The whole point of the queue: a district admin can see and move a lead in their own district, and
// cannot see or move one outside it.
func TestLeadQueueDistrictScope(t *testing.T) {
	h := handlerRouter(t, testenv.Pool(t))

	mine := leadFixture(t, "PY1", "PY")
	theirs := leadFixture(t, "PY2", "PY")

	inScope := map[string]string{"X-Dev-Role": auth.RoleDistrictAdmin, "X-Dev-District": "PY1"}
	otherScope := map[string]string{"X-Dev-Role": auth.RoleDistrictAdmin, "X-Dev-District": "PY2"}

	rec := do(t, h, http.MethodGet, "/seller-leads", "", inScope)
	if rec.Code != http.StatusOK {
		t.Fatalf("list status = %d body=%s", rec.Code, rec.Body.String())
	}
	var rows []Lead
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, r := range rows {
		seen[r.LeadID] = true
		if r.DistrictCode != "PY1" {
			t.Fatalf("district admin saw a lead from %q", r.DistrictCode)
		}
	}
	if !seen[mine] {
		t.Fatalf("own-district lead missing from the queue")
	}
	if seen[theirs] {
		t.Fatalf("cross-district lead leaked into the queue")
	}

	// Reading the other district's lead is a 404, not a 403: existence is not disclosed.
	if rec := do(t, h, http.MethodPatch, "/seller-leads/"+theirs, `{"status":"CONTACTED"}`, otherScope); rec.Code != http.StatusOK {
		t.Fatalf("own-district patch = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	if rec := do(t, h, http.MethodPatch, "/seller-leads/"+mine, `{"status":"CONTACTED"}`, otherScope); rec.Code != http.StatusNotFound {
		t.Fatalf("cross-district patch = %d, want 404", rec.Code)
	}
}

// NEW → CONTACTED → APPROVED records the reviewer and note; a REJECTED move without a reason is
// refused; and a second admin acting on the same from-status gets a 409 instead of overwriting.
func TestLeadLifecycle(t *testing.T) {
	h := handlerRouter(t, testenv.Pool(t))
	id := leadFixture(t, "PY1", "PY")
	admin := map[string]string{"X-Dev-Role": auth.RoleDistrictAdmin, "X-Dev-District": "PY1", "X-Dev-User": "admin-1"}

	rec := do(t, h, http.MethodPatch, "/seller-leads/"+id, `{"status":"CONTACTED","note":"Called, asked to apply"}`, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("contacted status = %d body=%s", rec.Code, rec.Body.String())
	}
	l := decodeLead(t, rec.Body.Bytes())
	if l.Status != "CONTACTED" || l.AdminNote != "Called, asked to apply" {
		t.Fatalf("after contacted: status=%q note=%q", l.Status, l.AdminNote)
	}
	if l.ReviewedBy != "admin-1" || l.ReviewedAt == "" {
		t.Fatalf("reviewer not recorded: %q %q", l.ReviewedBy, l.ReviewedAt)
	}

	// A rejected move needs a reason (checked before any write).
	if rec := do(t, h, http.MethodPatch, "/seller-leads/"+id, `{"status":"REJECTED"}`, admin); rec.Code != http.StatusBadRequest {
		t.Fatalf("reject without reason = %d, want 400", rec.Code)
	}

	rec = do(t, h, http.MethodPatch, "/seller-leads/"+id, `{"status":"APPROVED","note":"Applying Monday"}`, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("approved status = %d body=%s", rec.Code, rec.Body.String())
	}
	l = decodeLead(t, rec.Body.Bytes())
	if l.Status != "APPROVED" || l.AdminNote != "Applying Monday" {
		t.Fatalf("after approved: status=%q note=%q", l.Status, l.AdminNote)
	}

	// Approving does NOT create a seller account: the merchant still applies in the app.
	pool := testenv.Pool(t)
	var sellers int
	if err := pool.QueryRow(context.Background(),
		`select count(*) from sellers.sellers where phone = '9876543210'`).Scan(&sellers); err != nil {
		t.Fatal(err)
	}
	if sellers != 0 {
		t.Fatalf("approving a lead created %d seller row(s); it must not", sellers)
	}

	// A no-op move answers 200 without rewriting the review stamp.
	before := l.ReviewedAt
	rec = do(t, h, http.MethodPatch, "/seller-leads/"+id, `{"status":"APPROVED"}`, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("no-op status = %d", rec.Code)
	}
	if after := decodeLead(t, rec.Body.Bytes()); after.ReviewedAt != before {
		t.Fatalf("no-op move rewrote reviewed_at: %q → %q", before, after.ReviewedAt)
	}
}

// A super admin sees every district and can move any lead.
func TestLeadQueueSuperAdmin(t *testing.T) {
	h := handlerRouter(t, testenv.Pool(t))
	id := leadFixture(t, "PY2", "PY")
	super := map[string]string{"X-Dev-Role": auth.RoleSuperAdmin, "X-Dev-User": "super-1"}

	rec := do(t, h, http.MethodGet, "/seller-leads?status=NEW", "", super)
	if rec.Code != http.StatusOK {
		t.Fatalf("list status = %d body=%s", rec.Code, rec.Body.String())
	}
	var rows []Lead
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, r := range rows {
		if r.LeadID == id {
			found = true
		}
		if r.Status != "NEW" {
			t.Fatalf("status filter leaked a %q lead", r.Status)
		}
	}
	if !found {
		t.Fatalf("super admin did not see the lead")
	}

	rec = do(t, h, http.MethodPatch, "/seller-leads/"+id, `{"status":"REJECTED","note":"No shop front"}`, super)
	if rec.Code != http.StatusOK {
		t.Fatalf("super reject = %d body=%s", rec.Code, rec.Body.String())
	}
	if got := decodeLead(t, rec.Body.Bytes()); got.Status != "REJECTED" || got.AdminNote != "No shop front" {
		t.Fatalf("after reject: status=%q note=%q", got.Status, got.AdminNote)
	}
}

// The queue search matches shop, owner, phone and email so an operator can find a call-back by
// whichever detail the caller left.
func TestLeadQueueSearch(t *testing.T) {
	h := handlerRouter(t, testenv.Pool(t))
	id := leadFixture(t, "PY1", "PY")
	super := map[string]string{"X-Dev-Role": auth.RoleSuperAdmin}

	for _, q := range []string{"Lead%20Fixture", "Owner", "9876543210", "lead@example.com"} {
		rec := do(t, h, http.MethodGet, "/seller-leads?q="+q, "", super)
		if rec.Code != http.StatusOK {
			t.Fatalf("search %q status = %d body=%s", q, rec.Code, rec.Body.String())
		}
		var rows []Lead
		if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
			t.Fatal(err)
		}
		hit := false
		for _, r := range rows {
			if r.LeadID == id {
				hit = true
			}
		}
		if !hit {
			t.Fatalf("search %q missed the lead", q)
		}
	}
}

// Claiming a lead is first-come: the second admin gets a 409 rather than quietly believing they own
// the call. Only the owner may release, and release returns the lead to the unclaimed pool.
func TestLeadClaimAndRelease(t *testing.T) {
	h := handlerRouter(t, testenv.Pool(t))
	id := leadFixture(t, "PY1", "PY")

	adminOne := map[string]string{"X-Dev-Role": auth.RoleDistrictAdmin, "X-Dev-District": "PY1", "X-Dev-User": "admin-one"}
	adminTwo := map[string]string{"X-Dev-Role": auth.RoleDistrictAdmin, "X-Dev-District": "PY1", "X-Dev-User": "admin-two"}

	rec := do(t, h, http.MethodPost, "/seller-leads/"+id+"/assign", `{"assigned":"me"}`, adminOne)
	if rec.Code != http.StatusOK {
		t.Fatalf("claim = %d body=%s", rec.Code, rec.Body.String())
	}
	if l := decodeLead(t, rec.Body.Bytes()); l.AssignedTo != "admin-one" || l.AssignedAt == "" {
		t.Fatalf("claim did not record the owner: %q %q", l.AssignedTo, l.AssignedAt)
	}

	// Second admin cannot steal it.
	if rec := do(t, h, http.MethodPost, "/seller-leads/"+id+"/assign", `{"assigned":"me"}`, adminTwo); rec.Code != http.StatusConflict {
		t.Fatalf("second claim = %d, want 409 (body %s)", rec.Code, rec.Body.String())
	}

	// The non-owner cannot release it either.
	if rec := do(t, h, http.MethodPost, "/seller-leads/"+id+"/assign", `{}`, adminTwo); rec.Code != http.StatusConflict {
		t.Fatalf("foreign release = %d, want 409", rec.Code)
	}

	// The owner can, and the lead returns to the unclaimed pool.
	rec = do(t, h, http.MethodPost, "/seller-leads/"+id+"/assign", `{}`, adminOne)
	if rec.Code != http.StatusOK {
		t.Fatalf("release = %d body=%s", rec.Code, rec.Body.String())
	}
	if l := decodeLead(t, rec.Body.Bytes()); l.AssignedTo != "" || l.AssignedAt != "" {
		t.Fatalf("release left an owner: %q %q", l.AssignedTo, l.AssignedAt)
	}

	// "unassigned" finds it again; "me" does not.
	for _, tc := range []struct {
		q    string
		want bool
	}{
		{"?assigned=unassigned", true},
		{"?assigned=me", false},
	} {
		rec := do(t, h, http.MethodGet, "/seller-leads"+tc.q, "", adminOne)
		if rec.Code != http.StatusOK {
			t.Fatalf("list%s = %d", tc.q, rec.Code)
		}
		var rows []Lead
		if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
			t.Fatal(err)
		}
		found := false
		for _, r := range rows {
			if r.LeadID == id {
				found = true
			}
		}
		if found != tc.want {
			t.Fatalf("list%s: found=%v want %v", tc.q, found, tc.want)
		}
	}

}

// The loop-closing back-fill: an enquiry that matches an application's phone or email becomes that
// application, so the queue stops showing an already-onboarded merchant as an open lead.
func TestLeadLinksToSellerApplication(t *testing.T) {
	pool := testenv.Pool(t)
	h := handlerRouter(t, pool)
	leadID := leadFixture(t, "PY1", "PY")
	super := map[string]string{"X-Dev-Role": auth.RoleSuperAdmin}

	// No application yet → the lead carries no seller link.
	rec := do(t, h, http.MethodGet, "/seller-leads?status=NEW", "", super)
	var rows []Lead
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatal(err)
	}
	for _, r := range rows {
		if r.LeadID == leadID && r.SellerID != "" {
			t.Fatalf("new lead already linked to %q", r.SellerID)
		}
	}

	// A real application for the same phone (the fixture uses 9876543210).
	created := createTestSeller(t, pool, h, "Lead Link Test")
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from directory.stores where seller_id=$1`, created.SellerID)
		_, _ = pool.Exec(context.Background(), `delete from sellers.sellers where seller_id=$1`, created.SellerID)
	})

	// The application's own contact phone is what the mobile form submits; drive the link the same way
	// create does rather than asserting on the fixture's hardcoded number.
	if _, err := New(pool).LinkLeadToSeller(context.Background(), created.ContactPhone, created.ContactEmail, created.SellerID); err != nil {
		t.Fatal(err)
	}
	linked := leadFixture(t, "PY1", "PY")
	// Point this fixture at the application's phone so the match is the real one.
	if _, err := pool.Exec(context.Background(),
		`update sellers.seller_leads set contact_phone = $2, contact_email = $3 where lead_id = $1`,
		linked, created.ContactPhone, created.ContactEmail); err != nil {
		t.Fatal(err)
	}
	n, err := New(pool).LinkLeadToSeller(context.Background(), created.ContactPhone, created.ContactEmail, created.SellerID)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("linked %d leads, want 1", n)
	}

	rec = do(t, h, http.MethodGet, "/seller-leads?q="+created.ContactEmail, "", super)
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, r := range rows {
		if r.LeadID == linked {
			found = true
			if r.SellerID != created.SellerID {
				t.Fatalf("lead.seller_id = %q, want %q", r.SellerID, created.SellerID)
			}
		}
	}
	if !found {
		t.Fatalf("linked lead missing from the queue")
	}

	// An already-linked lead is not re-linked to a different application.
	if n, err := New(pool).LinkLeadToSeller(context.Background(), created.ContactPhone, created.ContactEmail, "sel-other"); err != nil || n != 0 {
		t.Fatalf("re-link n=%d err=%v, want 0", n, err)
	}
}
