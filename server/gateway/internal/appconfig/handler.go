package appconfig

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the central remote config: a public read for the mobile apps (no auth — the app
// fetches it on cold boot, before login) and a SUPER_ADMIN control plane for the partner portal.
// Every write is audited (admins.audit_logs) with secret values kept out of the audit snapshot.
type Handler struct {
	repo  *Repo
	audit contracts.AuditWriter
}

// NewHandler builds the appconfig handler.
func NewHandler(repo *Repo, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, audit: audit}
}

// Register mounts the appconfig routes.
func (h *Handler) Register(r chi.Router) {
	r.Get("/app-config", h.publicList)
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/app-config", h.adminList)
		g.Put("/admin/app-config/{key}", h.upsert)
		g.Delete("/admin/app-config/{key}", h.delete)
	})
}

// publicList serves the public rows for one app variant (?variant=customer|delivery|seller). Only
// is_public rows are ever returned, so no secret can leak to the app. `no-store` (never edge/browser
// cached, per caching-cloudflare-valkey.md) so a superadmin edit lands on the next app boot instead
// of a stale Cloudflare/gateway-cached reply.
func (h *Handler) publicList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	items, err := h.repo.ListPublic(r.Context(), r.URL.Query().Get("variant"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "config_unavailable", "app config unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// adminList returns every row for the portal. Secret rows are masked: value is `null` (the portal
// preserves it on PUT) and valueSecret stays true so the UI can render the "secret" state.
func (h *Handler) adminList(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.List(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "config_unavailable", "app config unavailable")
		return
	}
	for i := range items {
		if items[i].ValueSecret {
			items[i].Value = json.RawMessage("null")
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

type upsertRequest struct {
	Category    string          `json:"category"`
	Value       json.RawMessage `json:"value"`
	IsPublic    *bool           `json:"isPublic"`
	AppVariant  *string         `json:"appVariant"`
	ValueSecret *bool           `json:"valueSecret"`
	Description string          `json:"description"`
}

// upsert creates or updates one config row (SUPER_ADMIN only).
func (h *Handler) upsert(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimSpace(chi.URLParam(r, "key"))
	if !validKey(key) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request",
			"config key must match ^[a-z0-9][a-z0-9._-]{0,63}$")
		return
	}
	var req upsertRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if !validCategory(req.Category) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown config category")
		return
	}
	appVariant := "all"
	if req.AppVariant != nil {
		appVariant = strings.TrimSpace(*req.AppVariant)
	}
	if !validVariant(appVariant) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown config app variant")
		return
	}
	isPublic := false
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	}
	valueSecret := false
	if req.ValueSecret != nil {
		valueSecret = *req.ValueSecret
	}
	if isPublic && valueSecret {
		httpx.Fail(w, http.StatusBadRequest, "bad_request",
			"a public config value cannot be marked secret")
		return
	}
	description := strings.TrimSpace(req.Description)
	if len(description) > MaxDescriptionLen {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "config description is too long")
		return
	}
	value := req.Value
	if len(value) == 0 {
		value = json.RawMessage("null")
	}
	if len(value) > MaxValueBytes {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "config value exceeds 4 KiB")
		return
	}

	existing, found, err := h.repo.Get(r.Context(), key)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "config_read_failed", "could not load config")
		return
	}
	// A masked null on a secret row means "keep the stored value" — the portal never receives the
	// secret, so it must be able to save other fields without clobbering it.
	if found && existing.ValueSecret && valueSecret && isJSONNull(value) {
		value = existing.Value
	}

	row, err := h.repo.Upsert(r.Context(), Row{
		Key:         key,
		Category:    req.Category,
		Value:       value,
		IsPublic:    isPublic,
		AppVariant:  appVariant,
		ValueSecret: valueSecret,
		Description: description,
	}, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "config_write_failed", "could not save config")
		return
	}
	h.auditEvent(r.Context(), "APP_CONFIG_UPSERT", key, snapshot(existing, found), snapshot(row, true))

	if row.ValueSecret {
		row.Value = json.RawMessage("null")
	}
	httpx.JSON(w, http.StatusOK, row)
}

// delete removes one config row (SUPER_ADMIN only).
func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimSpace(chi.URLParam(r, "key"))
	if !validKey(key) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request",
			"config key must match ^[a-z0-9][a-z0-9._-]{0,63}$")
		return
	}
	existing, found, err := h.repo.Get(r.Context(), key)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "config_read_failed", "could not load config")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "config key not found")
		return
	}
	ok, err := h.repo.Delete(r.Context(), key)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "config_write_failed", "could not delete config")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "config key not found")
		return
	}
	h.auditEvent(r.Context(), "APP_CONFIG_DELETE", key, snapshot(existing, true), json.RawMessage("null"))
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) auditEvent(ctx context.Context, action, key string, before, after json.RawMessage) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Audit(ctx, contracts.AuditEntry{
		ActorID:   auth.UserID(ctx),
		ActorRole: auth.Role(ctx),
		Action:    action,
		Entity:    "admins.app_config",
		EntityID:  key,
		Before:    before,
		After:     after,
	})
}

// auditView is the audit-safe projection of a row: the raw value is omitted whenever the row is
// secret, so a secret never lands in admins.audit_logs.
type auditView struct {
	Key         string          `json:"key"`
	Category    string          `json:"category"`
	Value       json.RawMessage `json:"value,omitempty"`
	IsPublic    bool            `json:"isPublic"`
	AppVariant  string          `json:"appVariant"`
	ValueSecret bool            `json:"valueSecret"`
	Description string          `json:"description"`
	UpdatedBy   string          `json:"updatedBy,omitempty"`
	UpdatedAt   string          `json:"updatedAt"`
}

// snapshot builds the before/after audit JSON. found=false → null (new row or deletion).
func snapshot(row Row, found bool) json.RawMessage {
	if !found {
		return json.RawMessage("null")
	}
	v := auditView{
		Key:         row.Key,
		Category:    row.Category,
		IsPublic:    row.IsPublic,
		AppVariant:  row.AppVariant,
		ValueSecret: row.ValueSecret,
		Description: row.Description,
		UpdatedBy:   row.UpdatedBy,
		UpdatedAt:   row.UpdatedAt,
	}
	if !row.ValueSecret {
		v.Value = row.Value
	}
	b, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage("null")
	}
	return b
}