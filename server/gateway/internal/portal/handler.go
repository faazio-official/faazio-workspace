package portal

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	maxBodyBytes      = 4 << 10 // 4 KiB: a login body is ~200 bytes
	maxEmailLen       = 254
	maxPasswordLen    = 128
	minNewPasswordLen = 12
	ipLoginLimit      = 10
	emailLoginLimit   = 5
)

// Handler serves the gateway-native portal auth + credential endpoints.
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
// consume a refresh token); me/password accept any portal role, and credential management is
// SUPER_ADMIN-only.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(httpx.MaxBytes(maxBodyBytes))
		g.Post("/auth/portal/login", h.login)
		g.Post("/auth/portal/refresh", h.refresh)
		g.Post("/auth/portal/logout", h.logout)
	})
	r.Group(func(g chi.Router) {
		g.Use(httpx.MaxBytes(maxBodyBytes))
		g.Use(auth.Require)
		g.Get("/auth/portal/me", h.me)
		g.Put("/auth/portal/password", h.changePassword)
	})
	r.Group(func(g chi.Router) {
		g.Use(httpx.MaxBytes(maxBodyBytes))
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/portal-users", h.listCredentials)
		g.Post("/admin/portal-users", h.createCredential)
		g.Put("/admin/portal-users/{id}", h.setCredentialActive)
		g.Put("/admin/portal-users/{id}/password", h.resetCredentialPassword)
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
	ID          string `json:"id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	MustChange  bool   `json:"mustChange"`
	Active      bool   `json:"active"`
	SellerID    string `json:"sellerId,omitempty"`
	StateCode   string `json:"stateCode,omitempty"`
	LastLoginAt string `json:"lastLoginAt,omitempty"`
	CreatedAt   string `json:"createdAt,omitempty"`
}

type tokenDTO struct {
	AccessToken  string  `json:"accessToken"`
	RefreshToken string  `json:"refreshToken"`
	TokenType    string  `json:"tokenType"`
	ExpiresIn    int64   `json:"expiresIn"`
	User         userDTO `json:"user"`
}

func toUserDTO(u PortalUser) userDTO {
	lastLogin := ""
	if u.LastLoginAt != nil {
		lastLogin = u.LastLoginAt.UTC().Format(time.RFC3339)
	}
	created := ""
	if !u.CreatedAt.IsZero() {
		created = u.CreatedAt.UTC().Format(time.RFC3339)
	}
	return userDTO{
		ID: u.UserID, Email: u.Email, Name: u.DisplayName, Role: u.Role,
		MustChange: u.MustChange, Active: u.Active, SellerID: u.SellerID, StateCode: u.StateCode,
		LastLoginAt: lastLogin, CreatedAt: created,
	}
}

// failUnavailable returns the same generic 500 to the caller (no schema/enumeration leak) but logs
// the machine-readable cause for operators. Postgres errors are reduced to SQLSTATE + object names;
// the raw message/args are never logged, so values and connection details cannot reach Render logs.
func failUnavailable(w http.ResponseWriter, op, msg string, err error) {
	log.Printf("portal_error op=%s %s", op, safeErrorFields(err))
	httpx.Fail(w, http.StatusInternalServerError, "portal_unavailable", msg)
}

func safeErrorFields(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		fields := "sqlstate=" + pgErr.Code
		if pgErr.TableName != "" {
			fields += " table=" + pgErr.TableName
		}
		if pgErr.ColumnName != "" {
			fields += " column=" + pgErr.ColumnName
		}
		if pgErr.ConstraintName != "" {
			fields += " constraint=" + pgErr.ConstraintName
		}
		return fields
	}
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return "err=deadline_exceeded"
	case errors.Is(err, context.Canceled):
		return "err=canceled"
	default:
		return fmt.Sprintf("err_type=%T", err)
	}
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
		h.record(r, "PORTAL_LOGIN_LOCKED", "", "", ipHash, "rate_limited")
		httpx.Fail(w, http.StatusTooManyRequests, "rate_limited", "too many attempts, try again shortly")
		return
	}

	user, found, err := h.repo.ByEmailLower(r.Context(), req.Email)
	if err != nil {
		failUnavailable(w, "login_lookup", "sign-in unavailable", err)
		return
	}
	if !found {
		// Same Argon2id cost as a real verification: a missing email must not be distinguishable
		// from a wrong password by timing.
		h.hasher.VerifyDummy(req.Password)
		h.record(r, "PORTAL_LOGIN_FAIL", "", "", ipHash, "invalid_credentials")
		httpx.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if !user.Active {
		h.hasher.VerifyDummy(req.Password)
		h.record(r, "PORTAL_LOGIN_FAIL", user.UserID, user.Role, ipHash, "inactive")
		httpx.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if user.LockedUntil != nil && user.LockedUntil.After(time.Now()) {
		// Same generic response as a wrong password: a 423 here would let an attacker confirm that
		// an email exists (enumeration) by locking it and observing the status change.
		h.hasher.VerifyDummy(req.Password)
		h.record(r, "PORTAL_LOGIN_LOCKED", user.UserID, user.Role, ipHash, "account_locked")
		httpx.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if !h.hasher.Verify(req.Password, user.PasswordHash) {
		_, locked, ferr := h.repo.RecordLoginFailure(r.Context(), user.UserID)
		h.record(r, "PORTAL_LOGIN_FAIL", user.UserID, user.Role, ipHash, "invalid_credentials")
		if ferr == nil && locked != nil && locked.After(time.Now()) {
			h.record(r, "PORTAL_LOGIN_LOCKED", user.UserID, user.Role, ipHash, "account_locked")
		}
		httpx.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}

	if err := h.repo.RecordLoginSuccess(r.Context(), user.UserID); err != nil {
		failUnavailable(w, "login_record_success", "sign-in unavailable", err)
		return
	}
	raw, hash, err := NewRefresh()
	if err != nil {
		failUnavailable(w, "login_refresh_mint", "sign-in unavailable", err)
		return
	}
	now := time.Now()
	out, err := h.issue(r, user, sessionsNew, raw, hash, now.Add(RefreshIdleTTL), now.Add(RefreshAbsoluteTTL), shortHash(clientIP(r)), shortHash(r.UserAgent()))
	if err != nil {
		failUnavailable(w, "login_session_create", "sign-in unavailable", err)
		return
	}
	h.record(r, "PORTAL_LOGIN_SUCCESS", user.UserID, user.Role, ipHash, "success")
	httpx.JSON(w, http.StatusOK, out)
}

// refreshVerdict classifies a presented refresh row before the handler performs any mutation.
// Order matches the GCP model: a revoked row is just dead (no extra family nuke), a hard-cap expiry
// kills the family, a replayed token inside the reuse-grace window is an idempotent rotation, an
// idle expiry revokes only this device's row, and everything else rotates normally.
type refreshVerdict int

const (
	verdictOK       refreshVerdict = iota // rotate normally, slide the idle window
	verdictGrace                          // used, inside reuse-grace → idempotent sibling rotation
	verdictTheft                          // used outside grace → clear sign of replay → revoke family
	verdictAbsolute                       // hard 180-day cap reached → revoke family, force re-login
	verdictIdle                           // 30-day idle lapsed → revoke this device only
	verdictRevoked                        // already revoked → terminal, no side-effects
)

func refreshVerdictOf(s Session, now time.Time) refreshVerdict {
	if s.RevokedAt != nil {
		return verdictRevoked
	}
	if !s.AbsoluteExpiresAt.IsZero() && s.AbsoluteExpiresAt.Before(now) {
		return verdictAbsolute
	}
	if s.UsedAt != nil {
		if s.ReuseGraceUntil != nil && s.ReuseGraceUntil.After(now) && s.RotatedToHash != "" {
			return verdictGrace
		}
		return verdictTheft
	}
	if s.ExpiresAt.Before(now) {
		return verdictIdle
	}
	return verdictOK
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

	ipHash := shortHash(clientIP(r))
	uaHash := shortHash(r.UserAgent())
	hash := HashRefresh(req.RefreshToken)

	// The re-read loop absorbs a rotation race: the loser re-classifies the winner's write (now
	// used-but-within-grace) and gets an idempotent sibling rotation instead of a family nuke.
	for attempt := 0; attempt < 3; attempt++ {
		session, found, err := h.repo.SessionByTokenHash(r.Context(), hash)
		if err != nil {
			failUnavailable(w, "refresh_lookup", "refresh unavailable", err)
			return
		}
		if !found || session.RevokedAt != nil {
			httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
			return
		}
		switch refreshVerdictOf(session, time.Now()) {
		case verdictRevoked:
			httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
			return
		case verdictAbsolute:
			// Hard 180-day cap reached: the family dies here — even an active user must re-login.
			_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
			h.record(r, "PORTAL_REFRESH_EXPIRED", session.UserID, "", ipHash, "absolute_expired")
			httpx.Fail(w, http.StatusUnauthorized, "session_expired_absolute", "session has expired, sign in again")
			return
		case verdictIdle:
			// 30-day idle lapsed on THIS device only; the rest of the family stays signed in.
			h.record(r, "PORTAL_REFRESH_EXPIRED", session.UserID, "", ipHash, "idle_expired")
			_ = h.repo.RevokeSession(r.Context(), hash)
			httpx.Fail(w, http.StatusUnauthorized, "session_expired_idle", "session has expired, sign in again")
			return
		case verdictTheft:
			// A replayed token outside the grace window is the canonical theft signal: kill the family.
			_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
			h.record(r, "PORTAL_REFRESH_REUSE", session.UserID, "", ipHash, "reuse_detected")
			httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh_reuse", "refresh token is not valid")
			return
		}

		grace := session.UsedAt != nil
		raw, childHash, err := NewRefresh()
		if err != nil {
			failUnavailable(w, "refresh_mint", "refresh unavailable", err)
			return
		}
		if grace {
			repointed, err := h.repo.GracePoint(r.Context(), hash, childHash, ipHash, uaHash)
			if err != nil {
				failUnavailable(w, "refresh_grace_point", "refresh unavailable", err)
				return
			}
			if !repointed {
				// Grace lapsed between the read and the write — now it is a true replay.
				_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
				h.record(r, "PORTAL_REFRESH_REUSE", session.UserID, "", ipHash, "reuse_detected")
				httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh_reuse", "refresh token is not valid")
				return
			}
		} else if consumed, err := h.repo.ConsumeSession(r.Context(), hash, childHash, time.Now().Add(ReuseGrace), ipHash, uaHash); err != nil {
			failUnavailable(w, "refresh_consume", "refresh unavailable", err)
			return
		} else if !consumed {
			// Lost the rotation race to a concurrent request: re-read and re-classify.
			continue
		}

		user, found, err := h.repo.ByID(r.Context(), session.UserID)
		if err != nil {
			failUnavailable(w, "refresh_user", "refresh unavailable", err)
			return
		}
		if !found || !user.Active {
			_ = h.repo.RevokeFamily(r.Context(), session.SessionID)
			httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
			return
		}
		out, err := h.issue(r, user, session.SessionID, raw, childHash, time.Now().Add(RefreshIdleTTL), session.AbsoluteExpiresAt, ipHash, uaHash)
		if err != nil {
			failUnavailable(w, "refresh_session_create", "refresh unavailable", err)
			return
		}
		if grace {
			// The race loser gets its own sibling token — audited distinctly so reuse-grace traffic
			// is observable without waking an incident engine.
			h.record(r, "PORTAL_REFRESH_GRACE", user.UserID, user.Role, ipHash, "success")
			w.Header().Set("X-Refresh-Reused", "true")
		} else {
			h.record(r, "PORTAL_REFRESH", user.UserID, user.Role, ipHash, "success")
		}
		httpx.JSON(w, http.StatusOK, out)
		return
	}
	// The re-read loop should never exhaust; if it does, the row was flapping — treat as terminal.
	httpx.Fail(w, http.StatusUnauthorized, "invalid_refresh", "refresh token is not valid")
}

// sessionsNew is the sentinel family id: issue() mints a fresh family on login.
const sessionsNew = ""

// issue writes one rotation row and builds the token pair. refreshExpires slides the idle window;
// absoluteExpires is the family's hard cap — set to now+RefreshAbsoluteTTL on login and preserved
// on every rotation so the cap never grows. ipHash/uaHash are one-way fingerprints, never raw PII.
func (h *Handler) issue(r *http.Request, user PortalUser, familyID, refreshRaw, refreshHash string, refreshExpires, absoluteExpires time.Time, ipHash, uaHash string) (tokenDTO, error) {
	access, _, _, err := h.minter.MintAccess(user.UserID, user.Role, user.SellerID, user.StateCode, user.MustChange)
	if err != nil {
		return tokenDTO{}, err
	}
	if familyID == sessionsNew {
		if familyID, err = newSessionID(); err != nil {
			return tokenDTO{}, err
		}
	}
	if err := h.repo.CreateSession(r.Context(), familyID, user.UserID, refreshHash, refreshExpires, absoluteExpires, ipHash, uaHash); err != nil {
		return tokenDTO{}, err
	}
	return tokenDTO{
		AccessToken:  access,
		RefreshToken: refreshRaw,
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
	h.record(r, "PORTAL_LOGOUT", actor, auth.Role(r.Context()), ipHash, "success")
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) listCredentials(w http.ResponseWriter, r *http.Request) {
	if !auth.IsPortal(r.Context()) {
		httpx.Fail(w, http.StatusUnauthorized, "unauthorized", "portal session required")
		return
	}
	users, err := h.repo.List(r.Context())
	if err != nil {
		failUnavailable(w, "credentials_list", "credentials unavailable", err)
		return
	}
	out := make([]userDTO, 0, len(users))
	for _, u := range users {
		out = append(out, toUserDTO(u))
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"users": out})
}

type createCredentialRequest struct {
	Email       string `json:"email"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	SellerID    string `json:"sellerId"`
	StateCode   string `json:"stateCode"`
	Password    string `json:"password"`
	ForceChange *bool  `json:"forceChange"`
}

func (h *Handler) createCredential(w http.ResponseWriter, r *http.Request) {
	if !auth.IsPortal(r.Context()) {
		httpx.Fail(w, http.StatusUnauthorized, "unauthorized", "portal session required")
		return
	}
	if !isJSON(r) {
		httpx.Fail(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return
	}
	var req createCredentialRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if !validEmail(req.Email) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a valid email is required")
		return
	}
	if req.Name == "" || len(req.Name) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a name is required")
		return
	}
	role, sellerID, stateCode, err := normalizeScope(req.Role, req.SellerID, req.StateCode)
	if err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if len(req.Password) < minNewPasswordLen || len(req.Password) > maxPasswordLen || weakPassword(req.Password, "") {
		httpx.Fail(w, http.StatusBadRequest, "weak_password", "password must be at least 12 characters and not a common value")
		return
	}
	if sellerID != "" {
		ok, err := h.repo.SellerExists(r.Context(), sellerID)
		if err != nil {
			failUnavailable(w, "credentials_seller_lookup", "credentials unavailable", err)
			return
		}
		if !ok {
			httpx.Fail(w, http.StatusBadRequest, "unknown_seller", "seller does not exist")
			return
		}
	}
	hash, err := h.hasher.Hash(req.Password)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "password_hash_failed", "could not create credential")
		return
	}
	id, err := randomHex(12)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "password_hash_failed", "could not create credential")
		return
	}
	user, err := h.repo.CreateUser(r.Context(), PortalUser{
		UserID: "pu-" + id, Email: req.Email, DisplayName: req.Name, PasswordHash: hash,
		Role: role, Active: true, MustChange: defaultForceChange(role, req.ForceChange), SellerID: sellerID, StateCode: stateCode,
	})
	if err != nil {
		if errors.Is(err, ErrEmailTaken) {
			httpx.Fail(w, http.StatusConflict, "email_taken", "that email already has a login")
			return
		}
		failUnavailable(w, "credentials_create", "could not create credential", err)
		return
	}
	h.record(r, "PORTAL_USER_CREATE", auth.UserID(r.Context()), auth.Role(r.Context()), shortHash(clientIP(r)), "success")
	httpx.JSON(w, http.StatusCreated, toUserDTO(user))
}

