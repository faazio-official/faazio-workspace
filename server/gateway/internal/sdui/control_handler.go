package sdui

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/r2"
	"github.com/go-chi/chi/v5"
)

// ControlStore is the persistence surface the control-plane handler needs (implemented by *Store;
// faked in tests).
type ControlStore interface {
	Resolve(ctx context.Context, vertical, screen, district string) (LiveLayout, error)
	Epoch(ctx context.Context, vertical, screen, district string) (int64, error)
	Pointers(ctx context.Context, vertical, screen string) ([]PointerRow, error)
	Versions(ctx context.Context, vertical, screen, district string, limit int) ([]VersionRow, error)
	Publish(ctx context.Context, in PublishInput) (VersionRow, error)
	Rollback(ctx context.Context, vertical, screen, district, versionID, actor string) (PointerRow, error)
	Districts(ctx context.Context) ([]District, error)
}

// ControlHandler is the SDUI layout control plane: a public compiled-layout read for the apps and a
// SUPER_ADMIN surface for publishing, rollback, history and R2 upload signing.
type ControlHandler struct {
	store  ControlStore
	cache  *cache.Cache
	signer *r2.Signer
	audit  contracts.AuditWriter
}

// NewControlHandler builds the control-plane handler. cache/signer/audit may be nil.
func NewControlHandler(store ControlStore, c *cache.Cache, signer *r2.Signer, audit contracts.AuditWriter) *ControlHandler {
	return &ControlHandler{store: store, cache: c, signer: signer, audit: audit}
}

// Register mounts the SDUI control-plane routes.
func (h *ControlHandler) Register(r chi.Router) {
	// Public: the apps fetch a compiled layout before/without login (same as app-config).
	r.Get("/sdui/layout", h.publicLayout)
	r.Get("/sdui/epoch", h.publicEpoch)
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/sdui/layouts", h.pointers)
		g.Get("/admin/sdui/versions", h.versions)
		g.Get("/admin/sdui/districts", h.districts)
		g.Post("/admin/sdui/layouts/publish", h.publish)
		g.Post("/admin/sdui/layouts/rollback", h.rollback)
		g.Post("/admin/sdui/media/upload-url", h.presign)
	})
}

// Compiled is the cacheable part of a layout: everything except the server clock/time envelope.
type Compiled struct {
	SchemaVersion string      `json:"schema_version"`
	HeaderTheme   HeaderTheme `json:"header_theme"`
	Widgets       []Widget    `json:"widgets"`
	VersionNum    int         `json:"version_num"`
	SduiEpoch     int64       `json:"sdui_version_epoch"`
	DistrictID    string      `json:"district_id"`
}

// LayoutResponse is the wire contract the React Native SDUI renderer consumes.
type LayoutResponse struct {
	Compiled
	ServerTimestampUTC string `json:"server_timestamp_utc"`
	TTLSeconds         int    `json:"ttl_seconds"`
}

func layoutCacheKey(vertical, screen, district string) string {
	if district == "" {
		district = "PAN_INDIA"
	}
	return fmt.Sprintf("sdui:screen:%s:%s:%s", vertical, screen, district)
}

func scopeParams(r *http.Request) (vertical, screen, district string, ok bool) {
	vertical = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("vertical")))
	screen = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("screen")))
	district = strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("district_id")))
	if screen == "" {
		screen = "home"
	}
	if !contains(Verticals, vertical) || !contains(Screens, screen) || !districtLookupOK(district) {
		return "", "", "", false
	}
	return vertical, screen, district, true
}

var districtRe = regexp.MustCompile(`^[A-Z]{2}[A-Z0-9]$`)

func districtLookupOK(d string) bool { return d == "" || districtRe.MatchString(d) }

