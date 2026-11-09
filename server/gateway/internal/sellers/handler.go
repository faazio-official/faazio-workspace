package sellers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the seller directory + onboarding. Reads and writes are role-gated; every mutation
// writes an admins.audit_logs row via contracts.AuditWriter. Seller records carry PII, so they are
// never cached (caching-cloudflare-valkey.md §8).
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
	// logins auto-provisions the seller's portal credential on approval; nil disables it.
	logins contracts.SellerLoginProvisioner
	// subUsers mints/deactivates a staff sub-user credential when an invite is accepted/revoked.
	// nil leaves invites roster-only (unit/test wiring) and refuses accept with 503.
	subUsers contracts.SubUserProvisioner
}

// NewHandler builds the sellers handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter, logins contracts.SellerLoginProvisioner) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit, logins: logins}
}

// WithSubUsers wires the portal sub-user credential provisioner (accept/revoke lifecycle).
func (h *Handler) WithSubUsers(p contracts.SubUserProvisioner) *Handler {
	h.subUsers = p
	return h
}

// Register mounts the sellers routes.
func (h *Handler) Register(r chi.Router) {
	// Onboarding: any authenticated applicant can create a PENDING_REVIEW seller.
	r.With(auth.Require).Post("/sellers", h.create)
	// The applicant's own status. auth.Require (not RequireRole) is intentional: a shopper is
	// authenticated via Firebase but has no SELLER role until an admin activates the account.
	r.With(auth.Require).Get("/sellers/me", h.me)

	// Seller-scoped reads/writes + admin moderation. Admin-only actions re-check the role and the
	// state scope inside the handler so a seller can never moderate their own application.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/sellers", h.list)
		g.Get("/sellers/{id}", h.get)
		g.Get("/sellers/{id}/detail", h.get)
		g.Get("/sellers/{id}/kyc", h.listKYC)
		g.Post("/sellers/{id}/kyc", h.addKYC)
		// Payout account + business profile are owner-only for a seller sub-user (admins unaffected).
		g.With(auth.RequireSellerOwner).Get("/sellers/{id}/bank-account", h.getBank)
		g.With(auth.RequireSellerOwner).Put("/sellers/{id}/bank-account", h.putBank)
		g.Patch("/sellers/{id}/status", h.setStatus)
		// Seller-initiated platform-fee change (the fee itself is immutable once set at registration).
		g.Post("/sellers/{id}/platform-fee-request", h.requestPlatformFeeChange)
		g.Get("/sellers/{id}/platform-fee-requests", h.listSellerFeeChangeRequests)
		// Admin review actions (DISTRICT_ADMIN in-district, SUPER_ADMIN anywhere; sellers are rejected).
		g.Patch("/sellers/{id}/platform-fee", h.updatePlatformFee)
		g.Post("/sellers/{id}/verify-kyc", h.verifyKYC)
		g.Post("/sellers/{id}/verify-doc/{docType}", h.verifyDoc)
		g.Post("/sellers/{id}/reject", h.reject)
		// Seller resubmission of a rejected application (history preserved until approval).
		g.Post("/sellers/{id}/edit", h.edit)
		// Seller self-service business-profile edit (KYC-bearing fields re-enter admin review).
		// This is the generic PATCH the portal has always called; POST /sellers/{id}/edit stays the
		// REJECTED-application resubmission path.
		g.With(auth.RequireSellerOwner).Patch("/sellers/{id}", h.editProfile)
	})

	// Seller self-service settings: alert preferences + staff sub-users. Scope comes from the JWT
	// seller_id, never a request body. These are owner-only: a sub-user (STAFF/VIEWER) may work the
	// console but cannot manage the roster, account preferences or the sign-in identity.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller))
		g.Use(auth.RequireSellerOwner)
		g.Get("/seller/notifications/preferences", h.getNotificationPreferences)
		g.Put("/seller/notifications/preferences", h.putNotificationPreferences)
		g.Get("/seller/sub-users", h.listSubUsers)
		g.Post("/seller/sub-users", h.inviteSubUser)
		g.Post("/seller/sub-users/{id}/resend", h.resendSubUserInvite)
		g.Delete("/seller/sub-users/{id}", h.revokeSubUser)
	})

	// Accept an invite: public (the invitee has no session yet). The one-time token in the body is
	// the capability; the invitee sets their password here and the credential is minted.
	r.Post("/seller/sub-users/accept", h.acceptSubUserInvite)

	// Platform-fee change review queue: district admin sees their district, super admin sees all.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleDistrictAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/fee-change-requests", h.listFeeChangeRequests)
		g.Patch("/seller/fee-change-requests/{id}/approve", h.approveFeeChangeRequest)
		g.Patch("/seller/fee-change-requests/{id}/reject", h.rejectFeeChangeRequest)
	})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		SellerID:     strings.TrimSpace(r.URL.Query().Get("sellerId")),
		StateCode:    strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state"))),
		DistrictCode: geo.Normalise(r.URL.Query().Get("district")),
		Status:       strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status"))),
	}
	// Role scoping: a seller sees only themself; a district admin only their district (falling back
	// to the parent state for legacy admins without a district claim).
	switch auth.Role(r.Context()) {
	case auth.RoleSeller:
		f.SellerID = auth.SellerID(r.Context())
		if f.SellerID == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
			return
		}
		f.StateCode = ""
		f.DistrictCode = ""
	case auth.RoleDistrictAdmin:
		if d := auth.DistrictCode(r.Context()); d != "" {
			f.DistrictCode = d
			f.StateCode = ""
		} else {
			f.StateCode = auth.StateCode(r.Context())
		}
	}
	items, err := h.repo.List(r.Context(), f)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	d, ok, err := h.repo.DetailByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), d.SellerID, d.DistrictCode, d.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

// me returns the authenticated shopper's latest seller application, or 404 when none exists.
func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	s, ok, err := h.repo.GetByUserID(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "no seller application")
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}

