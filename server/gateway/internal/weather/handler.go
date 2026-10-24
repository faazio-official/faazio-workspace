package weather

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the super-admin weather budget + manual rain override endpoints.
type Handler struct {
	checker *Checker
	audit   contracts.AuditWriter
}

// NewHandler builds the weather admin handler.
func NewHandler(checker *Checker, audit contracts.AuditWriter) *Handler {
	return &Handler{checker: checker, audit: audit}
}

// Register mounts the SUPER_ADMIN weather control plane.
func (h *Handler) Register(r chi.Router) {
	r.With(auth.RequireRole(auth.RoleSuperAdmin)).Get("/admin/weather/usage", h.usage)
	r.With(auth.RequireRole(auth.RoleSuperAdmin)).Put("/admin/weather/override", h.override)
}

func (h *Handler) usage(w http.ResponseWriter, r *http.Request) {
	u, err := h.checker.Usage(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "weather_usage_unavailable", "weather usage unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (h *Handler) override(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CellID  string `json:"cellId"`
		Raining bool   `json:"raining"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	cellID := strings.TrimSpace(req.CellID)
	if cellID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "cellId is required")
		return
	}
	h.checker.SetOverride(r.Context(), cellID, req.Raining)
	if h.audit != nil {
		after, _ := json.Marshal(map[string]any{"cellId": cellID, "raining": req.Raining})
		_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
			ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
			Action: "WEATHER_OVERRIDE", Entity: "weather.zone", EntityID: cellID, After: after,
		})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"cellId": cellID, "raining": req.Raining})
}
