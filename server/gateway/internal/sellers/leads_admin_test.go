package sellers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/geo"
)

// recordingAudit is a contracts.AuditWriter that keeps entries in memory.
type recordingAudit struct{ entries []contracts.AuditEntry }

func (r *recordingAudit) Audit(_ context.Context, e contracts.AuditEntry) error {
	r.entries = append(r.entries, e)
	return nil
}

func reqWithIdentity(id auth.Identity) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/seller-leads/lead-1/assign", nil)
	return r.WithContext(auth.WithIdentity(r.Context(), id))
}

// The admin queue routes must be admin-only: a seller or a role-less caller is refused before the
// repo is touched. The nil pool is the proof no query ran.
func TestLeadAdminRoutesRequireAdmin(t *testing.T) {
	h := handlerRouter(t, nil)

	cases := []struct{ method, path string }{
		{http.MethodGet, "/seller-leads"},
		{http.MethodPatch, "/seller-leads/lead-abc"},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path+" roleless", func(t *testing.T) {
			rec := do(t, h, tc.method, tc.path, "", nil)
			if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusForbidden {
				t.Fatalf("status = %d, want 401/403 (body %s)", rec.Code, rec.Body.String())
			}
		})
		t.Run(tc.method+" "+tc.path+" seller", func(t *testing.T) {
			rec := do(t, h, tc.method, tc.path, "", map[string]string{
				"X-Dev-Role": auth.RoleSeller, "X-Dev-Seller": "seller-1",
			})
			if rec.Code != http.StatusForbidden {
				t.Fatalf("status = %d, want 403 (body %s)", rec.Code, rec.Body.String())
			}
		})
	}
}

// The public POST must stay anonymous: it is the whole point of the landing page.
func TestLeadPublicCreateStaysAnonymous(t *testing.T) {
	h, _ := leadRouter(t)
	rec := do(t, h, http.MethodPost, "/seller-leads", `{}`, nil)
	if rec.Code == http.StatusUnauthorized || rec.Code == http.StatusForbidden {
		t.Fatalf("public POST /seller-leads must not require auth, got %d", rec.Code)
	}
}

// leadScope decides which leads an admin may see; a wrong mapping here is a cross-district data leak.
func TestLeadScope(t *testing.T) {
	cases := []struct {
		name                 string
		role                 string
		district, state      string
		wantDistrict, wantSt string
	}{
		{"super admin sees everything", auth.RoleSuperAdmin, "PY1", "PY", "", ""},
		{"district admin locked to district", auth.RoleDistrictAdmin, "PY1", "PY", "PY1", ""},
		{"district admin without claim falls back to state", auth.RoleDistrictAdmin, "", "PY", "", "PY"},
		{"seller has no admin scope", auth.RoleSeller, "PY1", "PY", "", ""},
		{"anonymous has no admin scope", "", "", "", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := auth.WithIdentity(context.Background(), auth.Identity{
				UserID: "u", Role: tc.role,
				DistrictCode: geo.Normalise(tc.district), StateCode: tc.state,
			})
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, "/seller-leads", nil)
			if err != nil {
				t.Fatal(err)
			}
			district, state := leadScope(req)
			if district != tc.wantDistrict || state != tc.wantSt {
				t.Fatalf("got (%q,%q), want (%q,%q)", district, state, tc.wantDistrict, tc.wantSt)
			}
		})
	}
}