// vendorApplication is one VENDOR (shop) created with the account. The account itself is
// brand-agnostic (0068); app brand, platform fee, taxonomy category and FSSAI live here.
type vendorApplication struct {
	Name           string `json:"name"`
	App            string `json:"app"`
	CategoryID     string `json:"categoryId"`
	PlatformFeePct int    `json:"platformFeePct"`
	FSSAINumber    string `json:"fssaiNumber"`
	FSSAIFileKey   string `json:"fssaiFileKey"`
	FSSAIAssetID   string `json:"fssaiAssetId"`
	// PHARMA shops carry a drug-selling licence (number + certificate), optional like FSSAI.
	DrugLicenseNumber  string `json:"drugLicenseNumber"`
	DrugLicenseFileKey string `json:"drugLicenseFileKey"`
	DrugLicenseAssetID string `json:"drugLicenseAssetId"`
	// Per-shop payout override; falls back to the account bank when omitted. The full account number
	// is accepted transiently and masked before it is stored.
	BankName          string   `json:"bankName"`
	BankAccountNumber string   `json:"bankAccountNumber"`
	BankIFSC          string   `json:"bankIfsc"`
	BankBeneficiary   string   `json:"bankBeneficiary"`
	Address           string   `json:"address"`
	Phone             string   `json:"phone"`
	Hours             string   `json:"hours"`
	Latitude          *float64 `json:"latitude"`
	Longitude         *float64 `json:"longitude"`
}

