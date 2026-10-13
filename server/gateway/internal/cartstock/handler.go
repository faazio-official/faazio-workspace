package cartstock

import (
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves cart + stock endpoints.
type Handler struct {
	repo *Repo
}

// NewHandler builds the cartstock handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts public stock + auth-scoped cart endpoints.
func (h *Handler) Register(r chi.Router) {
	r.Get("/stock/{productId}", h.getStock)
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/cart", h.getCart)
		g.Post("/cart/items", h.addItem)
		g.Put("/cart/items", h.updateItem)
		g.Delete("/cart/items/{productId}", h.removeItem)
	})
}

func (h *Handler) getStock(w http.ResponseWriter, r *http.Request) {
	stock, ok, err := h.repo.StockByProductID(r.Context(), chi.URLParam(r, "productId"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "stock_unavailable", "stock unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "stock not found")
		return
	}
	httpx.JSON(w, http.StatusOK, stock)
}

func (h *Handler) getCart(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.GetCart(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "cart_unavailable", "cart unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) addItem(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r)
}

func (h *Handler) updateItem(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r)
}

func (h *Handler) removeItem(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.SetCartItem(r.Context(), auth.UserID(r.Context()), chi.URLParam(r, "productId"), 0)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "cart_unavailable", "cart unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) mutate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProductID string `json:"productId"`
		Qty       int64  `json:"qty"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.ProductID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "productId required")
		return
	}
	if body.Qty < 0 {
		body.Qty = 0
	}
	if body.Qty > 99 {
		body.Qty = 99
	}
	items, err := h.repo.SetCartItem(r.Context(), auth.UserID(r.Context()), body.ProductID, body.Qty)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "cart_unavailable", "cart unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}