type setCredentialActiveRequest struct {
	Active *bool `json:"active"`
}

func (h *Handler) setCredentialActive(w http.ResponseWriter, r *http.Request) {
	if !auth.IsPortal(r.Context()) {
		httpx.Fail(w, http.StatusUnauthorized, "unauthorized", "portal session required")
		return
	}
	if !isJSON(r) {
		httpx.Fail(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return
	}
	var req setCredentialActiveRequest
	if err := httpx.Decode(r, &req); err != nil || req.Active == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "active is required")
		return
	}
	user, found, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		failUnavailable(w, "credentials_update_lookup", "credentials unavailable", err)
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "credential not found")
		return
	}
	if user.Role == auth.RoleSuperAdmin && !*req.Active {
		// Never let the console disable the final active superadmin — that is a full lockout.
		count, err := h.repo.CountActiveSuperAdmins(r.Context())
		if err != nil {
			failUnavailable(w, "credentials_superadmin_count", "credentials unavailable", err)
			return
		}
		if count <= 1 {
			httpx.Fail(w, http.StatusBadRequest, "last_super_admin", "the last active superadmin cannot be deactivated")
			return
		}
	}
	ok, err := h.repo.SetUserActive(r.Context(), user.UserID, *req.Active)
	if err != nil {
		failUnavailable(w, "credentials_update", "could not update credential", err)
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "credential not found")
		return
	}
	if !*req.Active {
		_ = h.repo.RevokeUserSessions(r.Context(), user.UserID)
	}
	h.record(r, "PORTAL_USER_UPDATE", auth.UserID(r.Context()), auth.Role(r.Context()), shortHash(clientIP(r)), "success")
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type resetCredentialPasswordRequest struct {
	NewPassword string `json:"newPassword"`
	ForceChange *bool  `json:"forceChange"`
}

