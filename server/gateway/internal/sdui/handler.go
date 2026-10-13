package sdui

import (
	"fmt"
	"net/http"
	"strings"

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
	sections, version, err := h.service.Home(r.Context(), locale)
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "home feed unavailable")
		return
	}
	// The layout version is the ETag source: a publish bump turns repeat polls into 304s.
	etag := fmt.Sprintf(`"home-v%d"`, version)
	w.Header().Set("ETag", etag)
	if ifNoneMatch(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	httpx.JSON(w, http.StatusOK, sections)
}

// ifNoneMatch reports whether an If-None-Match header (possibly a comma list, possibly `*`)
// matches the current ETag.
func ifNoneMatch(header, etag string) bool {
	if header == "" {
		return false
	}
	for _, candidate := range strings.Split(header, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == etag || candidate == "*" || strings.TrimPrefix(candidate, "W/") == etag {
			return true
		}
	}
	return false
}
