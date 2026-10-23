package settlement

import (
	"encoding/json"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/razorpayroute"
	"github.com/faazio/server/gateway/internal/platform/taxmath"
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
		g.Post("/payouts/{id}/reverse", h.reverse)
	})
	// Public Route webhook: authenticated by HMAC only (no session), never trusts an unsigned body.
	r.Post("/webhooks/razorpay/route", h.routeWebhook)
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
	GrossAmount  int64  `json:"grossAmount"`  // whole rupees captured from the customer (GST-inclusive)
	GSTRatePct   int    `json:"gstRatePct"`   // optional; defaults to 5%
	ReleaseAfter string `json:"releaseAfter"` // optional RFC3339; default now + 14 days
}

type holdResponse struct {
	Payout      Payout `json:"payout"`
	Gross       int64  `json:"gross"`
	Commission  int64  `json:"commission"`
	TCS         int64  `json:"tcs"`
	TDS         int64  `json:"tds"`
	ProductTax  int64  `json:"productTax"`
	PlatformGST int64  `json:"platformGst"`
	Net         int64  `json:"net"`
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
	// Server-authoritative split: commission + TCS (1%) + TDS (0.1%) are withheld from the seller's
	// GST-inclusive gross. GST on the commission and the product GST are reporting figures only — the
	// product GST is already inside the gross and is remitted by the seller.
	rate := req.GSTRatePct
	if rate <= 0 {
		rate = taxmath.DefaultProductGSTRate
	}
	b := taxmath.Compute([]taxmath.Line{{
		GrossPaisa: req.GrossAmount * 100, GSTRatePct: rate, PlatformFeePct: profile.PlatformFeePct,
	}}, taxmath.DefaultRates())
	commission := int64(math.Round(float64(b.PlatformFeePaisa) / 100))
	tcs := int64(math.Round(float64(b.TCSPaisa) / 100))
	tds := int64(math.Round(float64(b.TDSPaisa) / 100))
	productTax := int64(math.Round(float64(b.ProductTaxPaisa) / 100))
	platformGST := int64(math.Round(float64(b.PlatformGSTPaisa) / 100))
	net := req.GrossAmount - commission - tcs - tds
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
		Commission: commission, TCS: tcs, TDS: tds, ProductTax: productTax,
		PlatformGST: platformGST, NetPayout: net,
	}); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ledger_create_failed", "could not record the settlement entry")
		return
	}
	h.cache.Del(r.Context(), cache.Settlement(req.SellerID, req.Cycle))
	h.log(r, "PAYOUT_HOLD", p.PayoutID, nil, map[string]any{"transferId": transferID, "net": net})
	httpx.JSON(w, http.StatusCreated, holdResponse{
		Payout: p, Gross: req.GrossAmount, Commission: commission, TCS: tcs, TDS: tds,
		ProductTax: productTax, PlatformGST: platformGST, Net: net,
	})
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

// reverse claws the seller slice back for a refund / return. Ops override: Razorpay remains the
// authority and a rejection is surfaced as 502 (the local row is only updated after the API call).
func (h *Handler) reverse(w http.ResponseWriter, r *http.Request) {
	p, ok, err := h.repo.PayoutByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payouts unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "payout not found")
		return
	}
	if p.Status != "ON_HOLD" && p.Status != "SCHEDULED" && p.Status != "PAID" {
		httpx.Fail(w, http.StatusConflict, "not_reversible", "only a held or settled payout can be reversed")
		return
	}
	if p.RazorpayTransferID == "" {
		httpx.Fail(w, http.StatusConflict, "no_transfer", "payout has no Razorpay transfer")
		return
	}
	if err := h.route.ReverseTransfer(r.Context(), p.RazorpayTransferID); err != nil {
		httpx.Fail(w, http.StatusBadGateway, "razorpay_unavailable", "could not reverse the Route transfer")
		return
	}
	reversed, ok, err := h.repo.ReversePayout(r.Context(), p.PayoutID)
	if err != nil || !ok {
		httpx.Fail(w, http.StatusInternalServerError, "payout_update_failed", "could not reverse payout")
		return
	}
	h.cache.Del(r.Context(), cache.Settlement(reversed.SellerID, reversed.Cycle))
	h.log(r, "PAYOUT_REVERSE", reversed.PayoutID, map[string]string{"status": p.Status},
		map[string]string{"status": reversed.Status})
	httpx.JSON(w, http.StatusOK, reversed)
}

type routeWebhook struct {
	Event   string `json:"event"`
	Payload struct {
		Transfer struct {
			Entity struct {
				ID     string `json:"id"`
				Status string `json:"status"`
			} `json:"entity"`
		} `json:"transfer"`
	} `json:"payload"`
}

// routeEvent maps a Route webhook to (event, transferId). Unknown shapes return empty strings and
// are acknowledged without touching money state.
func routeEvent(body []byte) (event, transferID string) {
	var evt routeWebhook
	if err := json.Unmarshal(body, &evt); err != nil {
		return "", ""
	}
	return strings.TrimSpace(evt.Event), strings.TrimSpace(evt.Payload.Transfer.Entity.ID)
}

// routeWebhook reconciles Route transfer lifecycle events. It never trusts the body without a valid
// HMAC, never logs the payload, and returns 200 for events it does not own so Razorpay stops retrying.
func (h *Handler) routeWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, httpx.DefaultMaxBodyBytes))
	if err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if !h.route.VerifyWebhook(body, r.Header.Get("X-Razorpay-Signature")) {
		httpx.Fail(w, http.StatusBadRequest, "invalid_signature", "signature verification failed")
		return
	}
	event, transferID := routeEvent(body)
	if transferID == "" {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	var p Payout
	var moved bool
	switch event {
	case "transfer.released":
		p, moved, err = h.repo.MarkReleasedByTransfer(r.Context(), transferID)
	case "transfer.failed":
		p, moved, err = h.repo.MarkFailedByTransfer(r.Context(), transferID)
	case "transfer.reversed":
		p, moved, err = h.repo.MarkReversedByTransfer(r.Context(), transferID)
	default:
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "webhook_failed", "could not process webhook")
		return
	}
	if moved {
		h.cache.Del(r.Context(), cache.Settlement(p.SellerID, p.Cycle))
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
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
