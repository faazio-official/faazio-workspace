package sdui

import (
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the compiled Home feed.
type Handler struct {
	service *Service
}

// NewHandler builds the sdui handler.
func NewHandler(service *Service) *Handler { return &Handler{service: service} }

// Register mounts the Home feed endpoint onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Get("/sdui/home", h.home)
}

func (h *Handler) home(w http.ResponseWriter, r *http.Request) {
	locale := r.URL.Query().Get("locale")
	sections, err := h.service.Home(r.Context(), locale)
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "home feed unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, sections)
}