type createSellerRequest struct {
	BusinessName    string              `json:"businessName"`
	OwnerName       string              `json:"ownerName"`
	GSTIN           string              `json:"gstin"`
	PAN             string              `json:"pan"`
	BusinessAddress string              `json:"businessAddress"`
	ContactPhone    string              `json:"contactPhone"`
	ContactEmail    string              `json:"contactEmail"`
	StateCode       string              `json:"stateCode"`
	DistrictCode    string              `json:"districtCode"`
	Latitude        *float64            `json:"latitude"`
	Longitude       *float64            `json:"longitude"`
	Vendors         []vendorApplication `json:"vendors"`
	// Bank details. The full account number is accepted transiently for Razorpay Route and is
	// masked before it ever reaches Postgres.
	BankName          string `json:"bankName"`
	BankAccountNumber string `json:"bankAccountNumber"`
	BankIFSC          string `json:"bankIfsc"`
	BankBeneficiary   string `json:"bankBeneficiary"`
	// KYC uploads (private R2). Passbook is mandatory for the account.
	PassbookFileKey string `json:"passbookFileKey"`
	PassbookAssetID string `json:"passbookAssetId"`
	// OTPVerified is the digital-signature gate. The mobile client only sets it after a successful
	// Firebase OTP round-trip on the authenticated phone.
	OTPVerified bool `json:"otpVerified"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createSellerRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.DistrictCode = geo.Normalise(req.DistrictCode)
	req.GSTIN = strings.ToUpper(strings.TrimSpace(req.GSTIN))
	req.PAN = strings.ToUpper(strings.TrimSpace(req.PAN))
	req.ContactEmail = strings.TrimSpace(req.ContactEmail)

	if strings.TrimSpace(req.BusinessName) == "" || strings.TrimSpace(req.OwnerName) == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "business and owner name are required")
		return
	}
	if len(req.StateCode) != 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state is invalid")
		return
	}
	// The gateway is the write authority for sellers.sellers.state_code: reject a code that is not
	// an active ISO 3166-2:IN state/UT rather than persisting an out-of-master value (e.g. "ZZ").
	stateOK, serr := h.repo.ValidStateCode(r.Context(), req.StateCode)
	if serr != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !stateOK {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state is invalid")
		return
	}
	// An account is only useful with at least one vendor; the vendor carries the brand.
	if len(req.Vendors) == 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "at least one vendor is required")
		return
	}
	for i := range req.Vendors {
		v := &req.Vendors[i]
		v.App = strings.ToUpper(strings.TrimSpace(v.App))
		v.Name = strings.TrimSpace(v.Name)
		v.CategoryID = strings.TrimSpace(v.CategoryID)
		v.FSSAINumber = strings.TrimSpace(v.FSSAINumber)
		v.DrugLicenseNumber = strings.TrimSpace(v.DrugLicenseNumber)
		v.BankName = strings.TrimSpace(v.BankName)
		v.BankAccountNumber = strings.TrimSpace(v.BankAccountNumber)
		v.BankIFSC = strings.ToUpper(strings.TrimSpace(v.BankIFSC))
		v.BankBeneficiary = strings.TrimSpace(v.BankBeneficiary)
		if v.Name == "" || !validCategory(v.App) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "each vendor needs a name and a valid app")
			return
		}
		if v.PlatformFeePct == 0 {
			v.PlatformFeePct = 10
		}
		if !validPlatformFee(v.App, v.PlatformFeePct) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "platform fee is outside the allowed range for this app")
			return
		}
		if !validLatLng(v.Latitude, v.Longitude) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "vendor shop location is invalid")
			return
		}
		if v.CategoryID != "" {
			ok, err := h.repo.ValidCategoryID(r.Context(), v.App, v.CategoryID)
			if err != nil {
				httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
				return
			}
			if !ok {
				httpx.Fail(w, http.StatusBadRequest, "bad_request", "category is not an active category of this app")
				return
			}
		}
		// Licences are optional at submission: an admin verifies them during review, and a vendor may
		// attach them later. If one half is supplied, require the number + certificate together.
		if v.FSSAINumber != "" || v.FSSAIFileKey != "" || v.FSSAIAssetID != "" {
			if v.FSSAINumber == "" || !isStorageKey(v.FSSAIFileKey) {
				httpx.Fail(w, http.StatusBadRequest, "bad_request", "fssai number and certificate key are required together")
				return
			}
		}
		// PHARMA drug licence follows the same both-or-neither rule (accept for any app, but it is
		// semantically a pharmacy licence).
		if v.DrugLicenseNumber != "" || v.DrugLicenseFileKey != "" || v.DrugLicenseAssetID != "" {
			if v.DrugLicenseNumber == "" || !isStorageKey(v.DrugLicenseFileKey) {
				httpx.Fail(w, http.StatusBadRequest, "bad_request", "drug licence number and certificate key are required together")
				return
			}
		}
		// A per-shop payout override must be complete when any field is supplied; mask the account
		// number so only the tail reaches Postgres.
		if v.BankName != "" || v.BankAccountNumber != "" || v.BankIFSC != "" || v.BankBeneficiary != "" {
			masked, ok := maskAccount(v.BankAccountNumber)
			if !ok || v.BankName == "" || len(v.BankIFSC) != 11 || v.BankBeneficiary == "" {
				httpx.Fail(w, http.StatusBadRequest, "bad_request", "shop bank name, account number, ifsc and beneficiary are required together")
				return
			}
			v.BankAccountNumber = masked
		}
	}
	// New onboarding requires a district (migration 0047): district-scoped admin queues
	// (auth.CanActForSellerDistrict) fall back to state scope for a NULL-district row, so a
	// district-less seller would break district routing. The district must be in the active master
	// (admins.district_master → geo) and belong to the selected state. Legacy sellers created before
	// the rollout keep a NULL district and can still be edited (see edit).
	if req.DistrictCode == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "district is required")
		return
	}
	if !geo.IsValid(req.DistrictCode) {
		httpx.Fail(w, http.StatusBadRequest, "unknown_district", "unknown district code")
		return
	}
	if geo.StateForDistrict(req.DistrictCode) != req.StateCode {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "district does not belong to the selected state")
		return
	}
	if !validLatLng(req.Latitude, req.Longitude) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "shop location is invalid")
		return
	}
	if !req.OTPVerified {
		httpx.Fail(w, http.StatusBadRequest, "otp_required", "OTP verification is required before submission")
		return
	}
	if !auth.OTPSigned(r.Context(), req.ContactPhone) {
		httpx.Fail(w, http.StatusUnauthorized, "otp_unverified", "a Firebase ID token for this phone is required")
		return
	}
	// GSTIN is optional for onboarding (small/unregistered shops); PAN + email remain required.
	if req.PAN == "" || !strings.Contains(req.ContactEmail, "@") {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "pan and contact email are required")
		return
	}
	masked, ok := maskAccount(req.BankAccountNumber)
	if !ok || strings.TrimSpace(req.BankName) == "" ||
		len(strings.TrimSpace(req.BankIFSC)) != 11 || strings.TrimSpace(req.BankBeneficiary) == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "bank name, account number, ifsc and beneficiary are required")
		return
	}
	if !isStorageKey(req.PassbookFileKey) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "passbook document is required")
		return
	}
	bank := &BankAccount{
		BankName: strings.TrimSpace(req.BankName), AccountNumberMasked: masked,
		IFSC:            strings.ToUpper(strings.TrimSpace(req.BankIFSC)),
		BeneficiaryName: strings.TrimSpace(req.BankBeneficiary),
	}
	docs := []KycDocument{
		{DocType: "PASSBOOK", FileKey: strings.TrimSpace(req.PassbookFileKey), AssetID: strings.TrimSpace(req.PassbookAssetID)},
	}
	vendors := make([]VendorSeed, 0, len(req.Vendors))
	for _, v := range req.Vendors {
		vendors = append(vendors, VendorSeed{
			Name: v.Name, App: v.App, StateCode: req.StateCode, Address: v.Address, Phone: v.Phone,
			Hours: v.Hours, Latitude: v.Latitude, Longitude: v.Longitude, PlatformFeePct: v.PlatformFeePct,
			SellerCategoryID: v.CategoryID, FSSAINumber: v.FSSAINumber,
			FSSAICertKey: strings.TrimSpace(v.FSSAIFileKey), FSSAICertAssetID: strings.TrimSpace(v.FSSAIAssetID),
			DrugLicenseNumber: v.DrugLicenseNumber, DrugLicenseCertKey: strings.TrimSpace(v.DrugLicenseFileKey),
			DrugLicenseCertAssetID: strings.TrimSpace(v.DrugLicenseAssetID),
			BankName:               v.BankName, BankAccountNumber: v.BankAccountNumber, BankIFSC: v.BankIFSC,
			BankBeneficiary: v.BankBeneficiary,
		})
	}
	s, err := h.repo.CreateExtended(r.Context(), auth.UserID(r.Context()), Seller{
		BusinessName: req.BusinessName, OwnerName: req.OwnerName,
		GSTIN: req.GSTIN, PAN: req.PAN, BusinessAddress: req.BusinessAddress,
		ContactPhone: req.ContactPhone, ContactEmail: req.ContactEmail, StateCode: req.StateCode,
		DistrictCode: req.DistrictCode,
		Latitude:     req.Latitude, Longitude: req.Longitude, OTPVerified: true,
	}, bank, docs, vendors)
	if err != nil {
		if errors.Is(err, ErrEmailTaken) {
			httpx.Fail(w, http.StatusConflict, "email_taken", "a seller application with this contact email already exists")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "seller_create_failed", "could not create seller")
		return
	}

	h.log(r, "SELLER_CREATE", s.SellerID, nil, redactSeller(s))
	httpx.JSON(w, http.StatusCreated, s)
}

func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	before, ok, err := h.repo.ByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), before.SellerID, before.DistrictCode, before.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	if auth.Role(r.Context()) == auth.RoleSeller {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "sellers cannot change their own status")
		return
	}
	var req setStatusRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	req.Reason = strings.TrimSpace(req.Reason)
	if !validSellerStatus(req.Status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid seller status")
		return
	}
	if len(req.Reason) > 500 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "reason is too long")
		return
	}
	after, ok, err := h.repo.SetStatus(r.Context(), id, req.Status, req.Reason, h.actor(r))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update seller")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	afterMap := map[string]string{"status": after.Status}
	if req.Reason != "" {
		afterMap["reason"] = req.Reason
	}
	h.log(r, "SELLER_"+req.Status, id, map[string]string{"status": before.Status}, afterMap)
	resp := sellerResponse{Seller: after}
	if after.Status == "ACTIVE" {
		resp.Credential = h.provisionLogin(r.Context(), after)
	}
	httpx.JSON(w, http.StatusOK, resp)
}

type setStatusRequest struct {
	Status string `json:"status"`
	// Reason is an optional moderator note (e.g. a suspension/rejection reason). Persisted to the
	// rejection trail only on a REJECTED transition; always recorded in the audit entry.
	Reason string `json:"reason"`
}

type platformFeeRequest struct {
	StoreID        string `json:"storeId"`
	PlatformFeePct int    `json:"platformFeePct"`
}

// updatePlatformFee lets an admin apply a fee to one VENDOR (directory.stores). The fee is a property
// of the shop (0069), so a storeId is required; validation uses the store's real app.
func (h *Handler) updatePlatformFee(w http.ResponseWriter, r *http.Request) {
	before, ok := h.adminSeller(w, r)
	if !ok {
		return
	}
	var req platformFeeRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	storeID := strings.TrimSpace(req.StoreID)
	if storeID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "storeId is required")
		return
	}
	_, app, owned, err := h.repo.StoreFeeForSeller(r.Context(), storeID, before.SellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update platform fee")
		return
	}
	if !owned {
		httpx.Fail(w, http.StatusNotFound, "not_found", "vendor not found")
		return
	}
	if !validPlatformFee(app, req.PlatformFeePct) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "platform fee is outside the allowed range for this app")
		return
	}
	if _, err := h.repo.UpdateStorePlatformFee(r.Context(), before.SellerID, storeID, req.PlatformFeePct); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update platform fee")
		return
	}
	after, ok, err := h.repo.ByID(r.Context(), before.SellerID)
	if err != nil || !ok {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not reload seller")
		return
	}
	h.log(r, "SELLER_PLATFORM_FEE", before.SellerID,
		map[string]string{"storeId": storeID},
		map[string]int{"platformFeePct": req.PlatformFeePct})
	httpx.JSON(w, http.StatusOK, map[string]any{
		"seller": after, "storeId": storeID, "platformFeePct": req.PlatformFeePct,
	})
}

func (h *Handler) verifyKYC(w http.ResponseWriter, r *http.Request) {
	s, ok := h.adminSeller(w, r)
	if !ok {
		return
	}
	after, ok, err := h.repo.SetStatus(r.Context(), s.SellerID, "ACTIVE", "", h.actor(r))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not activate seller")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	h.log(r, "SELLER_VERIFY_KYC", s.SellerID,
		map[string]string{"status": s.Status},
		map[string]string{"status": after.Status})
	detail, _, _ := h.repo.DetailByID(r.Context(), after.SellerID)
	httpx.JSON(w, http.StatusOK, sellerDetailResponse{
		Detail:     detail,
		Credential: h.provisionLogin(r.Context(), after),
	})
}

// sellerResponse is a seller row plus the one-time credential minted when it is activated. The
// embedded Seller keeps the existing camelCase fields at the top level of the JSON object.
type sellerResponse struct {
	Seller
	Credential *contracts.SellerLogin `json:"credential,omitempty"`
}

// sellerDetailResponse is the admin review projection plus the activation credential.
type sellerDetailResponse struct {
	Detail
	Credential *contracts.SellerLogin `json:"credential,omitempty"`
}

// provisionLogin creates (or reuses) the seller's portal login. It is best-effort: a provisioning
// failure must never roll back an approval the admin already committed, so it is reported in the
// response instead. The temporary password is never logged.
func (h *Handler) provisionLogin(ctx context.Context, s Seller) *contracts.SellerLogin {
	if h.logins == nil {
		return nil
	}
	login, err := h.logins.ProvisionSellerLogin(ctx, s.SellerID, s.ContactEmail, s.BusinessName)
	if err != nil {
		return &contracts.SellerLogin{Skipped: true, Reason: "login provisioning failed"}
	}
	return &login
}

type verifyDocRequest struct {
	Notes string `json:"notes"`
}

func (h *Handler) verifyDoc(w http.ResponseWriter, r *http.Request) {
	s, ok := h.adminSeller(w, r)
	if !ok {
		return
	}
	docType := strings.ToUpper(strings.TrimSpace(chi.URLParam(r, "docType")))
	if !validDocType(docType) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid document type")
		return
	}
	var req verifyDocRequest
	_ = httpx.Decode(r, &req)
	ok, err := h.repo.VerifyDoc(r.Context(), s.SellerID, docType, h.actor(r), strings.TrimSpace(req.Notes))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "kyc_update_failed", "could not verify document")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "kyc document not found")
		return
	}
	h.log(r, "KYC_VERIFY_"+docType, s.SellerID, nil, map[string]string{"docType": docType})
	detail, _, _ := h.repo.DetailByID(r.Context(), s.SellerID)
	httpx.JSON(w, http.StatusOK, detail)
}

type rejectRequest struct {
	Reason string `json:"reason"`
}

func (h *Handler) reject(w http.ResponseWriter, r *http.Request) {
	s, ok := h.adminSeller(w, r)
	if !ok {
		return
	}
	var req rejectRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if len(req.Reason) < 4 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a rejection reason is required")
		return
	}
	after, ok, err := h.repo.Reject(r.Context(), s.SellerID, req.Reason, h.actor(r))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not reject seller")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	h.log(r, "SELLER_REJECTED", s.SellerID, map[string]string{"status": s.Status},
		map[string]string{"status": after.Status, "reason": req.Reason})
	httpx.JSON(w, http.StatusOK, after)
}

type editSellerRequest struct {
	BusinessName      string   `json:"businessName"`
	OwnerName         string   `json:"ownerName"`
	GSTIN             string   `json:"gstin"`
	PAN               string   `json:"pan"`
	BusinessAddress   string   `json:"businessAddress"`
	ContactPhone      string   `json:"contactPhone"`
	ContactEmail      string   `json:"contactEmail"`
	StateCode         string   `json:"stateCode"`
	DistrictCode      string   `json:"districtCode"`
	Latitude          *float64 `json:"latitude"`
	Longitude         *float64 `json:"longitude"`
	PassbookFileKey   string   `json:"passbookFileKey"`
	PassbookAssetID   string   `json:"passbookAssetId"`
	BankName          string   `json:"bankName"`
	BankAccountNumber string   `json:"bankAccountNumber"`
	BankIFSC          string   `json:"bankIfsc"`
	BankBeneficiary   string   `json:"bankBeneficiary"`
}

func (h *Handler) edit(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if auth.Role(r.Context()) != auth.RoleSeller || auth.SellerID(r.Context()) != id {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "only the seller can edit their application")
		return
	}
	var req editSellerRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.DistrictCode = geo.Normalise(req.DistrictCode)
	req.GSTIN = strings.ToUpper(strings.TrimSpace(req.GSTIN))
	req.PAN = strings.ToUpper(strings.TrimSpace(req.PAN))
	if len(req.StateCode) != 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state is invalid")
		return
	}
	stateOK, serr := h.repo.ValidStateCode(r.Context(), req.StateCode)
	if serr != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !stateOK {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state is invalid")
		return
	}
	if req.DistrictCode != "" {
		if !geo.IsValid(req.DistrictCode) {
			httpx.Fail(w, http.StatusBadRequest, "unknown_district", "unknown district code")
			return
		}
		if geo.StateForDistrict(req.DistrictCode) != req.StateCode {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "district does not belong to the selected state")
			return
		}
	}
	if !validLatLng(req.Latitude, req.Longitude) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "shop location is invalid")
		return
	}
	var bank *BankAccount
	if strings.TrimSpace(req.BankAccountNumber) != "" {
		masked, ok := maskAccount(req.BankAccountNumber)
		if !ok || len(strings.TrimSpace(req.BankIFSC)) != 11 || strings.TrimSpace(req.BankBeneficiary) == "" {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "bank details are incomplete")
			return
		}
		bank = &BankAccount{
			BankName: strings.TrimSpace(req.BankName), AccountNumberMasked: masked,
			IFSC:            strings.ToUpper(strings.TrimSpace(req.BankIFSC)),
			BeneficiaryName: strings.TrimSpace(req.BankBeneficiary),
		}
	}
	if req.PassbookFileKey != "" && !isStorageKey(req.PassbookFileKey) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "passbook document is invalid")
		return
	}
	docs := []KycDocument{}
	if req.PassbookFileKey != "" {
		docs = append(docs, KycDocument{
			DocType: "PASSBOOK", FileKey: strings.TrimSpace(req.PassbookFileKey),
			AssetID: strings.TrimSpace(req.PassbookAssetID),
		})
	}
	after, changes, err := h.repo.EditRequest(r.Context(), id, Seller{
		BusinessName: req.BusinessName, OwnerName: req.OwnerName,
		GSTIN: req.GSTIN, PAN: req.PAN, BusinessAddress: req.BusinessAddress,
		ContactPhone: req.ContactPhone, ContactEmail: strings.TrimSpace(req.ContactEmail),
		StateCode: req.StateCode, DistrictCode: req.DistrictCode,
		Latitude: req.Latitude, Longitude: req.Longitude,
	}, bank, docs, h.actor(r))
	if err != nil {
		if errors.Is(err, ErrNotEditable) {
			httpx.Fail(w, http.StatusConflict, "not_editable", "only a rejected application can be edited")
			return
		}
		if errors.Is(err, ErrEmailTaken) {
			httpx.Fail(w, http.StatusConflict, "email_taken", "a seller application with this contact email already exists")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update application")
		return
	}
	h.log(r, "SELLER_RESUBMIT", id, nil, map[string]any{"changedFields": redactHistory(changes)})
	httpx.JSON(w, http.StatusOK, after)
}

// editProfileRequest is a partial PATCH body. Pointer fields distinguish "not provided" (leave
// unchanged) from a zero value, so editing only the phone never clears the stored GSTIN/PAN/address.
type editProfileRequest struct {
	BusinessName    *string `json:"businessName"`
	OwnerName       *string `json:"ownerName"`
	GSTIN           *string `json:"gstin"`
	PAN             *string `json:"pan"`
	BusinessAddress *string `json:"businessAddress"`
	ContactPhone    *string `json:"contactPhone"`
}

func trimmedPtr(v *string) *string {
	if v == nil {
		return nil
	}
	t := strings.TrimSpace(*v)
	return &t
}

func upperPtr(v *string) *string {
	if v == nil {
		return nil
	}
	t := strings.ToUpper(strings.TrimSpace(*v))
	return &t
}

// editProfile updates a seller's editable business profile. A seller may only edit their own row; an
// admin may edit a seller in their district/state scope. A seller's KYC-bearing change (GSTIN/PAN/
// address) re-enters PENDING_REVIEW so it is re-verified; an admin edit is trusted as-is.
func (h *Handler) editProfile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	requeue := auth.Role(r.Context()) == auth.RoleSeller
	if requeue {
		if auth.SellerID(r.Context()) != id {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "only the seller can edit their profile")
			return
		}
	} else {
		s, ok, err := h.repo.ByID(r.Context(), id)
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
			return
		}
		if !ok || !auth.CanActForSellerDistrict(r.Context(), s.SellerID, s.DistrictCode, s.StateCode) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
			return
		}
	}
	var req editProfileRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	patch := ProfilePatch{
		BusinessName:    trimmedPtr(req.BusinessName),
		OwnerName:       trimmedPtr(req.OwnerName),
		GSTIN:           upperPtr(req.GSTIN),
		PAN:             upperPtr(req.PAN),
		BusinessAddress: trimmedPtr(req.BusinessAddress),
		ContactPhone:    trimmedPtr(req.ContactPhone),
	}
	if patch.BusinessName == nil && patch.OwnerName == nil && patch.GSTIN == nil &&
		patch.PAN == nil && patch.BusinessAddress == nil && patch.ContactPhone == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "no changes provided")
		return
	}
	if patch.BusinessName != nil && *patch.BusinessName == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a business name is required")
		return
	}
	if patch.OwnerName != nil && *patch.OwnerName == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "an owner name is required")
		return
	}
	after, ok, err := h.repo.UpdateProfile(r.Context(), id, patch, h.actor(r), requeue)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update profile")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	h.log(r, "SELLER_PROFILE_UPDATE", id, nil, redactSeller(after))
	httpx.JSON(w, http.StatusOK, after)
}

// getNotificationPreferences returns the signed-in seller's alert preferences (all-on by default).
func (h *Handler) getNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	sellerID := auth.SellerID(r.Context())
	if sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	prefs, err := h.repo.GetNotificationPreferences(r.Context(), sellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "preferences_unavailable", "notification preferences unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, prefs)
}

type notificationPreferencesRequest struct {
	NewOrder  bool `json:"newOrder"`
	LowStock  bool `json:"lowStock"`
	SLABreach bool `json:"slaBreach"`
	Campaigns bool `json:"campaigns"`
}

// putNotificationPreferences stores the signed-in seller's alert preferences.
func (h *Handler) putNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	sellerID := auth.SellerID(r.Context())
	if sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	var req notificationPreferencesRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	prefs, err := h.repo.UpsertNotificationPreferences(r.Context(), sellerID, NotificationPreferences{
		NewOrder: req.NewOrder, LowStock: req.LowStock, SLABreach: req.SLABreach, Campaigns: req.Campaigns,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "preferences_update_failed", "could not update notification preferences")
		return
	}
	h.log(r, "NOTIFICATION_PREFS_UPDATE", sellerID, nil, prefs)
	httpx.JSON(w, http.StatusOK, prefs)
}

// listSubUsers returns the signed-in seller's staff roster.
func (h *Handler) listSubUsers(w http.ResponseWriter, r *http.Request) {
	sellerID := auth.SellerID(r.Context())
	if sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	users, err := h.repo.ListSubUsers(r.Context(), sellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sub_users_unavailable", "sub-users unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, users)
}

type inviteSubUserRequest struct {
	// SellerID is accepted for wire compatibility with the portal; the real scope is the JWT.
	SellerID string `json:"sellerId"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

// subUserInviteResponse is the roster row plus the one-time accept token (returned only on create /
// resend; it is never projected by list).
type subUserInviteResponse struct {
	SubUser
	InviteToken string `json:"inviteToken"`
}

// inviteSubUser adds a PENDING_INVITE staff row scoped to the signed-in seller and returns the
// one-time accept token for the seller to share.
func (h *Handler) inviteSubUser(w http.ResponseWriter, r *http.Request) {
	sellerID := auth.SellerID(r.Context())
	if sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	var req inviteSubUserRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Role = strings.ToUpper(strings.TrimSpace(req.Role))
	if req.Name == "" || len(req.Name) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a name is required")
		return
	}
	if !validEmailAddress(req.Email) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a valid email is required")
		return
	}
	if req.Role != "STAFF" && req.Role != "VIEWER" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "role must be STAFF or VIEWER")
		return
	}
	// Reject an email that already has a portal login up front (the accept step would fail otherwise).
	if h.subUsers != nil {
		if inUse, err := h.subUsers.EmailInUse(r.Context(), req.Email); err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "sub_user_create_failed", "could not invite sub-user")
			return
		} else if inUse {
			httpx.Fail(w, http.StatusConflict, "email_in_use", "that email already has a portal login")
			return
		}
	}
	u, token, err := h.repo.InviteSubUser(r.Context(), sellerID, req.Name, req.Email, req.Role, h.actor(r))
	if err != nil {
		if errors.Is(err, ErrSubUserExists) {
			httpx.Fail(w, http.StatusConflict, "sub_user_exists", "a sub-user with this email already exists")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "sub_user_create_failed", "could not invite sub-user")
		return
	}
	h.log(r, "SUBUSER_INVITE", u.SubUserID, nil, map[string]string{"emailHash": shortEmailHash(u.Email), "role": u.Role})
	httpx.JSON(w, http.StatusCreated, subUserInviteResponse{SubUser: u, InviteToken: token})
}

