package pharma

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

const (
	maxPages      = 10
	maxNoteLen    = 2000
	maxImagePaths = 10
	maxObjectLen  = 256
)

// Handler serves the auth-scoped prescription endpoints.
type Handler struct {
	repo    *Repo
	storage *Storage
	cache   *cache.Cache
	audit   contracts.AuditWriter
}

// NewHandler builds the pharma handler. storage may be nil (signed URLs disabled).
func NewHandler(repo *Repo, storage *Storage, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, storage: storage, cache: c, audit: audit}
}

// Register mounts prescription endpoints (all auth-scoped).
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/prescriptions", h.list)
		g.Post("/prescriptions", h.create)
		g.Post("/prescriptions/upload-url", h.uploadURL)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/prescriptions", h.vendorList)
		g.Put("/prescriptions/{id}/status", h.setStatus)
	})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached struct {
		Items []Prescription `json:"items"`
	}
	if h.cache.GetJSON(r.Context(), cache.Prescriptions(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	items, err := h.repo.ByUser(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "prescriptions_unavailable", "prescriptions unavailable")
		return
	}
	if items == nil {
		items = []Prescription{}
	}
	payload := struct {
		Items []Prescription `json:"items"`
	}{Items: items}
	h.cache.SetJSON(r.Context(), cache.Prescriptions(userID), payload, cache.TTLPrescriptions)
	httpx.JSON(w, http.StatusOK, payload)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		VendorID    string   `json:"vendorId"`
		Fulfillment string   `json:"fulfillment"`
		Pages       int64    `json:"pages"`
		Note        string   `json:"note"`
		ImagePaths  []string `json:"imagePaths"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.Pages < 1 || body.Pages > maxPages {
		body.Pages = 1
	}
	if len(body.Note) > maxNoteLen {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "note too long")
		return
	}
	if len(body.ImagePaths) > maxImagePaths {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "too many images")
		return
	}
	for _, p := range body.ImagePaths {
		if p == "" || len(p) > maxObjectLen || strings.Contains(p, "..") {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid image path")
			return
		}
	}
	userID := auth.UserID(r.Context())
	p, err := h.repo.Create(r.Context(), Prescription{
		UserID:      userID,
		VendorID:    body.VendorID,
		Fulfillment: body.Fulfillment,
		Pages:       body.Pages,
		Note:        body.Note,
		ImagePaths:  body.ImagePaths,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "prescription_failed", "could not save prescription")
		return
	}
	h.cache.Del(r.Context(), cache.Prescriptions(userID))
	httpx.JSON(w, http.StatusCreated, p)
}

func (h *Handler) uploadURL(w http.ResponseWriter, r *http.Request) {
	if h.storage == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "storage_unavailable", "prescription storage not configured")
		return
	}
	userID := auth.UserID(r.Context())
	objectPath := userID + "/" + randomObjectName()
	url, err := h.storage.SignUpload(r.Context(), objectPath)
	if err != nil {
		httpx.Fail(w, http.StatusBadGateway, "storage_unavailable", "could not sign upload url")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{
		"objectPath": objectPath,
		"uploadUrl":  url,
	})
}

func randomObjectName() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "rx-" + hex.EncodeToString(b)
}

func (h *Handler) vendorList(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	items, err := h.repo.VendorPrescriptions(r.Context(), sellerID, status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "prescriptions_unavailable", "prescriptions unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// setStatus fulfils/cancels a prescription. Only the status is audited — never image paths or note
// (health PII; AGENTS.md security).
func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	status := strings.ToUpper(strings.TrimSpace(body.Status))
	if !allowedRxStatus(status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid prescription status")
		return
	}
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	p, ok, err := h.repo.SetStatus(r.Context(), id, auth.SellerID(r.Context()), status, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "prescription_failed", "could not update prescription")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "prescription not found")
		return
	}
	h.cache.Del(r.Context(), cache.Prescriptions(p.UserID))
	h.log(r, "RX_"+status, id)
	httpx.JSON(w, http.StatusOK, p)
}

func allowedRxStatus(s string) bool {
	switch s {
	case "PROCESSING", "FULFILLED", "CANCELLED":
		return true
	default:
		return false
	}
}

func (h *Handler) log(r *http.Request, action, entityID string) {
	if h.audit == nil {
		return
	}
	actorID := auth.UserID(r.Context())
	if actorID == "" {
		actorID = auth.SellerID(r.Context())
	}
	if actorID == "" {
		actorID = "anonymous"
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleSeller
	}
	raw, _ := json.Marshal(map[string]string{"action": action})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: "pharma.prescriptions", EntityID: entityID, After: raw,
	})
}
