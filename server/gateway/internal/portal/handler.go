package portal

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

const (
	maxBodyBytes      = 4 << 10 // 4 KiB: a login body is ~200 bytes
	maxEmailLen       = 254
	maxPasswordLen    = 128
	minNewPasswordLen = 12
	ipLoginLimit      = 10
	emailLoginLimit   = 5
)

// Handler serves the gateway-native SUPER_ADMIN portal auth endpoints.
type Handler struct {
	repo   *Repo
	cache  *cache.Cache
	audit  contracts.AuditWriter
	hasher *Hasher
	minter *Minter
}

// NewHandler builds the portal handler. An empty jwtSecret disables login (503) rather than
// silently falling back to the unsettled legacy path.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter, jwtSecret, pepper string) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit, hasher: NewHasher(pepper), minter: NewMinter(jwtSecret)}
}

// Register mounts /auth/portal/*. Login/refresh/logout are unauthenticated by design (they mint or
// consume a refresh token); me/password require a portal SUPER_ADMIN access token.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(httpx.MaxBytes(maxBodyBytes))
		g.Post("/auth/portal/login", h.login)
		g.Post("/auth/portal/refresh", h.refresh)
		g.Post("/auth/portal/logout", h.logout)
	})
	r.Group(func(g chi.Router) {
		g.Use(httpx.MaxBytes(maxBodyBytes))
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/auth/portal/me", h.me)
		g.Put("/auth/portal/password", h.changePassword)
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type logoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type userDTO struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	MustChange bool   `json:"mustChange"`
}

type tokenDTO struct {
	AccessToken  string  `json:"accessToken"`
	RefreshToken string  `json:"refreshToken"`
	TokenType    string  `json:"tokenType"`
	ExpiresIn    int64   `json:"expiresIn"`
	User         userDTO `json:"user"`
}

func toUserDTO(u PortalUser) userDTO {
	return userDTO{ID: u.UserID, Email: u.Email, Name: u.DisplayName, Role: u.Role, MustChange: u.MustChange}
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	if !h.minter.Enabled() {
		httpx.Fail(w, http.StatusServiceUnavailable, "portal_auth_unavailable", "portal auth is not configured")
		return
	}
	if !isJSON(r) {
		httpx.Fail(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return
	}
	var req loginRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if !validEmail(req.Email) || req.Password == "" || len(req.Password) > maxPasswordLen {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "email and password are required")
		return
	}

	ipHash := shortHash(clientIP(r))
	emailHash := shortHash(req.Email)
	if !h.allowLogin(r, ipHash, emailHash) {
		h.record(r, "PORTAL_LOGIN_LOCKED", "", ipHash, "rate_limited")
		httpx.Fail(w, http.StatusTooManyRequests, "rate_limited", "too many attempts, try again shortly")
		return
	}

	user, found, err := h.repo.ByEmailLower(r.Context(), req.Email)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "portal_unavailable", "sign-in unavailable")
		return
	}
	if !found {
		// Same Argon2id cost as a real verification: a missing email must not be distinguishable
		// from a wrong password by timing.
		h.hasher.VerifyDummy(req.Password)
		h.record(r, "PORTAL_LOGIN_FAIL", "", ipHash, "invalid_credentials")
		httpx.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if !user.Active {
		h.hasher.VerifyDummy(req.Password)
		h.record(r, "PORTAL_LOGIN_FAIL", user.UserID, ipHash, "inactive")
		httpx.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if user.LockedUntil != nil && user.LockedUntil.After(time.Now()) {
		// Same generic response as a wrong password: a 423 here would let an attacker confirm that
		// an email exists (enumeration) by locking it and observing the status change.
		h.hasher.VerifyDummy(req.Password)
		h.record(r, "PORTAL_LOGIN_LOCKED", user.UserID, ipHash, "account_locked")
		httpx.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if !h.hasher.Verify(req.Password, user.PasswordHash) {
		_, locked, ferr := h.repo.RecordLoginFailure(r.Context(), user.UserID)
		h.record(r, "PORTAL_LOGIN_FAIL", user.UserID, ipHash, "invalid_credentials")
		if ferr == nil && locked != nil && locked.After(time.Now()) {
			h.record(r, "PORTAL_LOGIN_LOCKED", user.UserID, ipHash, "account_locked")
		}
		httpx.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}

	if err := h.repo.RecordLoginSuccess(r.Context(), user.UserID); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "portal_unavailable", "sign-in unavailable")
		return
	}
	out, err := h.issue(r, user, sessionsNew)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "portal_unavailable", "sign-in unavailable")
		return
	}
	h.record(r, "PORTAL_LOGIN_SUCCESS", user.UserID, ipHash, "success")
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	if !h.minter.Enabled() {
		httpx.Fail(w, http.StatusServiceUnavailable, "portal_auth_unavailable", "portal auth is not configured")
		return
	}
	if !isJSON(r) {
		httpx.Fail(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return
	}
	var req refreshRequest
	if err := httpx.Decode(r, &req); err != nil || req.RefreshToken == "" || len(req.RefreshToken) > 512 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "refresh token is required")
		return
	}

	hash := HashRefresh(req.RefreshToken)
	session, found, err := h.repo.SessionByTokenHash(r.Context(), hash)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "portal_unavailable", "refresh unavailable")
		return
	}
	if !found || session.RevokedAt != nil {
		httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
		return
	}
	if session.UsedAt != nil {
		// A replayed refresh token is the canonical theft signal: kill the whole family.
		_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
		h.record(r, "PORTAL_REFRESH_REUSE", session.UserID, shortHash(clientIP(r)), "reuse_detected")
		httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
		return
	}
	if session.ExpiresAt.Before(time.Now()) {
		_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
		httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
		return
	}
	consumed, err := h.repo.MarkSessionUsed(r.Context(), hash)
	if err != nil || !consumed {
		_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
		httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
		return
	}

	user, found, err := h.repo.ByID(r.Context(), session.UserID)
	if err != nil || !found || !user.Active {
		_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
		httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
		return
	}
	out, err := h.issue(r, user, session.SessionID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "portal_unavailable", "refresh unavailable")
		return
	}
	h.record(r, "PORTAL_REFRESH", user.UserID, shortHash(clientIP(r)), "success")
	httpx.JSON(w, http.StatusOK, out)
}

