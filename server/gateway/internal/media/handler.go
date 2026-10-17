package media

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/r2"
	"github.com/go-chi/chi/v5"
)

const (
	maxMediaBytes = 8 << 20 // 8 MiB
	maxResolveIDs = 200
	maxOwnerID    = 128
	maxMimeLen    = 64
)

// allowedMimes is the upload allowlist (AGENTS.md security): only web-safe raster images.
var allowedMimes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
}

// allowedOwnerTypes mirrors the DB check constraint.
var allowedOwnerTypes = map[string]bool{
	"": true, "PRODUCT": true, "STORE": true, "MENU": true, "BRAND": true,
	"BANNER": true, "AVATAR": true, "PRESCRIPTION": true, "KYC": true,
}

// Handler serves the media registry endpoints. The gateway is the only minter/signer; clients never
// hold R2 credentials and never construct object keys.
type Handler struct {
	repo   *Repo
	signer *r2.Signer
	cache  *cache.Cache
	audit  contracts.AuditWriter
}

// NewHandler builds the media handler. signer may be nil (media disabled → 503 on writes).
func NewHandler(repo *Repo, signer *r2.Signer, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, signer: signer, cache: c, audit: audit}
}

// Register mounts the media routes. Resolve is public; upload/confirm/private need auth; moderation is admin.
func (h *Handler) Register(r chi.Router) {
	r.Get("/media/resolve", h.resolve)
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Post("/media/upload-url", h.uploadURL)
		g.Post("/media/confirm", h.confirm)
		g.Get("/media/private/{id}", h.privateURL)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Put("/media/{id}/status", h.setStatus)
		g.Delete("/media/{id}", h.remove)
	})
}

// uploadURL mints a DRAFT asset and returns a short-lived presigned PUT. The client uploads the bytes
// straight to R2, then calls confirm.
func (h *Handler) uploadURL(w http.ResponseWriter, r *http.Request) {
	if !h.signer.Enabled() {
		httpx.Fail(w, http.StatusServiceUnavailable, "media_unavailable", "media storage not configured")
		return
	}
	var body struct {
		Kind      string `json:"kind"`
		OwnerType string `json:"ownerType"`
		OwnerID   string `json:"ownerId"`
		Mime      string `json:"mime"`
		Bytes     int64  `json:"bytes"`
		Width     *int   `json:"width"`
		Height    *int   `json:"height"`
		Hash      string `json:"hash"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	kind := strings.ToUpper(strings.TrimSpace(body.Kind))
	if kind == "" {
		kind = "PUBLIC"
	}
	if kind != "PUBLIC" && kind != "PRIVATE" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid asset kind")
		return
	}
	ownerType := strings.ToUpper(strings.TrimSpace(body.OwnerType))
	if !allowedOwnerTypes[ownerType] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid owner type")
		return
	}
	ownerID := strings.TrimSpace(body.OwnerID)
	if len(ownerID) > maxOwnerID {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "owner id too long")
		return
	}
	mime := strings.ToLower(strings.TrimSpace(body.Mime))
	ext, ok := allowedMimes[mime]
	if !ok || len(mime) > maxMimeLen {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unsupported image type")
		return
	}
	if body.Bytes < 0 || body.Bytes > maxMediaBytes {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "image too large")
		return
	}
	hash := strings.ToLower(strings.TrimSpace(body.Hash))
	if hash != "" && !isSHA256Hex(hash) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid hash")
		return
	}

	id := mintID()
	key := mintKey(id, hash, ext)
	private := kind == "PRIVATE"
	asset, err := h.repo.Create(r.Context(), contracts.MediaAsset{
		ID: id, OwnerType: ownerType, OwnerID: ownerID, Kind: kind,
		Bucket: h.signer.BucketFor(private), Key: key, Mime: mime, Bytes: body.Bytes,
		Width: body.Width, Height: body.Height, Hash: hash, CreatedBy: actorID(r),
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "could not register upload")
		return
	}
	uploadURL, err := h.signer.PresignPut(r.Context(), asset.Bucket, asset.Key, 300*time.Second)
	if err != nil {
		httpx.Fail(w, http.StatusBadGateway, "media_unavailable", "could not sign upload url")
		return
	}
	resp := map[string]any{
		"assetId":   asset.ID,
		"key":       asset.Key,
		"bucket":    asset.Bucket,
		"uploadUrl": uploadURL,
		"expiresIn": 300,
	}
	if !private {
		resp["publicUrl"] = h.signer.PublicURL(asset.Key)
	}
	httpx.JSON(w, http.StatusOK, resp)
}

// confirm marks a DRAFT ACTIVE and links its owner, then purges the cached identity.
func (h *Handler) confirm(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AssetID   string `json:"assetId"`
		OwnerType string `json:"ownerType"`
		OwnerID   string `json:"ownerId"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	ownerType := strings.ToUpper(strings.TrimSpace(body.OwnerType))
	if !allowedOwnerTypes[ownerType] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid owner type")
		return
	}
	actor := actorID(r)
	asset, ok, err := h.repo.Confirm(r.Context(), strings.TrimSpace(body.AssetID), ownerType, strings.TrimSpace(body.OwnerID), actor, auth.IsAdmin(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "could not confirm upload")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "asset not found or not confirmable")
		return
	}
	h.cache.Del(r.Context(), cache.MediaAsset(asset.ID))
	h.log(r, "MEDIA_CONFIRM", asset)
	h.respondAsset(w, asset)
}

