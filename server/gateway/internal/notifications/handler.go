package notifications

import (
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the auth-scoped notification inbox + push-token registry, and the admin outbox view.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
}

// NewHandler builds the notifications handler.
func NewHandler(repo *Repo, c *cache.Cache) *Handler {
	return &Handler{repo: repo, cache: c}
}

// Register mounts notification endpoints.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/notifications", h.inbox)
		g.Post("/notifications/register", h.register)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/admin/notifications", h.outbox)
	})
}

func (h *Handler) inbox(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached []Notification
	if h.cache.GetJSON(r.Context(), cache.Notifications(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	items, err := h.repo.Inbox(r.Context(), userID, httpx.LimitParam(r, 50, 200))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "notifications_unavailable", "notifications unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.Notifications(userID), items, cache.TTLNotifications)
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	token := strings.TrimSpace(body.Token)
	if token == "" || len(token) > 512 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid token")
		return
	}
	if err := h.repo.Register(r.Context(), auth.UserID(r.Context()), token, strings.ToLower(strings.TrimSpace(body.Platform))); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "register_failed", "could not register device")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) outbox(w http.ResponseWriter, r *http.Request) {
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	items, err := h.repo.Outbox(r.Context(), status, httpx.LimitParam(r, 100, 200))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "notifications_unavailable", "notifications unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}
