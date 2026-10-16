package pharma

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
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
	maxQuoteLines = 50
	maxQuoteName  = 120
	maxRupees     = 10_000_000
)

// Handler serves the auth-scoped prescription endpoints.
type Handler struct {
	repo     *Repo
	storage  *Storage
	cache    *cache.Cache
	audit    contracts.AuditWriter
	notifier contracts.Notifier
}

// NewHandler builds the pharma handler. storage and notifier may be nil.
func NewHandler(repo *Repo, storage *Storage, c *cache.Cache, audit contracts.AuditWriter, notifier contracts.Notifier) *Handler {
	return &Handler{repo: repo, storage: storage, cache: c, audit: audit, notifier: notifier}
}

// Register mounts prescription endpoints (all auth-scoped).
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/prescriptions", h.list)
		g.Get("/prescriptions/{id}", h.get)
		g.Post("/prescriptions", h.create)
		g.Post("/prescriptions/upload-url", h.uploadURL)
		g.Get("/prescriptions/{id}/images", h.imageURLs)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/prescriptions", h.vendorList)
		g.Get("/seller/prescriptions/{id}", h.vendorGet)
		g.Post("/seller/prescriptions/{id}/quotes", h.upsertQuote)
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

// get returns one of the caller's own prescriptions (owner-scoped; 404 for another user's row).
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p, ok, err := h.repo.ByIDForUser(r.Context(), id, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "prescriptions_unavailable", "prescriptions unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "prescription not found")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		VendorID    string   `json:"vendorId"`
		Fulfillment string   `json:"fulfillment"`
		Pages       int64    `json:"pages"`
		Note        string   `json:"note"`
		ImagePaths  []string `json:"imagePaths"`
		AddressID   string   `json:"addressId"`
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
	if len(body.AddressID) > maxObjectLen {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid address")
		return
	}
	userID := auth.UserID(r.Context())
	p, err := h.repo.Create(r.Context(), Prescription{
		UserID:      userID,
		VendorID:    body.VendorID,
		Fulfillment: body.Fulfillment,
		Pages:       body.Pages,
		Note:        body.Note,
		ImagePaths:  body.ImagePaths,
		AddressID:   body.AddressID,
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

// imageURLs returns short-lived signed download URLs for the prescription's images. Only the owner,
// the assigned vendor or an admin may call it; the private bucket is never made public.
func (h *Handler) imageURLs(w http.ResponseWriter, r *http.Request) {
	if h.storage == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "storage_unavailable", "prescription storage not configured")
		return
	}
	id := chi.URLParam(r, "id")
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	paths, ok, err := h.repo.ImagePathsFor(r.Context(), id, auth.UserID(r.Context()), auth.SellerID(r.Context()), admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "prescriptions_unavailable", "prescriptions unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "prescription not found")
		return
	}
	images := make([]map[string]string, 0, len(paths))
	for _, p := range paths {
		url, err := h.storage.SignDownload(r.Context(), p, 300)
		if err != nil {
			continue
		}
		images = append(images, map[string]string{"objectPath": p, "url": url})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"images": images})
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

// vendorGet returns one prescription in the same PII-redacted seller projection as the list — the
// customer name only; phone/address stay blank until READY/FULFILLED. Scope is the caller's seller_id
// (admin sees all). Used by the portal deep-link view.
func (h *Handler) vendorGet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	p, ok, err := h.repo.VendorPrescriptionByID(r.Context(), id, auth.SellerID(r.Context()), admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "prescriptions_unavailable", "prescriptions unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "prescription not found")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

// upsertQuote saves the seller's priced lines and advances the Rx to QUOTED. Only the seller who
// owns the routed store (or an admin) may quote.
func (h *Handler) upsertQuote(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Items []struct {
			Name     string `json:"name"`
			Qty      int64  `json:"qty"`
			MRP      int64  `json:"mrp"`
			Price    int64  `json:"price"`
			Discount int64  `json:"discount"`
		} `json:"items"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if len(body.Items) == 0 || len(body.Items) > maxQuoteLines {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "quote must have 1-50 lines")
		return
	}
	items := make([]QuoteItem, 0, len(body.Items))
	for _, it := range body.Items {
		name := strings.TrimSpace(it.Name)
		if name == "" || len(name) > maxQuoteName {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid quote item name")
			return
		}
		if it.Qty < 1 || it.Qty > 99 || it.MRP < 0 || it.Price < 0 || it.Discount < 0 ||
			it.MRP > maxRupees || it.Price > maxRupees || it.Discount > it.Price ||
			(it.MRP > 0 && it.Price > it.MRP) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid quote item values")
			return
		}
		items = append(items, QuoteItem{Name: name, Qty: it.Qty, MRP: it.MRP, Price: it.Price, Discount: it.Discount})
	}
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	p, ok, err := h.repo.UpsertQuote(r.Context(), id, auth.SellerID(r.Context()), actorID(r), role, admin, items)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "quote_failed", "could not save quote")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "prescription not found")
		return
	}
	h.cache.Del(r.Context(), cache.Prescriptions(p.UserID))
	h.log(r, "RX_QUOTED", id)
	httpx.JSON(w, http.StatusOK, p)
}

// setStatus fulfils/cancels/marks-ready a prescription. Only the status is audited — never image
// paths or note (health PII; AGENTS.md security). READY requires a quote and triggers a customer
// notification.
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
	// Idempotency: a repeated READY (or a READY on an already-FULFILLED Rx) must not fire a second
	// customer notification. The repo no-ops the duplicate history row; we suppress the notify here.
	notify := status == "READY"
	if notify {
		if prev, ok, err := h.repo.ScopedStatus(r.Context(), id, auth.SellerID(r.Context()), admin); err == nil && ok && (prev == "READY" || prev == "FULFILLED") {
			notify = false
		}
	}
	p, ok, err := h.repo.SetStatus(r.Context(), id, auth.SellerID(r.Context()), status, actorID(r), role, admin)
	switch {
	case errors.Is(err, ErrEmptyQuote):
		httpx.Fail(w, http.StatusBadRequest, "empty_quote", "add at least one quoted item before marking ready")
		return
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "prescription_failed", "could not update prescription")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "prescription not found")
		return
	}
	h.cache.Del(r.Context(), cache.Prescriptions(p.UserID))
	h.log(r, "RX_"+status, id)
	if notify {
		h.notifyReady(r, p)
	}
	httpx.JSON(w, http.StatusOK, p)
}

// notifyReady enqueues the customer notification for a READY prescription. Best-effort: the reveal is
// already committed, so a delivery hiccup must not fail the seller's action.
func (h *Handler) notifyReady(r *http.Request, p Prescription) {
	if h.notifier == nil {
		return
	}
	_ = h.notifier.Enqueue(r.Context(), p.UserID, "RX_READY",
		"Your prescription is ready",
		"The pharmacy has quoted your prescription. Tap to review and order.",
		map[string]any{"prescriptionId": p.ID})
}

func allowedRxStatus(s string) bool {
	switch s {
	case "PROCESSING", "READY", "FULFILLED", "CANCELLED":
		return true
	default:
		return false
	}
}

// actorID resolves the acting subject for audit/history (user, then seller, then anonymous).
func actorID(r *http.Request) string {
	if id := auth.UserID(r.Context()); id != "" {
		return id
	}
	if id := auth.SellerID(r.Context()); id != "" {
		return id
	}
	return "anonymous"
}

func (h *Handler) log(r *http.Request, action, entityID string) {
	if h.audit == nil {
		return
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleSeller
	}
	raw, _ := json.Marshal(map[string]string{"action": action})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID(r), ActorRole: role, Action: action,
		Entity: "pharma.prescriptions", EntityID: entityID, After: raw,
	})
}
