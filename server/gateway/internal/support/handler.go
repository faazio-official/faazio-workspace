package support

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves support tickets + order returns. Customers raise their own; sellers see their own;
// state/super admins handle. Every status change is audited.
type Handler struct {
	repo  *Repo
	audit contracts.AuditWriter
}

// NewHandler builds the support handler.
func NewHandler(repo *Repo, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, audit: audit}
}

// Register mounts the support routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/support/tickets", h.listTickets)
		g.Post("/support/tickets", h.createTicket)
		g.Post("/returns", h.createReturn)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/returns", h.listReturns)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Put("/support/tickets/{id}", h.setTicketStatus)
		g.Put("/returns/{id}", h.setReturnStatus)
	})
}

func (h *Handler) listTickets(w http.ResponseWriter, r *http.Request) {
	var userID, sellerID, stateCode string
	switch auth.Role(r.Context()) {
	case auth.RoleStateAdmin:
		stateCode = auth.StateCode(r.Context())
		userID = strings.TrimSpace(r.URL.Query().Get("userId"))
		sellerID = strings.TrimSpace(r.URL.Query().Get("sellerId"))
	case auth.RoleSuperAdmin:
		stateCode = strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
		userID = strings.TrimSpace(r.URL.Query().Get("userId"))
		sellerID = strings.TrimSpace(r.URL.Query().Get("sellerId"))
	case auth.RoleSeller:
		sellerID = auth.SellerID(r.Context())
	default:
		userID = auth.UserID(r.Context())
	}
	items, err := h.repo.Tickets(r.Context(), userID, sellerID, stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "support_unavailable", "support unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type ticketRequest struct {
	SellerID string `json:"sellerId"`
	Subject  string `json:"subject"`
	Body     string `json:"body"`
}

func (h *Handler) createTicket(w http.ResponseWriter, r *http.Request) {
	var req ticketRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Subject = strings.TrimSpace(req.Subject)
	if req.Subject == "" || len(req.Body) > 2000 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "subject is required and body must be ≤ 2000 chars")
		return
	}
	sellerID := strings.TrimSpace(req.SellerID)
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	t, err := h.repo.CreateTicket(r.Context(), Ticket{
		UserID: auth.UserID(r.Context()), SellerID: sellerID, Subject: req.Subject, Body: req.Body,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ticket_create_failed", "could not create ticket")
		return
	}
	h.log(r, "TICKET_CREATE", "support.tickets", t.TicketID, nil, map[string]string{"subject": t.Subject})
	httpx.JSON(w, http.StatusCreated, t)
}

func (h *Handler) setTicketStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if !validTicketStatus(req.Status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid ticket status")
		return
	}
	// Scope before mutating: a district admin may only touch tickets in their own state.
	stateCode, found, err := h.repo.TicketScope(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "support_unavailable", "support unavailable")
		return
	}
	if !found || !auth.CanActForState(r.Context(), stateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "ticket not found")
		return
	}
	t, ok, err := h.repo.SetTicketStatus(r.Context(), id, req.Status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ticket_update_failed", "could not update ticket")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "ticket not found")
		return
	}
	h.log(r, "TICKET_"+req.Status, "support.tickets", id, nil, map[string]string{"status": t.Status})
	httpx.JSON(w, http.StatusOK, t)
}

func (h *Handler) listReturns(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	stateCode := ""
	switch auth.Role(r.Context()) {
	case auth.RoleSeller:
		sellerID = auth.SellerID(r.Context())
		if sellerID == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
			return
		}
	case auth.RoleStateAdmin:
		// District admins see only their own state's returns (never the national queue).
		stateCode = auth.StateCode(r.Context())
		if stateCode == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no state scope on this account")
			return
		}
	}
	items, err := h.repo.Returns(r.Context(), sellerID, "", stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "returns_unavailable", "returns unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type returnRequest struct {
	OrderID  string `json:"orderId"`
	SellerID string `json:"sellerId"`
	Reason   string `json:"reason"`
}

func (h *Handler) createReturn(w http.ResponseWriter, r *http.Request) {
	var req returnRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.OrderID = strings.TrimSpace(req.OrderID)
	if req.OrderID == "" || len(req.Reason) > 2000 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "orderId is required and reason must be ≤ 2000 chars")
		return
	}
	// A return may only be filed against the caller's own order. The seller is derived from the
	// order's vendor snapshot (the client cannot attach a return to an arbitrary seller).
	orderSeller, _, owned, err := h.repo.OrderReturnScope(r.Context(), req.OrderID, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "return_create_failed", "could not create return")
		return
	}
	if !owned {
		httpx.Fail(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	sellerID := strings.TrimSpace(req.SellerID)
	if orderSeller != "" {
		sellerID = orderSeller
	}
	ret, err := h.repo.CreateReturn(r.Context(), Return{
		OrderID: req.OrderID, UserID: auth.UserID(r.Context()),
		SellerID: sellerID, Reason: req.Reason,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "return_create_failed", "could not create return")
		return
	}
	h.log(r, "RETURN_CREATE", "checkout.returns", ret.ReturnID, nil, map[string]string{"orderId": ret.OrderID})
	httpx.JSON(w, http.StatusCreated, ret)
}

func (h *Handler) setReturnStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if !validReturnStatus(req.Status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid return status")
		return
	}
	// Scope before mutating: a district admin may only touch returns whose order is in their state.
	stateCode, found, err := h.repo.ReturnScope(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "returns_unavailable", "returns unavailable")
		return
	}
	if !found || !auth.CanActForState(r.Context(), stateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "return not found")
		return
	}
	ret, ok, err := h.repo.SetReturnStatus(r.Context(), id, req.Status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "return_update_failed", "could not update return")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "return not found")
		return
	}
	h.log(r, "RETURN_"+req.Status, "checkout.returns", id, nil, map[string]string{"status": ret.Status})
	httpx.JSON(w, http.StatusOK, ret)
}

func (h *Handler) log(r *http.Request, action, entity, entityID string, before, after any) {
	if h.audit == nil {
		return
	}
	actorID := auth.UserID(r.Context())
	if actorID == "" {
		actorID = auth.SellerID(r.Context())
	}
	if actorID == "" {
		actorID = "anonymous"
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleSeller
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: entity, EntityID: entityID,
		Before: marshal(before), After: marshal(after),
	})
}

func marshal(v any) json.RawMessage {
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return b
}

func validTicketStatus(s string) bool {
	switch s {
	case "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED":
		return true
	default:
		return false
	}
}

func validReturnStatus(s string) bool {
	switch s {
	case "REQUESTED", "APPROVED", "REJECTED", "COMPLETED":
		return true
	default:
		return false
	}
}