// sessionsNew is the sentinel family id: issue() mints a fresh family on login.
const sessionsNew = ""

func (h *Handler) issue(r *http.Request, user PortalUser, familyID string) (tokenDTO, error) {
	access, _, _, err := h.minter.MintAccess(user.UserID, user.Role, user.MustChange)
	if err != nil {
		return tokenDTO{}, err
	}
	raw, hash, err := NewRefresh()
	if err != nil {
		return tokenDTO{}, err
	}
	if familyID == sessionsNew {
		if familyID, err = newSessionID(); err != nil {
			return tokenDTO{}, err
		}
	}
	expires := time.Now().Add(RefreshTTL)
	if err := h.repo.CreateSession(r.Context(), familyID, user.UserID, hash, expires, shortHash(clientIP(r))); err != nil {
		return tokenDTO{}, err
	}
	return tokenDTO{
		AccessToken:  access,
		RefreshToken: raw,
		TokenType:    "Bearer",
		ExpiresIn:    int64(AccessTTL.Seconds()),
		User:         toUserDTO(user),
	}, nil
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := httpx.Decode(r, &req); err != nil && !errors.Is(err, io.EOF) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
	}
	ipHash := shortHash(clientIP(r))
	actor := ""
	if req.RefreshToken != "" {
		if session, found, err := h.repo.SessionByTokenHash(r.Context(), HashRefresh(req.RefreshToken)); err == nil && found {
			_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
			actor = session.UserID
		}
	}
	// Denylist the presented access token for its remaining lifetime (best-effort without Valkey).
	if jti := auth.Jti(r.Context()); jti != "" {
		h.cache.Set(r.Context(), cache.PortalDeny(jti), "1", cache.TTLPortalDeny)
		if actor == "" {
			actor = auth.UserID(r.Context())
		}
	}
	h.record(r, "PORTAL_LOGOUT", actor, ipHash, "success")
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	if !auth.IsPortal(r.Context()) {
		httpx.Fail(w, http.StatusUnauthorized, "unauthorized", "portal session required")
		return
	}
	user, found, err := h.repo.ByID(r.Context(), auth.UserID(r.Context()))
	if err != nil || !found || !user.Active {
		httpx.Fail(w, http.StatusUnauthorized, "unauthorized", "portal session required")
		return
	}
	httpx.JSON(w, http.StatusOK, toUserDTO(user))
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	if !auth.IsPortal(r.Context()) {
		httpx.Fail(w, http.StatusUnauthorized, "unauthorized", "portal session required")
		return
	}
	if !isJSON(r) {
		httpx.Fail(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return
	}
	var req changePasswordRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if req.NewPassword == "" || len(req.NewPassword) > maxPasswordLen || len(req.NewPassword) < minNewPasswordLen {
		httpx.Fail(w, http.StatusBadRequest, "weak_password", "new password must be at least 12 characters")
		return
	}
	if req.NewPassword == req.CurrentPassword || weakPassword(req.NewPassword, req.CurrentPassword) {
		httpx.Fail(w, http.StatusBadRequest, "weak_password", "choose a stronger, different password")
		return
	}
	user, found, err := h.repo.ByID(r.Context(), auth.UserID(r.Context()))
	if err != nil || !found || !user.Active {
		httpx.Fail(w, http.StatusUnauthorized, "unauthorized", "portal session required")
		return
	}
	if !h.hasher.Verify(req.CurrentPassword, user.PasswordHash) {
		httpx.Fail(w, http.StatusUnauthorized, "invalid_current_password", "current password is incorrect")
		return
	}
	hash, err := h.hasher.Hash(req.NewPassword)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "password_change_failed", "could not change password")
		return
	}
	if err := h.repo.SetPasswordHash(r.Context(), user.UserID, hash); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "password_change_failed", "could not change password")
		return
	}
	// Every other session is invalidated; the current access token is denylisted as well.
	_ = h.repo.RevokeUserSessions(r.Context(), user.UserID)
	if jti := auth.Jti(r.Context()); jti != "" {
		h.cache.Set(r.Context(), cache.PortalDeny(jti), "1", cache.TTLPortalDeny)
	}
	h.record(r, "PORTAL_PASSWORD_CHANGE", user.UserID, shortHash(clientIP(r)), "success")
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// allowLogin applies the shared Valkey counters (per-IP + per-email) in front of the DB lockout.
func (h *Handler) allowLogin(r *http.Request, ipHash, emailHash string) bool {
	ip, err := h.cache.Incr(r.Context(), cache.PortalLoginIP(ipHash), cache.TTLPortalLoginWindow)
	if err == nil && ip > ipLoginLimit {
		return false
	}
	email, err := h.cache.Incr(r.Context(), cache.PortalLoginEmail(emailHash), cache.TTLPortalLoginWindow)
	if err == nil && email > emailLoginLimit {
		return false
	}
	return true
}