// resendSubUserInvite rotates the accept token + expiry for a still-pending invite.
func (h *Handler) resendSubUserInvite(w http.ResponseWriter, r *http.Request) {
	sellerID := auth.SellerID(r.Context())
	if sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	id := chi.URLParam(r, "id")
	u, token, err := h.repo.ResendSubUserInvite(r.Context(), sellerID, id)
	if err != nil {
		if errors.Is(err, ErrSubUserNotPending) {
			httpx.Fail(w, http.StatusConflict, "invite_not_pending", "this invite can no longer be resent")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "sub_user_resend_failed", "could not resend the invite")
		return
	}
	h.log(r, "SUBUSER_INVITE_RESEND", id, nil, map[string]string{"role": u.Role})
	httpx.JSON(w, http.StatusOK, subUserInviteResponse{SubUser: u, InviteToken: token})
}

type acceptSubUserRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// acceptSubUserInvite consumes a one-time invite token, mints the scoped staff credential with the
// invitee's chosen password and activates the roster row. Public: the invitee has no session yet.
func (h *Handler) acceptSubUserInvite(w http.ResponseWriter, r *http.Request) {
	if h.subUsers == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "sub_user_accept_unavailable", "sub-user invites are not enabled")
		return
	}
	var req acceptSubUserRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" || req.Password == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "token and password are required")
		return
	}
	u, ok, err := h.repo.SubUserByInviteToken(r.Context(), req.Token)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sub_user_accept_failed", "could not accept the invite")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "invite_invalid", "this invite link is invalid or has expired")
		return
	}
	result, err := h.subUsers.CreateSubUserLogin(r.Context(), contracts.SubUserLogin{
		SellerID:    u.SellerID,
		SubUserID:   u.SubUserID,
		Email:       u.Email,
		DisplayName: u.Name,
		Password:    req.Password,
		SubRole:     u.Role,
	})
	if err != nil {
		switch {
		case errors.Is(err, contracts.ErrWeakPassword):
			httpx.Fail(w, http.StatusBadRequest, "weak_password", "use at least 12 characters and avoid common passwords")
		case errors.Is(err, contracts.ErrSubUserEmailInUse):
			httpx.Fail(w, http.StatusConflict, "email_in_use", "that email already has a portal login")
		default:
			httpx.Fail(w, http.StatusInternalServerError, "sub_user_accept_failed", "could not accept the invite")
		}
		return
	}
	active, ok, err := h.repo.AcceptSubUserInvite(r.Context(), req.Token, result.UserID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sub_user_accept_failed", "could not accept the invite")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "invite_invalid", "this invite link has already been used or expired")
		return
	}
	h.log(r, "SUBUSER_ACCEPT", active.SubUserID, nil, map[string]string{"role": active.Role})
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "email": result.Email})
}

