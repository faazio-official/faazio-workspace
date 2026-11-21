package sellers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// Admin follow-up queue for the landing-page "Sell with us" leads (0111 + 0112).
//
// The public write lives in leads.go. This file is the other half: a district admin works the leads
// their district can see, and a super admin works all of them. The lifecycle is
// NEW → CONTACTED → (APPROVED | REJECTED); APPROVED means "we called, they are proceeding" — it does
// NOT create a seller account. The merchant still applies in the mobile app (`POST /sellers`), which
// stays the only path to `sellers.sellers`.
//
// Every status change writes one admins.audit_logs row, because the actor here is a real admin whose
// role passes that table's actor_role check (unlike the anonymous public write).

// leadColumns is the projection shared by every read. Kept in one place so the scan order cannot drift.
const leadColumns = `lead_id, business_name, owner_name, category::text, contact_phone, contact_email,
	business_address, coalesce(state_code,''), coalesce(district_code,''), state_name, district_name,
	latitude, longitude, platform_fee_pct, notes, status, source, admin_note, reviewed_by,
	reviewed_at, assigned_to, assigned_at, coalesce(seller_id,''), created_at`

// leadStatuses is the closed lifecycle. Anything else is a 400 rather than a silent write.
var leadStatuses = map[string]bool{
	"NEW": true, "CONTACTED": true, "APPROVED": true, "REJECTED": true,
}

func scanLead(row rowScanner) (Lead, error) {
	var (
		l          Lead
		reviewedAt *time.Time
		assignedAt *time.Time
	)
	if err := row.Scan(&l.LeadID, &l.BusinessName, &l.OwnerName, &l.Category, &l.ContactPhone,
		&l.ContactEmail, &l.BusinessAddress, &l.StateCode, &l.DistrictCode, &l.StateName,
		&l.DistrictName, &l.Latitude, &l.Longitude, &l.PlatformFeePct, &l.Notes, &l.Status,
		&l.Source, &l.AdminNote, &l.ReviewedBy, &reviewedAt, &l.AssignedTo, &assignedAt,
		&l.SellerID, &l.CreatedAt); err != nil {
		return Lead{}, err
	}
	if reviewedAt != nil {
		l.ReviewedAt = reviewedAt.UTC().Format(time.RFC3339)
	}
	if assignedAt != nil {
		l.AssignedAt = assignedAt.UTC().Format(time.RFC3339)
	}
	return l, nil
}

// LeadFilter narrows the queue. The handler fills DistrictCode/StateCode from the caller's identity,
// never from a query parameter.
type LeadFilter struct {
	DistrictCode string
	StateCode    string
	Status       string
	Query        string
	// AssignedTo narrows to one admin's claims; UnassignedOnly narrows to leads nobody has claimed.
	AssignedTo     string
	UnassignedOnly bool
}

