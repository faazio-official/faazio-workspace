package reco

import (
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves event tracking + the personalized recommendations read.
type Handler struct {
	repo    *Repo
	service *Service
}

// NewHandler builds the reco handler.
func NewHandler(repo *Repo, service *Service) *Handler { return &Handler{repo: repo, service: service} }

// Register mounts event tracking + recommendations onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Post("/events", h.track)
		g.Get("/recommendations", h.recommendations)
	})
}

// allowedEvents bounds user_events to a known vocabulary — junk events would otherwise
// grow the Atlas M0 collection unbounded.
var allowedEvents = map[string]bool{
	"view":     true,
	"cart_add": true,
	"order":    true,
	"search":   true,
}

const maxProductIDLen = 64

func (h *Handler) track(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProductID string `json:"productId"`
		Event     string `json:"event"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.ProductID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "productId required")
		return
	}
	if len(body.ProductID) > maxProductIDLen {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "productId too long")
		return
	}
	if body.Event == "" {
		body.Event = "view"
	}
	if !allowedEvents[body.Event] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unsupported event")
		return
	}
	if err := h.repo.TrackEvent(r.Context(), auth.UserID(r.Context()), body.ProductID, body.Event); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "events_unavailable", "events unavailable")
		return
	}
	httpx.JSON(w, http.StatusAccepted, map[string]any{"ok": true})
}

func (h *Handler) recommendations(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.Recommendations(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "reco_unavailable", "recommendations unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}