// revokeSubUser marks a seller's sub-user REVOKED and deactivates its portal credential.
func (h *Handler) revokeSubUser(w http.ResponseWriter, r *http.Request) {
	sellerID := auth.SellerID(r.Context())
	if sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	id := chi.URLParam(r, "id")
	_, ok, err := h.repo.RevokeSubUser(r.Context(), sellerID, id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sub_user_revoke_failed", "could not revoke sub-user")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "sub-user not found")
		return
	}
	// Deactivate the linked credential + revoke its sessions (no-op when the invite was never accepted).
	if h.subUsers != nil {
		if err := h.subUsers.DeactivateSubUser(r.Context(), id); err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "sub_user_revoke_failed", "could not revoke sub-user")
			return
		}
	}
	h.log(r, "SUBUSER_REVOKE", id, nil, nil)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// validEmailAddress is a deliberately small shape check (the portal login is the real identity
// authority); it rejects empty/oversized values and anything without an @.
func validEmailAddress(v string) bool {
	if v == "" || len(v) > 254 {
		return false
	}
	at := strings.IndexByte(v, '@')
	return at > 0 && at < len(v)-1 && !strings.ContainsAny(v, " \t\r\n")
}

// shortEmailHash returns a stable 64-bit hex prefix of an email for audit logs (never raw PII).
func shortEmailHash(v string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(v))))
	return hex.EncodeToString(sum[:8])
}