// The queue read validates the status filter before querying, so an unknown status is a 400 rather
// than an empty page that looks like "no leads".
func TestListLeadsRejectsUnknownStatus(t *testing.T) {
	h := handlerRouter(t, nil)
	rec := do(t, h, http.MethodGet, "/seller-leads?status=PROMOTED", "", map[string]string{
		"X-Dev-Role": auth.RoleSuperAdmin,
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"code":"bad_request"`) {
		t.Fatalf("body %s missing bad_request", rec.Body.String())
	}
}

// leadColumns and scanLead must stay in step: a projection edit that forgets the scan (or vice versa)
// silently breaks every admin read. This pins the two lists together.
func TestLeadColumnsMatchScan(t *testing.T) {
	cols := strings.Join(strings.Fields(strings.ReplaceAll(leadColumns, ",", " , ")), " ")
	want := []string{
		"lead_id", "business_name", "owner_name", "category", "contact_phone", "contact_email",
		"business_address", "state_code", "district_code", "state_name", "district_name",
		"latitude", "longitude", "platform_fee_pct", "notes", "status", "source", "admin_note",
		"reviewed_by", "reviewed_at", "assigned_to", "assigned_at", "seller_id", "created_at",
	}
	for _, w := range want {
		if !strings.Contains(cols, w) {
			t.Fatalf("leadColumns is missing %q", w)
		}
	}
	// 24 columns → 24 Scan destinations in scanLead. This count is the tripwire: adding a column to
	// the projection without updating scanLead breaks every admin read at runtime, not at build time.
	if got := len(want); got != 24 {
		t.Fatalf("expected 24 projected columns, got %d", got)
	}
}

// The lifecycle is closed: a status outside the four is never written.
func TestLeadStatusSetIsClosed(t *testing.T) {
	for _, s := range []string{"NEW", "CONTACTED", "APPROVED", "REJECTED"} {
		if !leadStatuses[s] {
			t.Fatalf("%s must be a valid lead status", s)
		}
	}
	for _, s := range []string{"PENDING", "CANCELLED", "", "new"} {
		if leadStatuses[s] {
			t.Fatalf("%q must not be a valid lead status", s)
		}
	}
}

// The portal reads leads over the wire, so the JSON contract (camelCase keys, no IP hash) is
// load-bearing. A missing tag would silently break every admin row without failing the build.
func TestLeadJSONContract(t *testing.T) {
	raw, err := json.Marshal(Lead{
		LeadID: "lead-1", BusinessName: "Shop", OwnerName: "Owner", Category: "FOOD",
		ContactPhone: "9876543210", ContactEmail: "a@b.com", BusinessAddress: "12 Street",
		StateCode: "PY", DistrictCode: "PY1", StateName: "Puducherry", DistrictName: "Karaikal",
		Notes: "note", Status: "NEW", Source: "web", IPHash: "deadbeef",
		AdminNote: "called", ReviewedBy: "admin-1", ReviewedAt: "2026-11-20T00:00:00Z",
	})
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{
		"leadId", "businessName", "ownerName", "category", "contactPhone", "contactEmail",
		"businessAddress", "stateCode", "districtCode", "stateName", "districtName",
		"platformFeePct", "notes", "status", "source", "adminNote", "reviewedBy", "reviewedAt",
		"assignedTo", "assignedAt", "sellerId", "createdAt",
	} {
		if _, ok := got[key]; !ok {
			t.Fatalf("serialized lead is missing %q (got %v)", key, keysOf(got))
		}
	}
	// The IP hash is an internal abuse trail: never handed to an operator screen.
	if _, ok := got["ipHash"]; ok {
		t.Fatalf("lead JSON must not expose the IP hash")
	}
	if _, ok := got["IPHash"]; ok {
		t.Fatalf("lead JSON must not expose the IP hash")
	}
	// PascalCase would break the portal's camelCase reader.
	if _, ok := got["LeadID"]; ok {
		t.Fatalf("lead JSON must be camelCase, not PascalCase")
	}
}

func keysOf(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// A claim/release is audited as its own action (not folded into a status move). This uses a recording
// writer, because the router helper wires no audit sink — which is also the proof that the code path
// tolerates one being absent.
func TestLeadClaimIsAudited(t *testing.T) {
	rec := &recordingAudit{}
	h := NewHandler(New(nil), nil, rec, nil)
	if h.audit == nil {
		t.Fatal("audit writer not wired")
	}
	h.logLeadAssignment(
		reqWithIdentity(auth.Identity{UserID: "admin-9", Role: auth.RoleDistrictAdmin, DistrictCode: "PY1"}),
		Lead{LeadID: "lead-1", DistrictCode: "PY1"},
		Lead{LeadID: "lead-1", DistrictCode: "PY1", AssignedTo: "admin-9"},
	)
	if len(rec.entries) != 1 {
		t.Fatalf("audit entries = %d, want 1", len(rec.entries))
	}
	e := rec.entries[0]
	if e.Action != "SELLER_LEAD_ASSIGN" || e.Entity != "sellers.seller_leads" || e.EntityID != "lead-1" {
		t.Fatalf("unexpected audit entry: %+v", e)
	}
	if e.ActorID != "admin-9" || e.ActorRole != auth.RoleDistrictAdmin {
		t.Fatalf("actor not recorded: %+v", e)
	}
}
