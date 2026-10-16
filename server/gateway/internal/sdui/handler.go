package sdui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the compiled Home feed plus the super-admin Home-layout editor.
type Handler struct {
	service *Service
	audit   contracts.AuditWriter
}

// NewHandler builds the sdui handler.
func NewHandler(service *Service, audit contracts.AuditWriter) *Handler {
	return &Handler{service: service, audit: audit}
}

// Register mounts the public Home feed and the super-admin layout editor onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Get("/sdui/home", h.home)
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/sdui/home", h.adminGetHome)
		g.Put("/admin/sdui/home", h.adminPutHome)
	})
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

// layoutResponse is the admin editor projection: the raw ID-only sections plus the layout version.
type layoutResponse struct {
	LayoutID string                  `json:"layoutId"`
	Locale   string                  `json:"locale"`
	Version  int64                   `json:"version"`
	Sections []contracts.SduiSection `json:"sections"`
}

// adminGetHome returns the raw (uncompiled) Home layout so the portal editor reads exactly what the
// gateway will compile — never the product/store joined feed.
func (h *Handler) adminGetHome(w http.ResponseWriter, r *http.Request) {
	locale := strings.TrimSpace(r.URL.Query().Get("locale"))
	if locale == "" {
		locale = "en"
	}
	sections, version, err := h.service.Layout(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "home layout unavailable")
		return
	}
	if sections == nil {
		sections = []contracts.SduiSection{}
	}
	httpx.JSON(w, http.StatusOK, layoutResponse{LayoutID: "home", Locale: locale, Version: version, Sections: sections})
}

type saveRequest struct {
	Locale   string                  `json:"locale"`
	Sections []contracts.SduiSection `json:"sections"`
}

// adminPutHome replaces the Home layout and bumps its version. The app recompiles on the next poll
// with no release: the ETag changes and the cached compiled feed is purged.
func (h *Handler) adminPutHome(w http.ResponseWriter, r *http.Request) {
	var req saveRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if !validSections(req.Sections) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid layout sections")
		return
	}
	locale := strings.TrimSpace(req.Locale)
	if locale == "" {
		locale = "en"
	}
	version, err := h.service.SaveHome(r.Context(), req.Sections)
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sdui_unavailable", "could not publish home layout")
		return
	}
	h.log(r, version)
	httpx.JSON(w, http.StatusOK, layoutResponse{LayoutID: "home", Locale: locale, Version: version, Sections: req.Sections})
}

// Bounds mirror the ID-only Mongo contract (db-schema §8): every leaf is a bounded id reference, so
// a published layout can never grow the document or the compile pass unbounded.
const (
	maxSections     = 40
	maxSectionIDLen = 32
	maxTitleLen     = 120
	maxSubtitleLen  = 200
	maxAccentLen    = 16
	maxRefs         = 100
	maxRefLen       = 64
	maxChips        = 20
)

func validSections(sections []contracts.SduiSection) bool {
	if len(sections) == 0 || len(sections) > maxSections {
		return false
	}
	for _, s := range sections {
		if s.ID == "" || len(s.ID) > maxSectionIDLen || len(s.Title) > maxTitleLen ||
			len(s.Subtitle) > maxSubtitleLen || len(s.Accent) > maxAccentLen {
			return false
		}
		if !validRefs(s.ProductIDs) || !validRefs(s.StoreIDs) {
			return false
		}
		if len(s.Chips) > maxChips {
			return false
		}
		for _, c := range s.Chips {
			if c.ID == "" || len(c.ID) > maxSectionIDLen || len(c.Label) > maxTitleLen || len(c.Accent) > maxAccentLen {
				return false
			}
			if !validRefs(c.ProductIDs) {
				return false
			}
		}
	}
	return true
}

func validRefs(ids []string) bool {
	if len(ids) > maxRefs {
		return false
	}
	for _, id := range ids {
		if id == "" || len(id) > maxRefLen {
			return false
		}
	}
	return true
}

func (h *Handler) log(r *http.Request, version int64) {
	if h.audit == nil {
		return
	}
	actorID := auth.UserID(r.Context())
	if actorID == "" {
		actorID = "anonymous"
	}
	raw, _ := json.Marshal(map[string]int64{"version": version})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: auth.Role(r.Context()),
		Action: "SDUI_PUBLISH", Entity: "sdui_layouts", EntityID: "home", After: raw,
	})
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