func (h *Handler) resetCredentialPassword(w http.ResponseWriter, r *http.Request) {
	if !auth.IsPortal(r.Context()) {
		httpx.Fail(w, http.StatusUnauthorized, "unauthorized", "portal session required")
		return
	}
	if !isJSON(r) {
		httpx.Fail(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return
	}
	var req resetCredentialPasswordRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if len(req.NewPassword) < minNewPasswordLen || len(req.NewPassword) > maxPasswordLen || weakPassword(req.NewPassword, "") {
		httpx.Fail(w, http.StatusBadRequest, "weak_password", "password must be at least 12 characters and not a common value")
		return
	}
	user, found, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		failUnavailable(w, "credentials_reset_lookup", "credentials unavailable", err)
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "credential not found")
		return
	}
	hash, err := h.hasher.Hash(req.NewPassword)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "password_hash_failed", "could not reset password")
		return
	}
	force := defaultForceChange(user.Role, req.ForceChange)
	if err := h.repo.ResetPassword(r.Context(), user.UserID, hash, force); err != nil {
		failUnavailable(w, "credentials_reset", "could not reset password", err)
		return
	}
	_ = h.repo.RevokeUserSessions(r.Context(), user.UserID)
	h.record(r, "PORTAL_USER_PASSWORD_RESET", auth.UserID(r.Context()), auth.Role(r.Context()), shortHash(clientIP(r)), "success")
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "mustChange": force})
}

