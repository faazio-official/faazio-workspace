package sellers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/httpx"
)

// The admin follow-up queue for web enquiries reads sellers.sellers rows with status INQUIRY. There is
// no separate table (0129): an enquiry is a seller account that has not been through KYC, so the
// queue, the seller list and the seller detail all speak one shape and one id space.
//
// Lifecycle: INQUIRY —(an admin claims and calls)— the follow-up stage moves NEW → CONTACTED, then the
// seller_status moves to PENDING_REVIEW (the merchant is proceeding; they complete KYC in the app) or
// REJECTED (with a reason the merchant can read). INQUIRY → ACTIVE is refused: activation requires the
// KYC documents an enquiry has never provided.

// inquiryStages are the operator-side follow-up states recorded on an INQUIRY row. They are NOT the
// seller_status lifecycle (that only moves to PENDING_REVIEW/REJECTED on a decision); they track the
// call-back itself, so "contacted, no decision yet" is visible without pretending the application
// advanced.
var inquiryStages = map[string]bool{"NEW": true, "CONTACTED": true, "APPROVED": true, "REJECTED": true}

// InquiryFilter narrows the admin queue.
type InquiryFilter struct {
	StateCode    string
	DistrictCode string
	Stage        string
	Query        string
	Assigned     string // "me" | "unassigned" | ""
	AdminID      string
}

// ListInquiries returns INQUIRY rows scoped to the caller. A district admin sees their district; a
// super admin sees everything; the optional query matches business/owner/phone.
func (r *Repo) ListInquiries(ctx context.Context, f InquiryFilter) ([]Seller, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, sellerSelect+`
		 where status = 'INQUIRY'
		   and ($1 = '' or state_code = $1)
		   and ($2 = '' or district_code = $2)
		   and ($3 = '' or coalesce(inquiry_stage,'NEW') = $3)
		   and ($4 = '' or business_name ilike '%'||$4||'%' or owner_name ilike '%'||$4||'%'
		        or coalesce(phone,'') like '%'||$4||'%')
		   and ($5 = '' or ($5 = 'unassigned' and coalesce(inquiry_assigned_to,'') = '')
		                or ($5 <> 'unassigned' and inquiry_assigned_to = $6))
		 order by created_at desc`,
		f.StateCode, f.DistrictCode, f.Stage, f.Query, f.Assigned, f.AdminID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Seller{}
	for rows.Next() {
		s, err := scanSeller(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// SetInquiryStage moves the follow-up stage and/or claims the call-back. An empty stage leaves the
// stage unchanged; assign non-nil claims for adminID (true) or releases (false). It never touches
// seller_status: a decision goes through SetStatus (INQUIRY → PENDING_REVIEW | REJECTED).
func (r *Repo) SetInquiryStage(ctx context.Context, id, stage, adminID string, assign *bool) (Seller, bool, error) {
	if r.pool == nil {
		return Seller{}, false, fmt.Errorf("sellers: database not configured")
	}
	var stageArg, assignArg any
	if stage != "" {
		stageArg = stage
	}
	if assign != nil {
		assignArg = *assign
	}
	// One statement so "claim" and "advance" can never interleave into a half-written row.
	s, err := scanSeller(r.pool.QueryRow(ctx, `
		update sellers.sellers set
		  inquiry_stage = coalesce($2::text, inquiry_stage),
		  inquiry_assigned_to = case when $3::bool is null then inquiry_assigned_to
		                             when $3 then $4 else '' end,
		  inquiry_assigned_at = case when $3::bool is null then inquiry_assigned_at
		                             when $3 then now() else null end,
		  updated_at = now()
		 where seller_id = $1 and status = 'INQUIRY'
		 returning `+sellerColumns, id, stageArg, assignArg, adminID))
	if err != nil {
		if isNoRows(err) {
			return Seller{}, false, nil
		}
		return Seller{}, false, err
	}
	return s, true, nil
}

// listInquiries serves GET /seller-inquiries for the admin queue.
func (h *Handler) listInquiries(w http.ResponseWriter, r *http.Request) {
	f := InquiryFilter{
		StateCode:    strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state"))),
		DistrictCode: geo.Normalise(r.URL.Query().Get("district")),
		Stage:        strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("stage"))),
		Query:        strings.TrimSpace(r.URL.Query().Get("q")),
		Assigned:     strings.ToLower(strings.TrimSpace(r.URL.Query().Get("assigned"))),
		AdminID:      auth.UserID(r.Context()),
	}
	if f.Stage != "" && !inquiryStages[f.Stage] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid stage")
		return
	}
	// District admins are scoped to their district (or parent state for a legacy admin claim); a super
	// admin may narrow by district but never loses the wider view unless they ask for one.
	if auth.Role(r.Context()) == auth.RoleDistrictAdmin {
		if d := auth.DistrictCode(r.Context()); d != "" {
			f.DistrictCode = d
			f.StateCode = ""
		} else {
			f.StateCode = auth.StateCode(r.Context())
			f.DistrictCode = ""
		}
	}
	items, err := h.repo.ListInquiries(r.Context(), f)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "inquiries unavailable")
		return
	}
	if allowed := auth.AllowedVerticals(r.Context()); allowed != nil {
		filtered := items[:0]
		for _, it := range items {
			if sellerInVerticalScope(r.Context(), it) {
				filtered = append(filtered, it)
			}
		}
		items = filtered
	}
	httpx.JSON(w, http.StatusOK, h.withPhotoURLsList(items))
}