func (h *Handler) record(r *http.Request, action, actorID, ipHash, result string) {
	if h.audit == nil {
		return
	}
	after, _ := json.Marshal(map[string]string{"result": result, "ipHash": ipHash})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID:   actorID,
		ActorRole: auth.RoleSuperAdmin,
		Action:    action,
		Entity:    "admins.portal_users",
		EntityID:  actorID,
		After:     after,
	})
}

func isJSON(r *http.Request) bool {
	ct := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	return strings.HasPrefix(ct, "application/json")
}

// clientIP resolves the end-client address behind the Render/Cloudflare chain. The origin only
// accepts Cloudflare traffic (render.yaml hardening), so both headers are proxy-written; the raw
// RemoteAddr would otherwise be the proxy itself and collapse every user into one rate-limit bucket.
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
	host, _, err := net.SplitHostPort(value)
	if err == nil {
		value = host
	}
	if net.ParseIP(value) == nil {
		return ""
	}
	return value
}

func shortHash(v string) string {
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:8])
}

func validEmail(email string) bool {
	if len(email) < 3 || len(email) > maxEmailLen || strings.ContainsAny(email, " \t\r\n") {
		return false
	}
	at := strings.LastIndexByte(email, '@')
	if at <= 0 || at == len(email)-1 {
		return false
	}
	domain := email[at+1:]
	return strings.Contains(domain, ".") && !strings.HasPrefix(domain, ".") && !strings.HasSuffix(domain, ".")
}

var commonPasswords = map[string]struct{}{
	"password":      {},
	"password123":   {},
	"qwertyuiop":    {},
	"123456789012":  {},
	"administrator": {},
	"letmein12345":  {},
}

// weakPassword rejects the shared initial password and obvious dictionary values.
func weakPassword(newPassword, oldPassword string) bool {
	lower := strings.ToLower(newPassword)
	if _, bad := commonPasswords[lower]; bad {
		return true
	}
	if oldPassword != "" && lower == strings.ToLower(oldPassword) {
		return true
	}
	return false
}