// defaultForceChange reports whether a credential must rotate its password on next sign-in:
// SUPER_ADMIN is exempt, every other role defaults to forced rotation unless the caller opts out.
func defaultForceChange(role string, override *bool) bool {
	if override != nil {
		return *override
	}
	return role != auth.RoleSuperAdmin
}

// normalizeScope validates the role/scope pairing accepted by the credential-management surface.
// SUPER_ADMIN is intentionally absent: those rows are seeded by tools/hash-password + SQL.
func normalizeScope(role, sellerID, stateCode string) (string, string, string, error) {
	role = strings.ToUpper(strings.TrimSpace(role))
	sellerID = strings.TrimSpace(sellerID)
	stateCode = strings.ToUpper(strings.TrimSpace(stateCode))
	switch role {
	case auth.RoleSeller:
		if sellerID == "" || stateCode != "" || len(sellerID) > 80 {
			return "", "", "", errors.New("seller logins require sellerId and no stateCode")
		}
	case auth.RoleStateAdmin:
		if sellerID != "" || !validStateCode(stateCode) {
			return "", "", "", errors.New("state-admin logins require a 2-letter stateCode and no sellerId")
		}
	default:
		return "", "", "", errors.New("role must be SELLER or STATE_ADMIN")
	}
	return role, sellerID, stateCode, nil
}

func validStateCode(v string) bool {
	if len(v) != 2 {
		return false
	}
	for _, c := range v {
		if c < 'A' || c > 'Z' {
			return false
		}
	}
	return true
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
	h.record(r, "PORTAL_PASSWORD_CHANGE", user.UserID, user.Role, shortHash(clientIP(r)), "success")
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

func (h *Handler) record(r *http.Request, action, actorID, actorRole, ipHash, result string) {
	if h.audit == nil {
		return
	}
	if actorRole == "" {
		// Unknown-email attempts still belong to the portal surface, whose audit enum has no
		// "unknown" value. Known users always pass their real role.
		actorRole = auth.RoleSuperAdmin
	}
	after, _ := json.Marshal(map[string]string{"result": result, "ipHash": ipHash})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID:   actorID,
		ActorRole: actorRole,
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
