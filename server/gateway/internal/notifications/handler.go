package notifications

import (
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the auth-scoped notification inbox + push-token registry, and the admin outbox view.
type Handler struct {
	repo    *Repo
	cache   *cache.Cache
	drainer contracts.Drainer
}

// NewHandler builds the notifications handler. drainer may be nil (manual drain disabled).
func NewHandler(repo *Repo, c *cache.Cache, drainer contracts.Drainer) *Handler {
	return &Handler{repo: repo, cache: c, drainer: drainer}
}

// Register mounts notification endpoints.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/notifications", h.inbox)
		g.Get("/notifications/unread-count", h.unreadCount)
		g.Post("/notifications/register", h.register)
		g.Delete("/notifications/register", h.unregister)
		// Per-notification and bulk in-app read state (auth-scoped; a foreign id is a no-op).
		g.Post("/notifications/{id}/read", h.markRead)
		g.Post("/notifications/read-all", h.markAllRead)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/admin/notifications", h.outbox)
		// Manual drain trigger: runs one synchronous, bounded outbox batch (503 when no push provider).
		g.Post("/notifications/drain", h.drain)
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

func (h *Handler) unreadCount(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var n int
	if h.cache.GetJSON(r.Context(), cache.NotificationsUnread(userID), &n) {
		httpx.JSON(w, http.StatusOK, map[string]any{"count": n})
		return
	}
	count, err := h.repo.UnreadCount(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "notifications_unavailable", "notifications unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.NotificationsUnread(userID), count, cache.TTLNotifications)
	httpx.JSON(w, http.StatusOK, map[string]any{"count": count})
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" || len(id) > 128 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid notification id")
		return
	}
	if err := h.repo.MarkRead(r.Context(), auth.UserID(r.Context()), id); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "notifications_unavailable", "notifications unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) markAllRead(w http.ResponseWriter, r *http.Request) {
	if err := h.repo.MarkAllRead(r.Context(), auth.UserID(r.Context())); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "notifications_unavailable", "notifications unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
		// TokenKind distinguishes the FCM/APNs alert token ("push", default) from the PushKit VoIP
		// token ("voip"). A device registers both; the drain query prefers the VoIP token for calls.
		TokenKind string `json:"tokenKind"`
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
	kind := strings.ToLower(strings.TrimSpace(body.TokenKind))
	if kind != TokenKindVoIP {
		kind = TokenKindPush
	}
	if err := h.repo.Register(r.Context(), auth.UserID(r.Context()), token,
		strings.ToLower(strings.TrimSpace(body.Platform)), kind); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "register_failed", "could not register device")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) unregister(w http.ResponseWriter, r *http.Request) {
	if err := h.repo.Unregister(r.Context(), auth.UserID(r.Context())); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "register_failed", "could not remove device")
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

// drain runs one synchronous, bounded outbox batch (see adminDrainBatch). 503 when no push provider
// is configured (the app still polls GET /notifications); admin-only, never exposes tokens.
func (h *Handler) drain(w http.ResponseWriter, r *http.Request) {
	if h.drainer == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "push_unconfigured", "push delivery not configured")
		return
	}
	if err := h.drainer.DrainOnce(r.Context()); err != nil {
		if errors.Is(err, ErrNoSender) {
			httpx.Fail(w, http.StatusServiceUnavailable, "push_unconfigured", "push delivery not configured")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "drain_failed", "could not drain outbox")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}