type feeChangeRequestBody struct {
	StoreID        string `json:"storeId"`
	PlatformFeePct int    `json:"platformFeePct"`
}

// requestPlatformFeeChange lets a seller ASK for a new platform fee for one of their VENDORS. It never
// mutates the live fee; that only happens when a district/super admin approves the request.
func (h *Handler) requestPlatformFeeChange(w http.ResponseWriter, r *http.Request) {
	if auth.Role(r.Context()) != auth.RoleSeller || auth.SellerID(r.Context()) != chi.URLParam(r, "id") {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "only the seller can request a fee change")
		return
	}
	s, ok, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	var req feeChangeRequestBody
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	// The fee is a property of the vendor: resolve the current fee + app from the named store and
	// screen the requested value against that app's floor.
	storeID := strings.TrimSpace(req.StoreID)
	if storeID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "storeId is required")
		return
	}
	currentFee, app, owned, err := h.repo.StoreFeeForSeller(r.Context(), storeID, s.SellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !owned {
		httpx.Fail(w, http.StatusNotFound, "not_found", "store not found")
		return
	}
	if !validPlatformFee(app, req.PlatformFeePct) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "platform fee is outside the allowed range for this app")
		return
	}
	if req.PlatformFeePct == currentFee {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "requested fee is the current fee")
		return
	}
	f, err := h.repo.CreateFeeChangeRequest(r.Context(), s.SellerID, storeID, s.DistrictCode, currentFee, req.PlatformFeePct)
	if err != nil {
		if errors.Is(err, ErrPendingRequest) {
			httpx.Fail(w, http.StatusConflict, "request_pending", "a fee-change request is already pending")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "request_create_failed", "could not create the fee-change request")
		return
	}
	h.log(r, "SELLER_PLATFORM_FEE_REQUEST", s.SellerID,
		map[string]int{"platformFeePct": currentFee},
		map[string]int{"requestedFeePct": req.PlatformFeePct})
	httpx.JSON(w, http.StatusCreated, f)
}

