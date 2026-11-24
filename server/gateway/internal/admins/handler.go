package admins

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the audit trail and the district-admin directory. Both are role-gated; the caller's
// role comes from the JWT claims, never a request body.
type Handler struct {
	repo        *Repo
	provisioner *Provisioner
	// purger runs one retention pass on the SUPER_ADMIN manual trigger (nil disables POST
	// /audit-logs/purge; the nightly 00:00 IST pass is the gateway worker in main.go).
	purger contracts.AuditPurger
}

// NewHandler builds the admins handler. provisioner owns roster+login writes (unified creator).
// purger may be nil to disable the manual purge trigger.
func NewHandler(repo *Repo, provisioner *Provisioner, purger contracts.AuditPurger) *Handler {
	return &Handler{repo: repo, provisioner: provisioner, purger: purger}
}

// Register mounts the admins routes.
func (h *Handler) Register(r chi.Router) {
	// Audit trail: any admin role may read.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/audit-logs", h.listLogs)
		g.Get("/customers", h.listCustomers)
	})
	// Retention: SUPER_ADMIN-only manual purge (the nightly pass is the gateway worker, not this
	// route) — never a state-admin or seller surface.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Post("/audit-logs/purge", h.purgeAuditLogs)
	})
	// District-admin directory: super admin only. The legacy /state-admins paths stay mounted for
	// one release so an older portal build keeps working during the rename.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		for _, base := range []string{"/district-admins", "/state-admins"} {
			g.Get(base, h.listAdmins)
			g.Post(base, h.createAdmin)
			g.Put(base+"/{id}", h.setAdminActive)
			g.Delete(base+"/{id}", h.deleteAdmin)
		}
		g.Post("/district-admins/{id}/resend-invite", h.resendInvite)
	})
	// Invite acceptance is public (the invitee has no session yet): the one-time token in the body
	// is the capability, and the invitee sets their own password here. Rate-limiting sits at the
	// edge/Cloudflare like the other portal auth routes.
	r.Group(func(g chi.Router) {
		g.Use(httpx.MaxBytes(4 << 10))
		g.Post("/district-admins/accept-invite", h.acceptInvite)
	})
}

// purgeAuditLogs runs one retention pass on demand (SUPER_ADMIN manual trigger). 503 when a purger
// is not configured; the pass itself records a surviving AUDIT_PURGE row with the caller's
// identity, so the purge is never invisible.
func (h *Handler) purgeAuditLogs(w http.ResponseWriter, r *http.Request) {
	if h.purger == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "purge_unconfigured", "audit-log purge not configured")
		return
	}
	n, err := h.purger.PurgeOnce(r.Context(), auth.UserID(r.Context()), auth.Role(r.Context()))
	if err != nil {
		if errors.Is(err, ErrPurgeUnavailable) {
			httpx.Fail(w, http.StatusServiceUnavailable, "purge_unconfigured", "audit-log purge not configured")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "purge_failed", "could not purge audit log")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"deleted":   n,
		"retention": "7d",
	})
}

func (h *Handler) listLogs(w http.ResponseWriter, r *http.Request) {
	actorRole := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("actorRole")))
	entity := strings.TrimSpace(r.URL.Query().Get("entity"))
	logs, err := h.repo.ListLogs(r.Context(), actorRole, entity, httpx.LimitParam(r, 100, 200))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "audit_unavailable", "audit trail unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, logs)
}

