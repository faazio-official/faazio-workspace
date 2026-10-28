// Package errorsink captures non-PII crash reports from the mobile apps (POST /errors).
//
// The app posts a bounded {message, stack, componentStack} on unhandled errors. Auth is optional —
// crashes happen before login too — so the caller sub is captured only when a token was present.
// The report is always written to the structured request log; the durable ops.error_events insert
// is best-effort so a missing migration or DB outage degrades to "logged, not stored".
package errorsink

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Bounds that keep the sink thin and spam-resistant.
const (
	maxMessageLen = 1000
	maxStackLen   = 16000
	anonymous     = "(anonymous)"
)

var allowedVariants = map[string]bool{"customer": true, "delivery": true, "seller": true}

// ErrReport is the client's crash/error payload. PII-free by contract: consumers never attach route
// params, tokens or keys — message + stack are dev-visible diagnostics only.
type ErrReport struct {
	AppVariant     string `json:"appVariant"`
	Release        string `json:"release"`
	Message        string `json:"message"`
	Stack          string `json:"stack,omitempty"`
	ComponentStack string `json:"componentStack,omitempty"`
}

// Handler serves the crash sink.
type Handler struct {
	pool *db.Pool
}

// New builds the crash-sink handler. A nil pool (tests) logs only.
func New(pool *db.Pool) *Handler { return &Handler{pool: pool} }

// Register mounts POST /errors. No auth.Require — reports are accepted pre-login; the sub is read
// from the context when the auth middleware resolved one.
func (h *Handler) Register(r chi.Router) {
	r.Post("/errors", h.report)
}

func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
	var body ErrReport
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid error report")
		return
	}
	msg := strings.TrimSpace(body.Message)
	if msg == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "message required")
		return
	}
	if len(msg) > maxMessageLen {
		msg = msg[:maxMessageLen]
	}
	stack := truncate(body.Stack)
	component := truncate(body.ComponentStack)
	if !allowedVariants[body.AppVariant] {
		body.AppVariant = ""
	}
	user := auth.UserID(r.Context())
	if user == "" {
		user = anonymous
	}

	// Structured log is the always-on capture path (OTEL_ENABLED request logger only logs request
	// metadata; this line carries the report itself).
	slog.Warn("error_event", "user", user, "app", body.AppVariant, "release", body.Release, "message", msg)

	if h.pool != nil {
		if _, err := h.pool.Exec(r.Context(),
			`insert into ops.error_events (user_id, app_variant, release, message, stack, component_stack)
			 values ($1, $2, $3, $4, $5, $6)`,
			user, body.AppVariant, body.Release, msg, stack, component); err != nil {
			slog.Warn("error_event_persist_failed", "err", err.Error())
		}
	}
	httpx.JSON(w, http.StatusAccepted, map[string]any{"ok": true})
}

func truncate(s string) string {
	if len(s) > maxStackLen {
		return s[:maxStackLen]
	}
	return s
}