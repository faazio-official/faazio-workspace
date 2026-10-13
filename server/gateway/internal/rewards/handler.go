package rewards

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

// Handler serves the auth-scoped rewards view. Writes to balances/ledger happen inside checkout's
// order transaction (the server-authoritative earn path), never as a public endpoint — so a client
// cannot forge coins. Admins may read the ledger and tune the (non-history) earn rates.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
}

// NewHandler builds the rewards handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit}
}

// Register mounts rewards onto the shared router (auth-scoped).
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/rewards", h.get)
	})
	// Admin console: read any ledger + tune the program rates.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/rewards/ledger", h.ledger)
		g.Get("/rewards/rates", h.getRates)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Put("/rewards/rates", h.setRates)
	})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached View
	if h.cache.GetJSON(r.Context(), cache.Rewards(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	view, err := h.repo.View(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "rewards_unavailable", "rewards unavailable")
		return
	}
	if view.Ledger == nil {
		view.Ledger = []LedgerEntry{}
	}
	h.cache.SetJSON(r.Context(), cache.Rewards(userID), view, cache.TTLRewards)
	httpx.JSON(w, http.StatusOK, view)
}

func (h *Handler) ledger(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimSpace(r.URL.Query().Get("userId"))
	items, err := h.repo.Ledger(r.Context(), userID, httpx.LimitParam(r, 100, 200))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "rewards_unavailable", "rewards unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) getRates(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, h.repo.Rates(r.Context()))
}

func (h *Handler) setRates(w http.ResponseWriter, r *http.Request) {
	var req RateSet
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if req.CoinEarnRate < 1 || req.CoinEarnRate > 10000 ||
		req.CoinRedeemRate < 1 || req.CoinRedeemRate > 10000 ||
		req.StreakTargetDays < 1 || req.StreakTargetDays > 90 ||
		req.DiscountCardPercent < 0 || req.DiscountCardPercent > 90 ||
		req.CardValidityDays < 1 || req.CardValidityDays > 90 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "rates out of range")
		return
	}
	rs, err := h.repo.SetRates(r.Context(), req)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "rates_update_failed", "could not update rates")
		return
	}
	h.log(r, "REWARDS_RATES_UPDATE")
	httpx.JSON(w, http.StatusOK, rs)
}

func (h *Handler) log(r *http.Request, action string) {
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
	raw, _ := json.Marshal(map[string]string{"action": action})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: "rewards.rates", EntityID: "default", After: raw,
	})
}