func (h *Handler) listCustomers(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		stateCode = auth.StateCode(r.Context())
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	items, err := h.repo.Customers(r.Context(), stateCode, q, httpx.LimitParam(r, 200, 500))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "customers_unavailable", "customers unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) listAdmins(w http.ResponseWriter, r *http.Request) {
	districtCode := NormaliseDistrictCode(r.URL.Query().Get("district"))
	items, err := h.repo.ListDistrictAdmins(r.Context(), districtCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "district_admins_unavailable", "district admins unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type createAdminRequest struct {
	Name         string `json:"name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	DistrictCode string `json:"districtCode"`
	// StateCode is the legacy field accepted from an older portal for wire back-compat; it is IGNORED
	// as an authorization scope. The creator is district-mandatory and always derives state_code from
	// the district (state-only scope is retired).
	StateCode  string `json:"stateCode,omitempty"`
	IssueLogin *bool  `json:"issueLogin"`
	Password   string `json:"password,omitempty"`
	// ForceChange is accepted for forward-compat but ignored: a DISTRICT_ADMIN login is ALWAYS forced to
	// rotate its temporary password (must_change locked true) so the temp password is single-use.
	ForceChange *bool `json:"forceChange,omitempty"`
	// InviteMode mints the login in a pending-invite state (single-use link, no temporary password).
	InviteMode *bool `json:"inviteMode,omitempty"`
	// Per-vertical scope (0130). Nil means "grant every vertical" so older portal builds are unchanged.
	MartAccess   *bool `json:"martAccess,omitempty"`
	FoodAccess   *bool `json:"foodAccess,omitempty"`
	PharmaAccess *bool `json:"pharmaAccess,omitempty"`
}

func (h *Handler) createAdmin(w http.ResponseWriter, r *http.Request) {
	var req createAdminRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.DistrictCode = NormaliseDistrictCode(req.DistrictCode)
	if req.Name == "" || len(req.Name) < 3 || len(req.Name) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a name of at least 3 characters is required")
		return
	}
	if !validEmail(req.Email) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a valid email is required")
		return
	}
	phoneDigits, ok := NormalisePhone(req.Phone)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "invalid_phone", "phone must be a 10-digit Indian mobile number")
		return
	}
	if req.DistrictCode == "" {
		httpx.Fail(w, http.StatusBadRequest, "unknown_district", "a district is required (state-only scope is retired)")
		return
	}
	if !IsValidDistrict(req.DistrictCode) {
		httpx.Fail(w, http.StatusBadRequest, "unknown_district", "unknown district code")
		return
	}
	// Derived display scope only — never a fallback input.
	req.StateCode = StateForDistrict(req.DistrictCode)
	issueLogin := true
	if req.IssueLogin != nil {
		issueLogin = *req.IssueLogin
	}
	inviteMode := req.InviteMode != nil && *req.InviteMode
	if inviteMode {
		issueLogin = true
	}
	if issueLogin && !inviteMode {
		if len(req.Password) < minNewPasswordLen || len(req.Password) > maxPasswordLen || weakPassword(req.Password) {
			httpx.Fail(w, http.StatusBadRequest, "weak_password", "password must be at least 12 characters and not a common value")
			return
		}
	}
	martAccess := req.MartAccess == nil || *req.MartAccess
	foodAccess := req.FoodAccess == nil || *req.FoodAccess
	pharmaAccess := req.PharmaAccess == nil || *req.PharmaAccess

	res, err := h.provisioner.Create(r.Context(), CreateParams{
		Name: req.Name, Email: req.Email, PhoneDigits: phoneDigits,
		DistrictCode: req.DistrictCode, StateCode: req.StateCode,
		IssueLogin: issueLogin, Password: req.Password, InviteMode: inviteMode,
		MartAccess: martAccess, FoodAccess: foodAccess, PharmaAccess: pharmaAccess,
	})
	if err != nil {
		if conflict := AsConflict(err); conflict != nil {
			// Audit the block with a hashed identity, never the raw email/phone (AGENTS.md security).
			before, _ := json.Marshal(map[string]string{"emailHash": shortHash(req.Email), "reason": conflict.Code})
			_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
				ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
				Action: "DISTRICT_ADMIN_CREATE_BLOCKED", Entity: "admins.district_admins", EntityID: conflict.ConflictingID,
				Before: before,
			})
			httpx.FailConflict(w, conflict.Code, conflict.Message, conflict.ConflictingRole, conflict.ConflictingID)
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "district_admin_create_failed", "could not create district admin")
		return
	}

	h.auditCreate(r, res)
	out := map[string]any{"admin": res.Admin}
	if res.LoginIssued {
		out["credential"] = res.Credential
	}
	if res.InviteToken != "" {
		out["inviteToken"] = res.InviteToken
		out["inviteExpiresAt"] = res.InviteExpiresAt
	}
	if len(res.Warnings) > 0 {
		// Soft, non-blocking notices (shared phone across a seller/roster row) — creation succeeded.
		out["warnings"] = res.Warnings
	}
	httpx.JSON(w, http.StatusCreated, out)
}

// auditCreate records the roster row and, when a login was minted, the credential row.
func (h *Handler) auditCreate(r *http.Request, res CreateResult) {
	afterAdmin, _ := json.Marshal(res.Admin)
	if err := h.repo.Audit(r.Context(), contracts.AuditEntry{
		ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
		Action: "DISTRICT_ADMIN_CREATE", Entity: "admins.district_admins", EntityID: res.Admin.AdminID, After: afterAdmin,
	}); err != nil {
		return
	}
	if res.LoginIssued {
		afterUser, _ := json.Marshal(res.Credential)
		_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
			ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
			Action: "PORTAL_USER_CREATE", Entity: "admins.portal_users", EntityID: res.Credential.ID, After: afterUser,
		})
	}
}

// updateAdminRequest carries the optional fields PUT /district-admins/{id} may change. Pointers
// distinguish "not provided" from a zero value, so a body of just {"active":false} still works while
// {"name","email","phone"} edits the roster identity.
type updateAdminRequest struct {
	Active       *bool   `json:"active"`
	Name         *string `json:"name"`
	Email        *string `json:"email"`
	Phone        *string `json:"phone"`
	DistrictCode *string `json:"districtCode"`
	MartAccess   *bool   `json:"martAccess"`
	FoodAccess   *bool   `json:"foodAccess"`
	PharmaAccess *bool   `json:"pharmaAccess"`
}

func (h *Handler) setAdminActive(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req updateAdminRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	hasProfile := req.Name != nil || req.Email != nil || req.Phone != nil || req.DistrictCode != nil ||
		req.MartAccess != nil || req.FoodAccess != nil || req.PharmaAccess != nil
	if !hasProfile && req.Active == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "no changes provided")
		return
	}

	var admin DistrictAdmin
	var ok bool
	var err error
	if hasProfile {
		// Apply identity + active in one transaction; a body carrying both must not commit a
		// half-applied edit when the second write fails.
		admin, ok, err = h.provisioner.UpdateIdentity(r.Context(), id, UpdateIdentityParams{
			Name: req.Name, Email: req.Email, Phone: req.Phone, DistrictCode: req.DistrictCode,
			Active:     req.Active,
			MartAccess: req.MartAccess, FoodAccess: req.FoodAccess, PharmaAccess: req.PharmaAccess,
		})
		if err != nil {
			var ve *ValidationError
			if errors.As(err, &ve) {
				httpx.Fail(w, http.StatusBadRequest, ve.Code, ve.Message)
				return
			}
			if conflict := AsConflict(err); conflict != nil {
				httpx.FailConflict(w, conflict.Code, conflict.Message, conflict.ConflictingRole, conflict.ConflictingID)
				return
			}
			httpx.Fail(w, http.StatusInternalServerError, "district_admin_update_failed", "could not update district admin")
			return
		}
		if !ok {
			httpx.Fail(w, http.StatusNotFound, "not_found", "district admin not found")
			return
		}
	}
	if !hasProfile && req.Active != nil {
		admin, ok, err = h.provisioner.SetActive(r.Context(), id, *req.Active)
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "district_admin_update_failed", "could not update district admin")
			return
		}
		if !ok {
			httpx.Fail(w, http.StatusNotFound, "not_found", "district admin not found")
			return
		}
	}
	after, _ := json.Marshal(admin)
	_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
		ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
		Action: "DISTRICT_ADMIN_UPDATE", Entity: "admins.district_admins", EntityID: admin.AdminID, After: after,
	})
	httpx.JSON(w, http.StatusOK, admin)
}

// resendInvite rotates the one-time accept token for a pending district-admin invite and returns the
// new raw token (shown once). 409 when the login is not a live pending invite.
func (h *Handler) resendInvite(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	token, expiresAt, ok, err := h.provisioner.ResendInvite(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrInviteNotPending) {
			httpx.Fail(w, http.StatusConflict, "invite_not_pending", "this invite can no longer be resent")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "district_admin_invite_resend_failed", "could not resend the invite")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "district admin not found")
		return
	}
	_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
		ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
		Action: "DISTRICT_ADMIN_INVITE_RESEND", Entity: "admins.portal_users", EntityID: id,
	})
	httpx.JSON(w, http.StatusOK, map[string]any{"inviteToken": token, "inviteExpiresAt": expiresAt})
}

type acceptInviteRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// acceptInvite is public (no session): it consumes the one-time token, sets the invitee's password
// and activates their DISTRICT_ADMIN login. The invitee then signs in normally.
func (h *Handler) acceptInvite(w http.ResponseWriter, r *http.Request) {
	var req acceptInviteRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" || req.Password == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "token and password are required")
		return
	}
	if len(req.Password) < minNewPasswordLen || len(req.Password) > maxPasswordLen || weakPassword(req.Password) {
		httpx.Fail(w, http.StatusBadRequest, "weak_password", "password must be at least 12 characters and not a common value")
		return
	}
	email, err := h.provisioner.AcceptInvite(r.Context(), req.Token, req.Password)
	if err != nil {
		if errors.Is(err, ErrInviteInvalid) {
			httpx.Fail(w, http.StatusBadRequest, "invite_invalid", "this invite link is invalid or has expired")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "district_admin_invite_accept_failed", "could not accept the invite")
		return
	}
	// Audit with a hashed email only (never the raw PII).
	_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
		ActorRole: "DISTRICT_ADMIN", Action: "DISTRICT_ADMIN_INVITE_ACCEPT",
		Entity: "admins.portal_users", EntityID: shortHash(email),
	})
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) deleteAdmin(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.provisioner.Delete(r.Context(), id); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "district_admin_delete_failed", "could not delete district admin")
		return
	}
	_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
		ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
		Action: "DISTRICT_ADMIN_DELETE", Entity: "admins.district_admins", EntityID: id,
	})
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// shortHash returns a stable 64-bit hex prefix of an identity for audit logs (never raw PII).
func shortHash(v string) string {
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:8])
}