// listSellerFeeChangeRequests returns the caller's own history (seller, or an admin with scope).
func (h *Handler) listSellerFeeChangeRequests(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, ok, err := h.repo.ByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), s.SellerID, s.DistrictCode, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	items, err := h.repo.ListSellerFeeChangeRequests(r.Context(), s.SellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "requests_unavailable", "fee-change requests unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// listFeeChangeRequests returns the review queue: a district admin sees their district, a super
// admin sees everything (optionally filtered by ?district= / ?status=).
func (h *Handler) listFeeChangeRequests(w http.ResponseWriter, r *http.Request) {
	districtCode := geo.Normalise(r.URL.Query().Get("district"))
	stateCode := ""
	if auth.Role(r.Context()) == auth.RoleDistrictAdmin {
		if d := auth.DistrictCode(r.Context()); d != "" {
			districtCode = d
		} else {
			stateCode = auth.StateCode(r.Context())
		}
	}
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	items, err := h.repo.ListFeeChangeRequests(r.Context(), districtCode, stateCode, status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "requests_unavailable", "fee-change requests unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type reviewFeeRequestBody struct {
	Reason string `json:"reason"`
	Note   string `json:"note"`
}

func (h *Handler) approveFeeChangeRequest(w http.ResponseWriter, r *http.Request) {
	f, ok := h.adminFeeRequest(w, r)
	if !ok {
		return
	}
	var req reviewFeeRequestBody
	_ = httpx.Decode(r, &req)
	seller, approved, ok, err := h.repo.ApproveFeeChangeRequest(r.Context(), f.RequestID, h.actor(r), strings.TrimSpace(req.Note))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "request_update_failed", "could not approve the request")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "not_pending", "request is not pending")
		return
	}
	h.log(r, "SELLER_PLATFORM_FEE_APPROVED", f.SellerID,
		map[string]int{"platformFeePct": f.CurrentFeePct},
		map[string]int{"platformFeePct": f.RequestedFeePct})
	httpx.JSON(w, http.StatusOK, map[string]any{"request": approved, "seller": seller})
}

func (h *Handler) rejectFeeChangeRequest(w http.ResponseWriter, r *http.Request) {
	f, ok := h.adminFeeRequest(w, r)
	if !ok {
		return
	}
	var req reviewFeeRequestBody
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if len(req.Reason) < 4 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a rejection reason is required")
		return
	}
	rejected, ok, err := h.repo.RejectFeeChangeRequest(r.Context(), f.RequestID, h.actor(r), req.Reason)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "request_update_failed", "could not reject the request")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "not_pending", "request is not pending")
		return
	}
	h.log(r, "SELLER_PLATFORM_FEE_REJECTED", f.SellerID,
		map[string]int{"requestedFeePct": f.RequestedFeePct}, map[string]string{"reason": req.Reason})
	httpx.JSON(w, http.StatusOK, rejected)
}

// adminFeeRequest resolves a pending request and enforces the admin's district/state scope.
func (h *Handler) adminFeeRequest(w http.ResponseWriter, r *http.Request) (FeeChangeRequest, bool) {
	f, ok, err := h.repo.FeeChangeRequestByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "requests_unavailable", "fee-change requests unavailable")
		return FeeChangeRequest{}, false
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "request not found")
		return FeeChangeRequest{}, false
	}
	s, ok, err := h.repo.ByID(r.Context(), f.SellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return FeeChangeRequest{}, false
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "request not found")
		return FeeChangeRequest{}, false
	}
	if !auth.CanActForSellerDistrict(r.Context(), f.SellerID, f.DistrictCode, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "request not found")
		return FeeChangeRequest{}, false
	}
	return f, true
}

// adminSeller resolves the path seller and enforces admin role + state scope.
func (h *Handler) adminSeller(w http.ResponseWriter, r *http.Request) (Seller, bool) {
	if !auth.IsAdmin(r.Context()) {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "admin role required")
		return Seller{}, false
	}
	s, ok, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return Seller{}, false
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), s.SellerID, s.DistrictCode, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return Seller{}, false
	}
	return s, true
}

func (h *Handler) listKYC(w http.ResponseWriter, r *http.Request) {
	s, ok, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), s.SellerID, s.DistrictCode, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	docs, err := h.repo.KYC(r.Context(), s.SellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "kyc_unavailable", "kyc documents unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, docs)
}

