package media

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/imgconv"
	"github.com/faazio/server/gateway/internal/platform/r2"
	"github.com/go-chi/chi/v5"
)

const (
	maxMediaBytes = 8 << 20 // 8 MiB
	maxResolveIDs = 200
	maxOwnerID    = 128
	maxMimeLen    = 64
	// maxAVIFInputBytes caps the source bytes POST /media/avif will decode. A phone camera JPEG is
	// typically 2–6 MiB; 12 MiB leaves headroom without letting one caller pin a core for minutes.
	maxAVIFInputBytes = 12 << 20
	// maxAVIFLongEdge bounds the stored image. 1280px still covers a full-width shop gallery on a
	// 3x phone, while cutting the WASM AVIF encode time by ~⅓ versus 1600px (a full-resolution phone
	// photo takes seconds on a shared CPU, not milliseconds).
	maxAVIFLongEdge = 1280
	// maxAVIFUploadsPerIPPerDay caps anonymous conversions (5 photos per enquiry, plus retries).
	maxAVIFUploadsPerIPPerDay = 30
	// avifProcessTimeout is the detached deadline for one conversion + registry write. The router's
	// global 10s timeout is too short for decoding a 12MP camera JPEG, area-downscaling it and
	// encoding AVIF on a shared instance; the request context was already cancelled by the time the
	// asset row was inserted, which surfaced as a 500 ("could not register image") for real phone
	// photos. The work is bounded by maxAVIFInputBytes + maxAVIFLongEdge, so a longer, detached
	// deadline is safe.
	avifProcessTimeout = 45 * time.Second
)

// allowedMimes is the upload allowlist (AGENTS.md security): only web-safe raster images.
var allowedMimes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
	"image/avif": "avif",
}

// allowedOwnerTypes mirrors the DB check constraint.
var allowedOwnerTypes = map[string]bool{
	"": true, "PRODUCT": true, "STORE": true, "MENU": true, "BRAND": true,
	"BANNER": true, "AVATAR": true, "PRESCRIPTION": true, "KYC": true, "QR": true,
	// SHOP is the public shop-front gallery claimed by seller onboarding / a web enquiry.
	"SHOP": true,
}

// Handler serves the media registry endpoints. The gateway is the only minter/signer; clients never
// hold R2 credentials and never construct object keys.
type Handler struct {
	repo    *Repo
	signer  *r2.Signer
	cache   *cache.Cache
	audit   contracts.AuditWriter
	sweeper contracts.Sweeper
}

// NewHandler builds the media handler. signer may be nil (media disabled → 503 on writes); sweeper may
// be nil (the admin GC trigger returns 503).
func NewHandler(repo *Repo, signer *r2.Signer, c *cache.Cache, audit contracts.AuditWriter, sweeper contracts.Sweeper) *Handler {
	return &Handler{repo: repo, signer: signer, cache: c, audit: audit, sweeper: sweeper}
}

