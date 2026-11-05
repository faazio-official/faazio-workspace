package payouts

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the payout ledger + manual "Mark as Paid" plane. Sellers read only their own;
// state/super admins view the combined board; only a super admin can mark a seller payout paid.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
}

// NewHandler builds the payout handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit}
}

// Register mounts the payout routes. The legacy /settlements + /payouts paths keep the portal
// hydration contract; the Route hold/webhook endpoints are gone (manual payouts replace them).
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleSuperAdmin))
		g.Get("/settlements", h.ledger)
		g.Get("/payouts", h.payouts)
		// Seller-facing payment ledger: all cycles, and one cycle's line items.
		g.Get("/seller/payments", h.sellerPayments)
		g.Get("/seller/payments/{cycleId}", h.sellerPaymentCycle)
		// The separate payout invoice for one of the caller's own payout rows (0078).
		g.Get("/seller/payout-invoices/{payoutId}", h.sellerPayoutInvoices)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/admin/seller/payouts", h.adminSummaries)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Post("/admin/seller/payouts/{sellerId}/mark-paid", h.markPaid)
		g.Get("/admin/seller/payout-invoices/{payoutId}", h.adminPayoutInvoices)
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
	if sellerID != "" && cycle != "" {
		var cached []LedgerEntry
		if h.cache != nil && h.cache.GetJSON(r.Context(), cache.Settlement(sellerID, cycle), &cached) {
			httpx.JSON(w, http.StatusOK, cached)
			return
		}
		entries, err := h.repo.Ledger(r.Context(), sellerID, cycle)
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payouts unavailable")
			return
		}
		if h.cache != nil {
			h.cache.SetJSON(r.Context(), cache.Settlement(sellerID, cycle), entries, cache.TTLSettlement)
		}
		httpx.JSON(w, http.StatusOK, entries)
		return
	}
	entries, err := h.repo.Ledger(r.Context(), sellerID, cycle)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payouts unavailable")
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

// sellerPayments returns the caller's whole settlement ledger (GET /seller/payments).
func (h *Handler) sellerPayments(w http.ResponseWriter, r *http.Request) {
	h.sellerLedger(w, r, "")
}

// sellerPaymentCycle returns the ledger line items for one settlement cycle
// (GET /seller/payments/{cycleId}).
func (h *Handler) sellerPaymentCycle(w http.ResponseWriter, r *http.Request) {
	h.sellerLedger(w, r, chi.URLParam(r, "cycleId"))
}

func (h *Handler) sellerLedger(w http.ResponseWriter, r *http.Request, cycle string) {
	sellerID := auth.SellerID(r.Context())
	if sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	entries, err := h.repo.Ledger(r.Context(), sellerID, cycle)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payouts unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, entries)
}

// adminSummaries is the super/state payout board: owed + paid + balance per seller per cycle.
func (h *Handler) adminSummaries(w http.ResponseWriter, r *http.Request) {
	district := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("district")))
	state := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	role := auth.Role(r.Context())
	if role == auth.RoleStateAdmin {
		if state = strings.ToUpper(strings.TrimSpace(auth.StateCode(r.Context()))); state == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no state scope on this account")
			return
		}
		district = ""
	}
	items, err := h.repo.Summaries(r.Context(), district, state)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payouts unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// markPaid records a manual seller payout (super admin; amount paisa in the body). The balance
// carries forward when the typed amount is less than what is owed.
func (h *Handler) markPaid(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(chi.URLParam(r, "sellerId"))
	var req markPaidRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Cycle = strings.TrimSpace(req.Cycle)
	if sellerID == "" || !cycleRe.MatchString(req.Cycle) || req.AmountPaisa <= 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request",
			"sellerId, a YYYY-MM cycle and a positive amountPaisa are required")
		return
	}
	p, err := h.repo.MarkSellerPayoutPaid(r.Context(), sellerID, req.Cycle, req.AmountPaisa, auth.UserID(r.Context()))
	if err != nil {
		if errors.Is(err, ErrAboveBalance) {
			httpx.Fail(w, http.StatusBadRequest, "amount_exceeds_balance",
				"amount exceeds the outstanding balance for this cycle")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "payout_mark_failed", "could not mark the payout paid")
		return
	}
	if h.cache != nil {
		h.cache.Del(r.Context(), cache.Settlement(sellerID, req.Cycle))
	}
	h.log(r, "SELLER_PAYOUT_PAID", p.PayoutID, nil, p)
	httpx.JSON(w, http.StatusOK, p)
}

type markPaidRequest struct {
	Cycle       string `json:"cycle"`
	AmountPaisa int64  `json:"amountPaisa"`
}

// adminPayoutInvoices returns the separate payout invoices for one payout id (superadmin download,
// 0078). This is the B2B settlement document — the per-order tax invoice is untouched.
func (h *Handler) adminPayoutInvoices(w http.ResponseWriter, r *http.Request) {
	payoutID := strings.TrimSpace(chi.URLParam(r, "payoutId"))
	if payoutID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "payoutId is required")
		return
	}
	items, err := h.repo.PayoutInvoices(r.Context(), payoutID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payout invoices unavailable")
		return
	}
	if items == nil {
		items = []PayoutInvoice{}
	}
	httpx.JSON(w, http.StatusOK, items)
}

// sellerPayoutInvoices returns the payout invoices for a payout row owned by the caller's seller.
func (h *Handler) sellerPayoutInvoices(w http.ResponseWriter, r *http.Request) {
	sellerID := auth.SellerID(r.Context())
	if sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	payoutID := strings.TrimSpace(chi.URLParam(r, "payoutId"))
	if payoutID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "payoutId is required")
		return
	}
	items, err := h.repo.PayoutInvoicesForSeller(r.Context(), sellerID, payoutID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payouts_unavailable", "payout invoices unavailable")
		return
	}
	if items == nil {
		items = []PayoutInvoice{}
	}
	httpx.JSON(w, http.StatusOK, items)
}

var cycleRe = regexp.MustCompile(`^\d{4}-\d{2}$`)

func (h *Handler) log(r *http.Request, action, entityID string, before, after any) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID:   auth.UserID(r.Context()),
		ActorRole: auth.Role(r.Context()),
		Action:    action,
		Entity:    "payments.payouts",
		EntityID:  entityID,
		Before:    marshalJSON(before),
		After:     marshalJSON(after),
	})
}

func marshalJSON(v any) []byte {
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return b
}