type kycRequest struct {
	DocType string `json:"docType"`
	FileKey string `json:"fileKey"`
	AssetID string `json:"assetId"`
}

func (h *Handler) addKYC(w http.ResponseWriter, r *http.Request) {
	s, ok, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), s.SellerID, s.DistrictCode, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	var req kycRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.DocType = strings.ToUpper(strings.TrimSpace(req.DocType))
	if !validDocType(req.DocType) || !isStorageKey(req.FileKey) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "docType or fileKey is invalid")
		return
	}
	doc, err := h.repo.AddKYC(r.Context(), KycDocument{
		SellerID: s.SellerID, DocType: req.DocType, FileKey: req.FileKey, AssetID: strings.TrimSpace(req.AssetID),
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "kyc_create_failed", "could not record kyc document")
		return
	}
	h.log(r, "KYC_ADD", s.SellerID, nil, map[string]string{"docType": doc.DocType})
	httpx.JSON(w, http.StatusCreated, doc)
}

func (h *Handler) getBank(w http.ResponseWriter, r *http.Request) {
	s, ok, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), s.SellerID, s.DistrictCode, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	b, found, err := h.repo.BankAccount(r.Context(), s.SellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bank_unavailable", "bank account unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "bank account not found")
		return
	}
	httpx.JSON(w, http.StatusOK, b)
}

type bankRequest struct {
	BankName            string `json:"bankName"`
	AccountNumberMasked string `json:"accountNumberMasked"`
	IFSC                string `json:"ifsc"`
	BeneficiaryName     string `json:"beneficiaryName"`
}

func (h *Handler) putBank(w http.ResponseWriter, r *http.Request) {
	s, ok, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSellerDistrict(r.Context(), s.SellerID, s.DistrictCode, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	var req bankRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.IFSC = strings.ToUpper(strings.TrimSpace(req.IFSC))
	req.BeneficiaryName = strings.TrimSpace(req.BeneficiaryName)
	// Only a masked tail may be stored — reject a full number.
	if !strings.Contains(req.AccountNumberMasked, "*") || len(req.IFSC) != 11 || req.BeneficiaryName == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "provide a masked account number, an 11-char IFSC and a beneficiary")
		return
	}
	b, err := h.repo.UpsertBankAccount(r.Context(), BankAccount{
		SellerID: s.SellerID, BankName: strings.TrimSpace(req.BankName),
		AccountNumberMasked: req.AccountNumberMasked, IFSC: req.IFSC, BeneficiaryName: req.BeneficiaryName,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bank_update_failed", "could not update bank account")
		return
	}
	h.log(r, "BANK_UPDATE", s.SellerID, nil, map[string]string{"ifsc": b.IFSC})
	httpx.JSON(w, http.StatusOK, b)
}

// log writes one audit row; never fails the request (best-effort, but recorded).
func (h *Handler) log(r *http.Request, action, entityID string, before, after any) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: h.actor(r), ActorRole: h.role(r), Action: action,
		Entity: "sellers.sellers", EntityID: entityID,
		Before: marshal(before), After: marshal(after),
	})
}

func (h *Handler) actor(r *http.Request) string {
	if id := auth.UserID(r.Context()); id != "" {
		return id
	}
	if id := auth.SellerID(r.Context()); id != "" {
		return id
	}
	return "anonymous"
}

func (h *Handler) role(r *http.Request) string {
	role := auth.Role(r.Context())
	if role == "" {
		return auth.RoleSeller
	}
	return role
}

func marshal(v any) json.RawMessage {
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return b
}

// auditPIIFields are seller field names whose values must never be written to admins.audit_logs
// (AGENTS.md: never log PII). The live row and API responses keep the values; only the audit
// snapshot is masked.
var auditPIIFields = map[string]bool{"contactPhone": true, "contactEmail": true}

// redactSeller returns a copy safe to serialize into the audit trail: contact phone and email are
// dropped, everything else (status, names, geo, KYC flags) is retained for accountability.
func redactSeller(s Seller) Seller {
	s.ContactPhone = ""
	s.ContactEmail = ""
	return s
}

// redactHistory masks the old/new values of PII fields in a resubmission diff before it is audited.
func redactHistory(in []RequestHistoryEntry) []RequestHistoryEntry {
	out := make([]RequestHistoryEntry, len(in))
	copy(out, in)
	for i := range out {
		if auditPIIFields[out[i].FieldName] {
			out[i].OldValue = ""
			out[i].NewValue = ""
		}
	}
	return out
}

// validLatLng accepts absent coordinates or a complete in-range pair.
func validLatLng(lat, lng *float64) bool {
	if lat == nil && lng == nil {
		return true
	}
	if lat == nil || lng == nil {
		return false
	}
	return *lat >= -90 && *lat <= 90 && *lng >= -180 && *lng <= 180
}

func validCategory(c string) bool { return c == "MART" || c == "FOOD" || c == "PHARMA" }

// validPlatformFee enforces the product rule: 1–100 for MART/PHARMA, 5–100 for FOOD.
func validPlatformFee(category string, pct int) bool {
	if pct < 1 || pct > 100 {
		return false
	}
	if category == "FOOD" && pct < 5 {
		return false
	}
	return true
}

func validSellerStatus(s string) bool {
	switch s {
	case "PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED":
		return true
	default:
		return false
	}
}

func validDocType(d string) bool {
	switch d {
	case "GSTIN", "PAN", "BANK_PROOF", "SHOP_LICENSE", "PASSBOOK", "FSSAI":
		return true
	default:
		return false
	}
}

// maskAccount keeps only the last four digits. The full number never enters Postgres.
func maskAccount(raw string) (string, bool) {
	digits := digitsOnly(raw)
	if len(digits) < 6 || len(digits) > 20 {
		return "", false
	}
	return "******" + digits[len(digits)-4:], true
}

func digitsOnly(v string) string {
	var b strings.Builder
	for _, r := range v {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// isStorageKey rejects URLs and inline data — KYC files live in R2 as private object keys.
func isStorageKey(k string) bool {
	k = strings.TrimSpace(k)
	if k == "" || len(k) > 512 {
		return false
	}
	lower := strings.ToLower(k)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") ||
		strings.HasPrefix(lower, "data:") || strings.HasPrefix(lower, "mock://") {
		return false
	}
	return true
}
