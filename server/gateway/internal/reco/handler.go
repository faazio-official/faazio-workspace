package reco

import (
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves event tracking (layouts are read via LayoutSource by the sdui context).
type Handler struct {
	repo *Repo
}

// NewHandler builds the reco handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts event tracking onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Post("/events", h.track)
	})
}

func (h *Handler) track(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProductID string `json:"productId"`
		Event     string `json:"event"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.ProductID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "productId required")
		return
	}
	if body.Event == "" {
		body.Event = "view"
	}
	if err := h.repo.TrackEvent(r.Context(), auth.UserID(r.Context()), body.ProductID, body.Event); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "events_unavailable", "events unavailable")
		return
	}
	httpx.JSON(w, http.StatusAccepted, map[string]any{"ok": true})
}
