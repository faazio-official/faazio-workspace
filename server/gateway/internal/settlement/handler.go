package settlement

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the settlement ledger + payouts. Sellers read only their own; super admins may read
// all and schedule payouts. Money is server-derived — there is no client write path for a ledger row.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
}

// NewHandler builds the settlement handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit}
}

// Register mounts the settlement routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleSuperAdmin))
		g.Get("/settlements", h.ledger)
		g.Get("/payouts", h.payouts)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Post("/payouts", h.createPayout)
	})
}

func (h *Handler) ledger(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
		if sellerID == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
			return
		}
	}
	cycle := strings.TrimSpace(r.URL.Query().Get("cycle"))
	// Settlement data is money; only cache when the key is fully scoped.
	if sellerID != "" && cycle != "" {
		var cached []LedgerEntry
		if h.cache.GetJSON(r.Context(), cache.Settlement(sellerID, cycle), &cached) {
			httpx.JSON(w, http.StatusOK, cached)
			return
		}
		entries, err := h.repo.Ledger(r.Context(), sellerID, cycle)
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "settlement_unavailable", "settlement unavailable")
			return
		}
		h.cache.SetJSON(r.Context(), cache.Settlement(sellerID, cycle), entries, cache.TTLSettlement)
		httpx.JSON(w, http.StatusOK, entries)
		return
	}
	entries, err := h.repo.Ledger(r.Context(), sellerID, cycle)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "settlement_unavailable", "settlement unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, entries)
}

func (h *Handler) payouts(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
		if sellerID == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
			return
		}
	}
	items, err := h.repo.Payouts(r.Context(), sellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payouts unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type payoutRequest struct {
	SellerID     string `json:"sellerId"`
	Cycle        string `json:"cycle"`
	Amount       int64  `json:"amount"`
	ScheduledFor string `json:"scheduledFor"`
}

func (h *Handler) createPayout(w http.ResponseWriter, r *http.Request) {
	var req payoutRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.SellerID = strings.TrimSpace(req.SellerID)
	req.Cycle = strings.TrimSpace(req.Cycle)
	if req.SellerID == "" || req.Cycle == "" || req.Amount <= 0 || strings.TrimSpace(req.ScheduledFor) == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "sellerId, cycle, amount and scheduledFor are required")
		return
	}
	p, err := h.repo.CreatePayout(r.Context(), Payout{
		SellerID: req.SellerID, Cycle: req.Cycle, Amount: req.Amount, ScheduledFor: req.ScheduledFor,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payout_create_failed", "could not schedule payout")
		return
	}
	h.cache.Del(r.Context(), cache.Settlement(req.SellerID, req.Cycle))
	h.log(r, "PAYOUT_CREATE", p.SellerID+":"+p.Cycle, nil, p)
	httpx.JSON(w, http.StatusCreated, p)
}

func (h *Handler) log(r *http.Request, action, entityID string, before, after any) {
	if h.audit == nil {
		return
	}
	actorID := auth.UserID(r.Context())
	if actorID == "" {
		actorID = "admin"
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleSuperAdmin
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: "payments.payouts", EntityID: entityID,
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