// resolve resolves a batch of public asset ids to their CDN URLs (anon-safe).
func (h *Handler) resolve(w http.ResponseWriter, r *http.Request) {
	ids := parseIDs(r.URL.Query().Get("ids"), maxResolveIDs)
	out := make([]contracts.MediaAsset, 0, len(ids))
	missing := make([]string, 0, len(ids))
	for _, id := range ids {
		var cached contracts.MediaAsset
		if h.cache.GetJSON(r.Context(), cache.MediaAsset(id), &cached) {
			if cached.Kind == "PUBLIC" && cached.Status == "ACTIVE" {
				h.decorate(&cached)
				out = append(out, cached)
			}
			continue
		}
		missing = append(missing, id)
	}
	if len(missing) > 0 {
		assets, err := h.repo.Resolve(r.Context(), missing)
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "media unavailable")
			return
		}
		for i := range assets {
			if assets[i].Kind != "PUBLIC" {
				continue // PRIVATE assets are never cached or resolved publicly
			}
			h.cache.SetJSON(r.Context(), cache.MediaAsset(assets[i].ID), assets[i], cache.TTLMediaAsset)
			h.decorate(&assets[i])
			out = append(out, assets[i])
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"assets": out})
}

// privateURL returns a short-lived presigned GET for a PRIVATE asset. Only the creator or an admin may
// fetch it; a private bucket is never made public.
func (h *Handler) privateURL(w http.ResponseWriter, r *http.Request) {
	if !h.signer.Enabled() {
		httpx.Fail(w, http.StatusServiceUnavailable, "media_unavailable", "media storage not configured")
		return
	}
	id := chi.URLParam(r, "id")
	asset, ok, err := h.repo.ByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "media unavailable")
		return
	}
	if !ok || asset.Kind != "PRIVATE" {
		httpx.Fail(w, http.StatusNotFound, "not_found", "asset not found")
		return
	}
	if !auth.IsAdmin(r.Context()) && asset.CreatedBy != actorID(r) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "asset not found")
		return
	}
	url, err := h.signer.PresignGet(r.Context(), asset.Bucket, asset.Key, 300*time.Second)
	if err != nil {
		httpx.Fail(w, http.StatusBadGateway, "media_unavailable", "could not sign url")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"url": url, "expiresIn": 300})
}

func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	status := strings.ToUpper(strings.TrimSpace(body.Status))
	if status != "ACTIVE" && status != "REJECTED" && status != "DRAFT" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid status")
		return
	}
	id := chi.URLParam(r, "id")
	asset, ok, err := h.repo.SetStatus(r.Context(), id, status, actorID(r), true)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "media unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "asset not found")
		return
	}
	h.cache.Del(r.Context(), cache.MediaAsset(asset.ID))
	h.log(r, "MEDIA_"+status, asset)
	h.respondAsset(w, asset)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id, actorID(r), true)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "media unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "asset not found")
		return
	}
	h.cache.Del(r.Context(), cache.MediaAsset(id))
	httpx.JSON(w, http.StatusOK, map[string]any{"deleted": true})
}

// respondAsset writes an asset, decorating PUBLIC assets with their CDN URL.
func (h *Handler) respondAsset(w http.ResponseWriter, asset contracts.MediaAsset) {
	h.decorate(&asset)
	httpx.JSON(w, http.StatusOK, asset)
}

func (h *Handler) decorate(asset *contracts.MediaAsset) {
	if asset.Kind == "PUBLIC" {
		asset.URL = h.signer.PublicURL(asset.Key)
	}
}

func (h *Handler) log(r *http.Request, action string, asset contracts.MediaAsset) {
	if h.audit == nil {
		return
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleSeller
	}
	raw, _ := json.Marshal(map[string]string{"status": asset.Status, "ownerType": asset.OwnerType, "ownerId": asset.OwnerID})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID(r), ActorRole: role, Action: action,
		Entity: "media.assets", EntityID: asset.ID, After: raw,
	})
}

// actorID resolves the acting subject (app user, then seller, then anonymous).
func actorID(r *http.Request) string {
	if id := auth.UserID(r.Context()); id != "" {
		return id
	}
	if id := auth.SellerID(r.Context()); id != "" {
		return id
	}
	return "anonymous"
}

// mintID returns a fresh 'img_<16 hex>' id.
func mintID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "img_" + hex.EncodeToString(b)
}

// mintKey builds the immutable object key. A content hash yields a content-addressed key (safe to cache
// forever and de-duplicated); without a hash the key is date-scoped + unique.
func mintKey(id, hash, ext string) string {
	if len(hash) >= 2 {
		return fmt.Sprintf("media/%s/%s.%s", hash[:2], hash, ext)
	}
	now := time.Now().UTC()
	return fmt.Sprintf("media/%d/%02d/%s.%s", now.Year(), int(now.Month()), id, ext)
}

func isSHA256Hex(s string) bool {
	if len(s) != 64 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}

func parseIDs(raw string, max int) []string {
	out := []string{}
	seen := map[string]struct{}{}
	for _, part := range strings.Split(raw, ",") {
		id := strings.TrimSpace(part)
		if id == "" {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
		if len(out) >= max {
			break
		}
	}
	return out
}