// publicLayout serves the compiled layout for one screen + district, PAN_INDIA as fallback.
func (h *ControlHandler) publicLayout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=30")
	vertical, screen, district, ok := scopeParams(r)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vertical, screen or district_id is invalid")
		return
	}
	key := layoutCacheKey(vertical, screen, district)
	var compiled Compiled
	if h.cache == nil || !h.cache.GetJSON(r.Context(), key, &compiled) {
		live, err := h.store.Resolve(r.Context(), vertical, screen, district)
		if errors.Is(err, ErrVersionNotFound) {
			httpx.Fail(w, http.StatusNotFound, "sdui_layout_missing", "no layout is published for this screen")
			return
		}
		if err != nil {
			httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "layout unavailable")
			return
		}
		var payload Payload
		if err := json.Unmarshal(live.Payload, &payload); err != nil {
			httpx.Fail(w, http.StatusServiceUnavailable, "sdui_payload_invalid", "stored layout is not readable")
			return
		}
		compiled = Compiled{
			SchemaVersion: payload.SchemaVersion,
			HeaderTheme:   payload.HeaderTheme,
			Widgets:       payload.Widgets,
			VersionNum:    live.VersionNum,
			SduiEpoch:     live.Epoch,
			DistrictID:    live.DistrictID,
		}
		if h.cache != nil {
			h.cache.SetJSON(r.Context(), key, compiled, LayoutTTLSeconds*time.Second)
		}
	}
	httpx.JSON(w, http.StatusOK, LayoutResponse{
		Compiled:           compiled,
		ServerTimestampUTC: time.Now().UTC().Format(time.RFC3339),
		TTLSeconds:         LayoutTTLSeconds,
	})
}

// publicEpoch is the cheap kill-switch probe: clients compare it with the epoch they hold and
// refetch when it moves (mid-session flash drop / takedown).
func (h *ControlHandler) publicEpoch(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	vertical, screen, district, ok := scopeParams(r)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vertical, screen or district_id is invalid")
		return
	}
	epoch, err := h.store.Epoch(r.Context(), vertical, screen, district)
	if errors.Is(err, ErrVersionNotFound) {
		httpx.Fail(w, http.StatusNotFound, "sdui_layout_missing", "no layout is published for this screen")
		return
	}
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "layout unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"vertical":             vertical,
		"screen":               screen,
		"district_id":          district,
		"sdui_version_epoch":   epoch,
		"server_timestamp_utc": time.Now().UTC().Format(time.RFC3339),
	})
}

// adminScope is the query shape of the admin read endpoints.
func adminScope(r *http.Request) (vertical, screen, district string, ok bool) {
	vertical = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("vertical")))
	screen = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("screen")))
	district = strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("district_id")))
	if screen == "" {
		screen = "home"
	}
	if !contains(Verticals, vertical) || !contains(Screens, screen) || !districtLookupOK(district) {
		return "", "", "", false
	}
	return vertical, screen, district, true
}

func (h *ControlHandler) pointers(w http.ResponseWriter, r *http.Request) {
	vertical, screen, _, ok := adminScope(r)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vertical or screen is invalid")
		return
	}
	rows, err := h.store.Pointers(r.Context(), vertical, screen)
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "layout unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"pointers": rows})
}

func (h *ControlHandler) versions(w http.ResponseWriter, r *http.Request) {
	vertical, screen, district, ok := adminScope(r)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vertical, screen or district_id is invalid")
		return
	}
	rows, err := h.store.Versions(r.Context(), vertical, screen, district, 50)
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "layout history unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"vertical": vertical, "screen": screen, "district_id": district, "versions": rows,
	})
}

func (h *ControlHandler) districts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.store.Districts(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "districts unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"districts": rows})
}

type publishRequest struct {
	Vertical   string          `json:"vertical"`
	Screen     string          `json:"screen"`
	DistrictID string          `json:"district_id"`
	Payload    json.RawMessage `json:"payload"`
	Note       string          `json:"note"`
}

// publish validates then appends a version and moves the live pointer. Cache is flushed before the
// response so the very next app request sees the new layout (contract: < 50ms flush).
func (h *ControlHandler) publish(w http.ResponseWriter, r *http.Request) {
	var req publishRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	vertical := strings.ToLower(strings.TrimSpace(req.Vertical))
	screen := strings.ToLower(strings.TrimSpace(req.Screen))
	district := strings.ToUpper(strings.TrimSpace(req.DistrictID))
	if screen == "" {
		screen = "home"
	}
	if !contains(Verticals, vertical) || !contains(Screens, screen) || !districtLookupOK(district) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vertical, screen or district_id is invalid")
		return
	}
	payload, verr := DecodePayload(req.Payload)
	if verr != nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, map[string]any{
			"error":  "sdui_invalid_payload",
			"errors": verr.Errors,
		})
		return
	}
	note := strings.TrimSpace(req.Note)
	if len(note) > 240 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "note is too long")
		return
	}
	row, err := h.store.Publish(r.Context(), PublishInput{
		Vertical: vertical, Screen: screen, DistrictID: district,
		Payload: payload, Note: note, Actor: auth.UserID(r.Context()),
	})
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_publish_failed", "could not publish the layout")
		return
	}
	h.flush(r.Context(), vertical, screen)
	h.auditEvent(r.Context(), "SDUI_LAYOUT_PUBLISH", vertical+"/"+screen+"/"+scopeLabel(district),
		map[string]any{"versionNum": row.VersionNum, "schemaVersion": row.SchemaVersion})
	httpx.JSON(w, http.StatusCreated, row)
}

