package checkout

import (
	"errors"
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves orders + account endpoints.
type Handler struct {
	repo    *Repo
	service *Service
	cache   *cache.Cache
}

// NewHandler builds the checkout handler.
func NewHandler(repo *Repo, service *Service, c *cache.Cache) *Handler {
	return &Handler{repo: repo, service: service, cache: c}
}

// Register mounts auth-scoped order + account endpoints.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/orders", h.getOrders)
		g.Post("/orders", h.placeOrder)
		g.Get("/profile", h.getProfile)
		g.Get("/profile/details", h.getDetails)
		g.Get("/membership", h.getMembership)
		g.Get("/order-status", h.getOrderStatus)
		g.Get("/account-nav", h.getAccountNav)
	})
}

func (h *Handler) getOrders(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached []Order
	if h.cache.GetJSON(r.Context(), cache.Orders(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	orders, err := h.repo.OrdersByUser(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "orders_unavailable", "orders unavailable")
		return
	}
	if orders == nil {
		orders = []Order{}
	}
	h.cache.SetJSON(r.Context(), cache.Orders(userID), orders, cache.TTLOrders)
	httpx.JSON(w, http.StatusOK, orders)
}

func (h *Handler) placeOrder(w http.ResponseWriter, r *http.Request) {
	var req PlaceOrderRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	order, err := h.service.CreateOrder(r.Context(), auth.UserID(r.Context()), req)
	switch {
	case errors.Is(err, cache.ErrLockHeld):
		httpx.Fail(w, http.StatusConflict, "duplicate", "order already being placed")
	case errors.Is(err, ErrEmptyItems):
		httpx.Fail(w, http.StatusBadRequest, "empty_items", "order has no items")
	case errors.Is(err, ErrInsufficientStock):
		httpx.Fail(w, http.StatusConflict, "out_of_stock", "one or more items are out of stock")
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "order_failed", "could not place order")
	default:
		httpx.JSON(w, http.StatusCreated, order)
	}
}

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	p, ok, err := h.repo.ProfileByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "profile not found")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) getDetails(w http.ResponseWriter, r *http.Request) {
	d, ok, err := h.repo.DetailsByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "details not found")
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

func (h *Handler) getMembership(w http.ResponseWriter, r *http.Request) {
	m, ok, err := h.repo.MembershipByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if !ok {
		httpx.JSON(w, http.StatusOK, nil)
		return
	}
	httpx.JSON(w, http.StatusOK, m)
}

func (h *Handler) getOrderStatus(w http.ResponseWriter, r *http.Request) {
	rows, err := h.repo.OrderStatusByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if rows == nil {
		rows = []OrderStatus{}
	}
	httpx.JSON(w, http.StatusOK, rows)
}

func (h *Handler) getAccountNav(w http.ResponseWriter, r *http.Request) {
	rows, err := h.repo.NavByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if rows == nil {
		rows = []Nav{}
	}
	httpx.JSON(w, http.StatusOK, rows)
}