type updateInquiryRequest struct {
	// Stage moves the follow-up state (NEW/CONTACTED/APPROVED/REJECTED). Empty leaves it unchanged.
	Stage string `json:"stage"`
	// Status moves the seller lifecycle (PENDING_REVIEW | REJECTED). INQUIRY → ACTIVE is refused.
	Status string `json:"status"`
	Reason string `json:"reason"`
}

// updateInquiry applies a follow-up stage and/or a lifecycle decision to one INQUIRY row.
func (h *Handler) updateInquiry(w http.ResponseWriter, r *http.Request) {
	s, ok := h.adminSeller(w, r)
	if !ok {
		return
	}
	if s.Status != "INQUIRY" {
		httpx.Fail(w, http.StatusConflict, "not_an_inquiry", "this seller is not an open enquiry")
		return
	}
	var req updateInquiryRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Stage = strings.ToUpper(strings.TrimSpace(req.Stage))
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	req.Reason = strings.TrimSpace(req.Reason)
	if req.Stage != "" && !inquiryStages[req.Stage] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid stage")
		return
	}
	if req.Stage == "" && req.Status == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "no changes provided")
		return
	}
	if req.Status != "" {
		if !validInquiryTransition(req.Status) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request",
				"an enquiry can only move to PENDING_REVIEW or REJECTED")
			return
		}
		if req.Status == "REJECTED" && len(req.Reason) < 4 {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "a rejection reason is required")
			return
		}
		if len(req.Reason) > 500 {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "reason is too long")
			return
		}
	}
	if req.Stage != "" {
		// Contacting or approving an enquiry takes ownership of the call-back, unless someone already
		// did — claiming is about not stepping on another admin's call, not about reassignment.
		var assignPtr *bool
		if (req.Stage == "CONTACTED" || req.Stage == "APPROVED") && s.InquiryAssignedTo == "" {
			claim := true
			assignPtr = &claim
		}
		if _, ok, err := h.repo.SetInquiryStage(r.Context(), s.SellerID, req.Stage, h.actor(r), assignPtr); err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update enquiry")
			return
		} else if !ok {
			httpx.Fail(w, http.StatusNotFound, "not_found", "enquiry not found")
			return
		}
		h.log(r, "SELLER_INQUIRY_STAGE", s.SellerID,
			map[string]string{"status": s.Status}, map[string]string{"stage": req.Stage})
	}
	if req.Status != "" {
		after, ok, err := h.repo.SetStatus(r.Context(), s.SellerID, req.Status, req.Reason, h.actor(r))
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update enquiry")
			return
		}
		if !ok {
			httpx.Fail(w, http.StatusNotFound, "not_found", "enquiry not found")
			return
		}
		h.log(r, "SELLER_"+req.Status, s.SellerID,
			map[string]string{"status": s.Status}, map[string]string{"status": after.Status})
	}
	detail, _, _ := h.repo.DetailByID(r.Context(), s.SellerID)
	detail.Seller = h.withPhotoURLs(detail.Seller)
	httpx.JSON(w, http.StatusOK, detail)
}

// claimInquiry claims (assigned=true) or releases the call-back. The owner is always the caller, so an
// admin cannot hand an enquiry to someone else.
func (h *Handler) claimInquiry(w http.ResponseWriter, r *http.Request) {
	s, ok := h.adminSeller(w, r)
	if !ok {
		return
	}
	if s.Status != "INQUIRY" {
		httpx.Fail(w, http.StatusConflict, "not_an_inquiry", "this seller is not an open enquiry")
		return
	}
	var req struct {
		Assigned string `json:"assigned"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	assign := strings.EqualFold(strings.TrimSpace(req.Assigned), "me")
	if !assign && strings.TrimSpace(req.Assigned) != "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", `assigned must be "me" or ""`)
		return
	}
	row, ok, err := h.repo.SetInquiryStage(r.Context(), s.SellerID, "", h.actor(r), &assign)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update enquiry")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "enquiry not found")
		return
	}
	h.log(r, "SELLER_INQUIRY_ASSIGN", s.SellerID, nil, map[string]string{"assignedTo": row.InquiryAssignedTo})
	httpx.JSON(w, http.StatusOK, h.withPhotoURLs(row))
}

// validInquiryTransition is the INQUIRY lifecycle guard: an enquiry may become a pending application
// or be rejected, never ACTIVE (activation needs KYC the enquiry has not provided) and never SUSPENDED
// (nothing to suspend yet).
func validInquiryTransition(status string) bool {
	return status == "PENDING_REVIEW" || status == "REJECTED"
}

func decodeShopPhotos(raw []byte) []ShopPhoto {
	out := []ShopPhoto{}
	if len(raw) == 0 {
		return out
	}
	var rows []ShopPhoto
	if err := json.Unmarshal(raw, &rows); err != nil {
		return out
	}
	return rows
}