// Register mounts the media routes. Resolve is public; upload/confirm/private need auth; moderation + GC are admin.
func (h *Handler) Register(r chi.Router) {
	r.Get("/media/resolve", h.resolve)
	// Server-side AVIF conversion. Public because the landing-page enquiry form is anonymous and
	// neither the browser nor React Native can encode AVIF; the result is an unclaimed DRAFT that is
	// unreachable until a create call claims it. Rate-limited per IP (see avifUpload).
	r.Post("/media/avif", h.avifUpload)
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
		// Manual GC trigger: reclaims one batch of orphaned DRAFT assets (503 when GC unconfigured).
		g.Post("/media/gc", h.gc)
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

// avifUpload accepts raw image bytes (JPEG/PNG), converts them to AVIF server-side and stores the
// result as an unclaimed PUBLIC DRAFT SHOP asset. It answers {assetId,key,url,width,height,bytes}.
//
// Why a byte-accepting endpoint exists at all (every other upload presigns and streams straight to
// R2): no client on this platform can produce AVIF — browsers do not encode it and React Native ships
// no encoder — so the conversion has to happen where a pure-Go encoder runs. Bytes are capped at
// maxAVIFInputBytes, only JPEG/PNG are decoded, and the encoded output is always re-encoded from
// pixels (so no EXIF/GPS survives).
func (h *Handler) avifUpload(w http.ResponseWriter, r *http.Request) {
	// Detach the conversion + registry write from the router's 10s request deadline. The AVIF encode
	// is CPU-bound and cannot observe cancellation, so a deadline that fires mid-encode used to leave
	// the subsequent context-bound DB insert cancelled → 500 "could not register image". The detached
	// 45s context still carries the request values (actor, logging) but not the short deadline.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), avifProcessTimeout)
	defer cancel()
	r = r.WithContext(ctx)

	if !h.signer.Enabled() {
		httpx.Fail(w, http.StatusServiceUnavailable, "media_unavailable", "media storage not configured")
		return
	}
	// Per-IP daily cap: this endpoint does real CPU work (AVIF encode), so an unbounded caller could
	// burn the box. Fail-open on a cache error, like the enquiry counter.
	ipHash := shortHash(clientIP(r))
	day := time.Now().UTC().Format("20060102")
	if n, err := h.cache.Incr(r.Context(), cache.AVIFUploadRate(ipHash, day), cache.TTLAVIFUploadRate); err == nil && n > maxAVIFUploadsPerIPPerDay {
		httpx.Fail(w, http.StatusTooManyRequests, "rate_limited", "too many image uploads from this connection today")
		return
	}
	// Read up to the shared request-body ceiling so the mismatch surfaces here, not as a truncated read.
	raw, err := io.ReadAll(io.LimitReader(r.Body, maxAVIFInputBytes+1))
	if err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "could not read image")
		return
	}
	if len(raw) == 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "an image is required")
		return
	}
	if len(raw) > maxAVIFInputBytes {
		httpx.Fail(w, http.StatusRequestEntityTooLarge, "too_large", "image is larger than 12 MiB")
		return
	}
	out, width, height, err := imgconv.Encode(raw, imgconv.Options{MaxLongEdge: maxAVIFLongEdge})
	if err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unsupported image — upload a JPEG or PNG")
		return
	}
	hash := sha256Hex(out)
	id := mintID()
	key := mintKey(id, hash, "avif")
	asset, err := h.repo.Create(r.Context(), contracts.MediaAsset{
		ID: id, OwnerType: "SHOP", Kind: "PUBLIC", Bucket: h.signer.BucketFor(false),
		Key: key, Mime: imgconv.MimeAVIF, Bytes: int64(len(out)), Width: &width, Height: &height,
		Hash: hash, CreatedBy: actorID(r),
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "could not register image")
		return
	}
	if err := h.signer.PutObject(r.Context(), asset.Bucket, asset.Key, imgconv.MimeAVIF, out); err != nil {
		_, _ = h.repo.Delete(r.Context(), asset.ID, actorID(r), true)
		httpx.Fail(w, http.StatusBadGateway, "media_unavailable", "could not store image")
		return
	}
	h.log(r, "MEDIA_AVIF_UPLOAD", asset)
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"assetId": asset.ID,
		"key":     asset.Key,
		"url":     h.signer.PublicURL(asset.Key),
		"width":   width,
		"height":  height,
		"bytes":   len(out),
	})
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

// gc runs one synchronous media GC pass (admin manual trigger). 503 when GC is not configured
// (no R2 credentials / no sweeper); otherwise reports how many orphaned DRAFT assets were reclaimed.
func (h *Handler) gc(w http.ResponseWriter, r *http.Request) {
	if h.sweeper == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "gc_unconfigured", "media gc not configured")
		return
	}
	n, err := h.sweeper.SweepOnce(r.Context())
	if err != nil {
		if errors.Is(err, ErrGCUnavailable) {
			httpx.Fail(w, http.StatusServiceUnavailable, "gc_unconfigured", "media gc not configured")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "gc_failed", "could not run media gc")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"deleted": n})
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

// shortHash returns a stable 64-bit hex prefix of a value (an IP address here) — never the plaintext.
func shortHash(v string) string {
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:8])
}

// sha256Hex is the content hash used for the content-addressed object key (safe to cache forever).
func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// clientIP is the caller's address, preferring Cloudflare's header over the socket.
func clientIP(r *http.Request) string {
	if ip := firstIP(r.Header.Get("CF-Connecting-IP")); ip != "" {
		return ip
	}
	if ip := firstIP(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); ip != "" {
		return ip
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

func firstIP(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if host, _, err := net.SplitHostPort(value); err == nil {
		value = host
	}
	if net.ParseIP(value) == nil {
		return ""
	}
	return value
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
