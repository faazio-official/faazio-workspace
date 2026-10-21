package settlement

import (
	"encoding/json"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/razorpayroute"
	"github.com/go-chi/chi/v5"
)

// Handler serves the settlement ledger + payouts. Sellers read only their own; super admins may read
// all and schedule/release payouts. Money is server-derived — there is no client write path for a
// ledger row.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
	route razorpayroute.Gateway
	fees  contracts.SellerProfileReader
}

// NewHandler builds the settlement handler. route/fees may be nil (hold endpoints return 503).
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter, route razorpayroute.Gateway, fees contracts.SellerProfileReader) *Handler {
	if route == nil {
		route = razorpayroute.New("", "", "")
	}
	return &Handler{repo: repo, cache: c, audit: audit, route: route, fees: fees}
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
		// Razorpay Route split: hold the seller slice for the buyer-protection window, then release.
		g.Post("/payouts/holds", h.createHold)
		g.Post("/payouts/{id}/release", h.release)
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

type holdRequest struct {
	SellerID     string `json:"sellerId"`
	Cycle        string `json:"cycle"`
	PaymentID    string `json:"paymentId"`
	GrossAmount  int64  `json:"grossAmount"`  // whole rupees captured from the customer
	ReleaseAfter string `json:"releaseAfter"` // optional RFC3339; default now + 14 days
}

type holdResponse struct {
	Payout     Payout `json:"payout"`
	Gross      int64  `json:"gross"`
	Commission int64  `json:"commission"`
	Net        int64  `json:"net"`
}

func (h *Handler) createHold(w http.ResponseWriter, r *http.Request) {
	if h.fees == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "settlement_unconfigured", "seller profile reader not configured")
		return
	}
	var req holdRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.SellerID = strings.TrimSpace(req.SellerID)
	req.PaymentID = strings.TrimSpace(req.PaymentID)
	req.Cycle = strings.TrimSpace(req.Cycle)
	if req.Cycle == "" {
		req.Cycle = time.Now().UTC().Format("2006-01")
	}
	if req.SellerID == "" || req.PaymentID == "" || req.GrossAmount <= 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "sellerId, paymentId and grossAmount are required")
		return
	}
	releaseAfter := time.Now().UTC().Add(14 * 24 * time.Hour)
	if strings.TrimSpace(req.ReleaseAfter) != "" {
		t, err := time.Parse(time.RFC3339, strings.TrimSpace(req.ReleaseAfter))
		if err != nil {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "releaseAfter must be RFC3339")
			return
		}
		releaseAfter = t.UTC()
	}
	profile, err := h.fees.SettlementProfile(r.Context(), req.SellerID)
	if err != nil {
		httpx.Fail(w, http.StatusNotFound, "seller_not_found", "seller not found")
		return
	}
	if profile.LinkedAccountID == "" {
		httpx.Fail(w, http.StatusConflict, "kyc_incomplete", "seller has no Razorpay linked account")
		return
	}
	commission := int64(math.Round(float64(req.GrossAmount) * float64(profile.PlatformFeePct) / 100))
	net := req.GrossAmount - commission
	if net <= 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "platform fee leaves no seller share")
		return
	}

	transferID, err := h.route.CreateTransfer(r.Context(), razorpayroute.TransferInput{
		PaymentID: req.PaymentID, AccountID: profile.LinkedAccountID,
		AmountPaisa: net * 100, OnHoldUntil: releaseAfter,
		Notes: map[string]string{"seller_id": req.SellerID, "cycle": req.Cycle},
	})
	if err != nil {
		httpx.Fail(w, http.StatusBadGateway, "razorpay_unavailable", "could not create the Route transfer")
		return
	}

	p, err := h.repo.CreateHoldPayout(r.Context(), Payout{
		SellerID: req.SellerID, Cycle: req.Cycle, Amount: net,
		ScheduledFor: releaseAfter.Format(time.RFC3339), ReleaseAfter: releaseAfter.Format(time.RFC3339),
		RazorpayTransferID: transferID,
	})
	if err != nil {
		// The transfer exists but the local record failed; surface the transfer id so ops can reconcile.
		httpx.Fail(w, http.StatusInternalServerError, "payout_create_failed", "transfer created but payout record failed")
		return
	}
	if _, err := h.repo.AddLedgerEntry(r.Context(), LedgerEntry{
		SellerID: req.SellerID, Cycle: req.Cycle, OrderValue: req.GrossAmount,
		Commission: commission, TCS: 0, NetPayout: net,
	}); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ledger_create_failed", "could not record the settlement entry")
		return
	}
	h.cache.Del(r.Context(), cache.Settlement(req.SellerID, req.Cycle))
	h.log(r, "PAYOUT_HOLD", p.PayoutID, nil, map[string]any{"transferId": transferID, "net": net})
	httpx.JSON(w, http.StatusCreated, holdResponse{Payout: p, Gross: req.GrossAmount, Commission: commission, Net: net})
}

func (h *Handler) release(w http.ResponseWriter, r *http.Request) {
	p, ok, err := h.repo.PayoutByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payouts unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "payout not found")
		return
	}
	if p.Status != "ON_HOLD" {
		httpx.Fail(w, http.StatusConflict, "not_hold", "only a held payout can be released")
		return
	}
	if p.RazorpayTransferID != "" {
		if err := h.route.ReleaseTransfer(r.Context(), p.RazorpayTransferID); err != nil {
			httpx.Fail(w, http.StatusBadGateway, "razorpay_unavailable", "could not release the Route transfer")
			return
		}
	}
	released, ok, err := h.repo.ReleasePayout(r.Context(), p.PayoutID)
	if err != nil || !ok {
		httpx.Fail(w, http.StatusInternalServerError, "payout_update_failed", "could not release payout")
		return
	}
	h.cache.Del(r.Context(), cache.Settlement(released.SellerID, released.Cycle))
	h.log(r, "PAYOUT_RELEASE", released.PayoutID, map[string]string{"status": p.Status},
		map[string]string{"status": released.Status})
	httpx.JSON(w, http.StatusOK, released)
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
