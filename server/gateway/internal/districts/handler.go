package districts

import (
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the read-only district master picker data. Reads are available to any signed-in
// account (the seller-onboarding picker is the consumer).
type Handler struct {
	repo *Repo
}

// NewHandler builds the districts handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts the districts routes under /geo/districts.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/geo/districts", h.districts)
	})
}

func (h *Handler) districts(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if len(stateCode) > 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state must be a 2-letter code")
		return
	}
	items, err := h.repo.List(r.Context(), stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "districts_unavailable", "districts unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}