// ListLeads returns leads newest-first, bounded to 200 rows like every other admin queue.
func (r *Repo) ListLeads(ctx context.Context, f LeadFilter) ([]Lead, error) {
	if r.pool == nil {
		return nil, errors.New("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select `+leadColumns+`
		  from sellers.seller_leads
		 where ($1 = '' or coalesce(district_code,'') = $1)
		   and ($2 = '' or coalesce(state_code,'') = $2)
		   and ($3 = '' or status = $3)
		   and ($4 = '' or business_name ilike '%' || $4 || '%'
		                or owner_name ilike '%' || $4 || '%'
		                or contact_phone ilike '%' || $4 || '%'
		                or contact_email ilike '%' || $4 || '%')
		   and ($5 = '' or assigned_to = $5)
		   and (not $6 or assigned_to = '')
		 order by created_at desc
		 limit 200`, f.DistrictCode, f.StateCode, f.Status, strings.TrimSpace(f.Query),
		f.AssignedTo, f.UnassignedOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Lead{}
	for rows.Next() {
		l, err := scanLead(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// LeadByID returns one lead. ok=false means it does not exist.
func (r *Repo) LeadByID(ctx context.Context, leadID string) (Lead, bool, error) {
	if r.pool == nil {
		return Lead{}, false, errors.New("sellers: database not configured")
	}
	l, err := scanLead(r.pool.QueryRow(ctx, `
		select `+leadColumns+` from sellers.seller_leads where lead_id = $1`, leadID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Lead{}, false, nil
		}
		return Lead{}, false, err
	}
	return l, true, nil
}

// UpdateLeadStatus moves a lead through the lifecycle and records who did it. The update is
// conditional on the current status, so two admins acting at once cannot both win: the loser gets
// ok=false and the handler answers 409 instead of silently overwriting the first decision.
func (r *Repo) UpdateLeadStatus(ctx context.Context, leadID, from, to, reviewer, note string) (Lead, bool, error) {
	if r.pool == nil {
		return Lead{}, false, errors.New("sellers: database not configured")
	}
	l, err := scanLead(r.pool.QueryRow(ctx, `
		update sellers.seller_leads
		   set status = $3, admin_note = $5, reviewed_by = $4, reviewed_at = now(), updated_at = now()
		 where lead_id = $1 and status = $2
		 returning `+leadColumns, leadID, from, to, reviewer, note))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Lead{}, false, nil
		}
		return Lead{}, false, err
	}
	return l, true, nil
}

// ClaimLead takes or releases a lead's call-back owner. An empty admin releases it. The update is
// conditional on the current owner so two admins cannot both believe they claimed it: the loser gets
// ok=false and the handler answers 409. Passing the caller's own id when they already own it is a
// no-op success.
func (r *Repo) ClaimLead(ctx context.Context, leadID, from, to string) (Lead, bool, error) {
	if r.pool == nil {
		return Lead{}, false, errors.New("sellers: database not configured")
	}
	l, err := scanLead(r.pool.QueryRow(ctx, `
		update sellers.seller_leads
		   set assigned_to = $3,
		       assigned_at = case when $3 = '' then null else now() end,
		       updated_at = now()
		 where lead_id = $1 and assigned_to = $2
		 returning `+leadColumns, leadID, from, to))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Lead{}, false, nil
		}
		return Lead{}, false, err
	}
	return l, true, nil
}

// LinkLeadToSeller back-fills seller_id on any lead that matches an application's contact phone or
// email. Called from the seller-create path, so an approved lead stops looking abandoned once the
// merchant actually applies. A no-op when nothing matches (the common case: most enquiries never
// convert). Never fails the seller creation — the application is the important write.
func (r *Repo) LinkLeadToSeller(ctx context.Context, phone, email, sellerID string) (int64, error) {
	if r.pool == nil || sellerID == "" {
		return 0, nil
	}
	tag, err := r.pool.Exec(ctx, `
		update sellers.seller_leads
		   set seller_id = $3, updated_at = now()
		 where seller_id is null
		   and (($1 <> '' and contact_phone = $1) or ($2 <> '' and lower(contact_email) = lower($2)))`,
		strings.TrimSpace(phone), strings.TrimSpace(email), sellerID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// listLeads is the admin queue read: role-gated, district-scoped.
func (h *Handler) listLeads(w http.ResponseWriter, r *http.Request) {
	f := LeadFilter{
		Status: strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status"))),
		Query:  strings.TrimSpace(r.URL.Query().Get("q")),
	}
	// "mine" is always the caller; the client cannot ask for someone else's claims.
	switch strings.ToLower(strings.TrimSpace(r.URL.Query().Get("assigned"))) {
	case "me":
		f.AssignedTo = h.actor(r)
	case "unassigned":
		f.UnassignedOnly = true
	}
	if f.Status != "" && !leadStatuses[f.Status] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown lead status")
		return
	}
	f.DistrictCode, f.StateCode = leadScope(r)
	// A super admin may narrow the queue to one district (the portal's district picker). The scope
	// from leadScope always wins for a scoped admin: a district admin asking for another district is
	// ignored rather than widened, so this cannot be used to escape their claim.
	if f.DistrictCode == "" {
		if d := geo.Normalise(r.URL.Query().Get("district")); d != "" {
			f.DistrictCode = d
		}
	}
	items, err := h.repo.ListLeads(r.Context(), f)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "leads_unavailable", "seller leads unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type updateLeadBody struct {
	Status string `json:"status"`
	Note   string `json:"note"`
}

// updateLead moves one lead's status. The scope check mirrors the fee-change queue: an out-of-scope
// id is a 404, so a district admin cannot even probe another district's leads.
func (h *Handler) updateLead(w http.ResponseWriter, r *http.Request) {
	leadID := strings.TrimSpace(chi.URLParam(r, "id"))
	l, ok, err := h.repo.LeadByID(r.Context(), leadID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "leads_unavailable", "seller leads unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), "", l.DistrictCode, l.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "lead not found")
		return
	}

	var req updateLeadBody
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	to := strings.ToUpper(strings.TrimSpace(req.Status))
	note := strings.TrimSpace(req.Note)
	if !leadStatuses[to] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "status must be NEW, CONTACTED, APPROVED or REJECTED")
		return
	}
	if len(note) > leadNotesMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "note is too long")
		return
	}
	if to == "REJECTED" && len(note) < 4 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "give a short reason for rejecting the lead")
		return
	}
	// A no-op move is not an error, but it must not rewrite reviewed_by/reviewed_at.
	if to == l.Status {
		httpx.JSON(w, http.StatusOK, l)
		return
	}

	updated, ok, err := h.repo.UpdateLeadStatus(r.Context(), l.LeadID, l.Status, to, h.actor(r), note)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "lead_update_failed", "could not update the lead")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "status_changed", "another admin already moved this lead")
		return
	}
	h.logLead(r, l, updated)
	httpx.JSON(w, http.StatusOK, updated)
}

type claimLeadBody struct {
	// Assigned is "me" (claim for the caller) or "" (release). Never an arbitrary admin id: taking a
	// call-back for someone else would hide it from the person who has to make the call.
	Assigned string `json:"assigned"`
}

// claimLead takes or releases a lead. The owner is always the caller, so the request can only express
// "claim" or "release", never "give it to X".
func (h *Handler) claimLead(w http.ResponseWriter, r *http.Request) {
	leadID := strings.TrimSpace(chi.URLParam(r, "id"))
	l, ok, err := h.repo.LeadByID(r.Context(), leadID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "leads_unavailable", "seller leads unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), "", l.DistrictCode, l.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "lead not found")
		return
	}

	var req claimLeadBody
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	want := strings.ToLower(strings.TrimSpace(req.Assigned))
	if want != "" && want != "me" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", `assigned must be "me" or empty`)
		return
	}
	to := ""
	if want == "me" {
		to = h.actor(r)
	}
	// Already in the requested state: a no-op success, so a double-click is harmless.
	if l.AssignedTo == to {
		httpx.JSON(w, http.StatusOK, l)
		return
	}
	// A claim only succeeds on an unclaimed lead, and only the owner may release. Passing the observed
	// owner as the update's "from" is not enough on its own: both admins read "" before either wrote,
	// so a takeover would otherwise look like a legitimate conditional update.
	if to != "" && l.AssignedTo != "" {
		httpx.Fail(w, http.StatusConflict, "assigned_to_other", "another admin owns this lead")
		return
	}
	if to == "" && l.AssignedTo != h.actor(r) {
		httpx.Fail(w, http.StatusConflict, "assigned_to_other", "another admin owns this lead")
		return
	}

	updated, ok, err := h.repo.ClaimLead(r.Context(), l.LeadID, l.AssignedTo, to)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "lead_update_failed", "could not update the lead")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "assigned_changed", "another admin just claimed this lead")
		return
	}
	h.logLeadAssignment(r, l, updated)
	httpx.JSON(w, http.StatusOK, updated)
}

// logLeadAssignment records a claim/release. Separate action from a status move so the audit trail
// distinguishes "took the call" from "decided the outcome".
func (h *Handler) logLeadAssignment(r *http.Request, before, after Lead) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: h.actor(r), ActorRole: h.role(r),
		Action: "SELLER_LEAD_ASSIGN", Entity: "sellers.seller_leads", EntityID: after.LeadID,
		Before: marshal(map[string]string{"assignedTo": before.AssignedTo}),
		After: marshal(map[string]string{
			"assignedTo":   after.AssignedTo,
			"districtCode": after.DistrictCode,
		}),
	})
}

// logLead records the status change. Best-effort like every other audit write in this package. The
// contact phone/email are redacted exactly as the seller audit entries redact them.
func (h *Handler) logLead(r *http.Request, before, after Lead) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: h.actor(r), ActorRole: h.role(r),
		Action: "SELLER_LEAD_STATUS", Entity: "sellers.seller_leads", EntityID: after.LeadID,
		Before: marshal(map[string]string{
			"status": before.Status, "districtCode": before.DistrictCode,
		}),
		After: marshal(map[string]string{
			"status":         after.Status,
			"districtCode":   after.DistrictCode,
			"businessName":   after.BusinessName,
			"contactPhone":   "***",
			"contactEmail":   "***",
			"hasShopPin":     fmt.Sprintf("%t", after.Latitude != nil && after.Longitude != nil),
			"adminNoteChars": fmt.Sprintf("%d", len(after.AdminNote)),
		}),
	})
}

// leadScope maps the caller's identity to the queue's district/state filter. A district admin with a
// district claim is locked to it; a legacy admin without one falls back to the parent state.
func leadScope(r *http.Request) (district, state string) {
	if auth.Role(r.Context()) != auth.RoleDistrictAdmin {
		return "", ""
	}
	if d := auth.DistrictCode(r.Context()); d != "" {
		return d, ""
	}
	return "", strings.ToUpper(strings.TrimSpace(auth.StateCode(r.Context())))
}