type rollbackRequest struct {
	Vertical   string `json:"vertical"`
	Screen     string `json:"screen"`
	DistrictID string `json:"district_id"`
	VersionID  string `json:"version_id"`
}

// rollback repoints the scope at an existing version (history is never rewritten).
func (h *ControlHandler) rollback(w http.ResponseWriter, r *http.Request) {
	var req rollbackRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	vertical := strings.ToLower(strings.TrimSpace(req.Vertical))
	screen := strings.ToLower(strings.TrimSpace(req.Screen))
	district := strings.ToUpper(strings.TrimSpace(req.DistrictID))
	versionID := strings.TrimSpace(req.VersionID)
	if screen == "" {
		screen = "home"
	}
	if !contains(Verticals, vertical) || !contains(Screens, screen) || !districtLookupOK(district) || versionID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vertical, screen, district_id or version_id is invalid")
		return
	}
	ptr, err := h.store.Rollback(r.Context(), vertical, screen, district, versionID, auth.UserID(r.Context()))
	if errors.Is(err, ErrVersionNotFound) {
		httpx.Fail(w, http.StatusNotFound, "sdui_version_not_found", "that version does not belong to this layout")
		return
	}
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_rollback_failed", "could not roll back the layout")
		return
	}
	h.flush(r.Context(), vertical, screen)
	h.auditEvent(r.Context(), "SDUI_LAYOUT_ROLLBACK", vertical+"/"+screen+"/"+scopeLabel(district),
		map[string]any{"versionId": versionID, "epoch": ptr.Epoch})
	httpx.JSON(w, http.StatusOK, ptr)
}

// flush deletes every compiled layout for the screen so the next request recompiles from Postgres.
func (h *ControlHandler) flush(ctx context.Context, vertical, screen string) {
	if h.cache == nil {
		return
	}
	h.cache.DelPrefix(ctx, fmt.Sprintf("sdui:screen:%s:%s:", vertical, screen))
}

type presignRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Kind        string `json:"kind"`
}

var (
	safeMediaName = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)
	allowedCT     = map[string]bool{
		"image/webp": true, "image/jpeg": true, "image/png": true,
		"application/json": true, // Lottie
		"video/mp4":        true,
	}
)

// presign issues a short-lived R2 PUT URL. The portal uploads straight to R2, then stores the
// immutable public URL in the widget — bytes never proxy through the gateway.
func (h *ControlHandler) presign(w http.ResponseWriter, r *http.Request) {
	if h.signer == nil || !h.signer.Enabled() {
		httpx.Fail(w, http.StatusServiceUnavailable, "media_disabled", "R2 media is not configured")
		return
	}
	var req presignRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	kind := strings.ToLower(strings.TrimSpace(req.Kind))
	ct := strings.ToLower(strings.TrimSpace(req.ContentType))
	name := strings.ToLower(strings.TrimSpace(req.Filename))
	if !mediaKinds[kind] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "kind must be image, lottie or video")
		return
	}
	if !allowedCT[ct] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unsupported content type")
		return
	}
	ext := path.Ext(safeMediaName.ReplaceAllString(name, "-"))
	if len(ext) > 8 {
		ext = ""
	}
	key := fmt.Sprintf("sdui/%s/%d-%s%s", kind, time.Now().UTC().UnixNano(), strings.TrimSuffix(path.Base(safeMediaName.ReplaceAllString(name, "-")), path.Ext(name)), ext)
	upload, err := h.signer.PresignPut(r.Context(), h.signer.PublicBucket(), key, 10*time.Minute)
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "media_disabled", "could not sign the upload")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"upload_url": upload,
		"public_url": h.signer.PublicURL(key),
		"key":        key,
		"expires_in": 600,
	})
}

func scopeLabel(district string) string {
	if district == "" {
		return "PAN_INDIA"
	}
	return district
}

func (h *ControlHandler) auditEvent(ctx context.Context, action, entityID string, after any) {
	if h.audit == nil {
		return
	}
	body, err := json.Marshal(after)
	if err != nil {
		return
	}
	_ = h.audit.Audit(ctx, contracts.AuditEntry{
		ActorID:   auth.UserID(ctx),
		ActorRole: auth.Role(ctx),
		Action:    action,
		Entity:    "admins.sdui_layout_versions",
		EntityID:  entityID,
		After:     body,
	})
}
