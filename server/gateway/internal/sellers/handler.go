package sellers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/razorpayroute"
	"github.com/go-chi/chi/v5"
)

// Handler serves the seller directory + onboarding. Reads and writes are role-gated; every mutation
// writes an admins.audit_logs row via contracts.AuditWriter. Seller records carry PII, so they are
// never cached (caching-cloudflare-valkey.md §8).
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
	route razorpayroute.Gateway
}

// NewHandler builds the sellers handler. A nil Route gateway falls back to mock mode.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter, route ...razorpayroute.Gateway) *Handler {
	var g razorpayroute.Gateway = razorpayroute.New("", "", "")
	if len(route) > 0 && route[0] != nil {
		g = route[0]
	}
	return &Handler{repo: repo, cache: c, audit: audit, route: g}
}

// Register mounts the sellers routes.
func (h *Handler) Register(r chi.Router) {
	// Onboarding: any authenticated applicant can create a PENDING_REVIEW seller.
	r.With(auth.Require).Post("/sellers", h.create)

	// Seller-scoped reads/writes + admin moderation. Admin-only actions re-check the role and the
	// state scope inside the handler so a seller can never moderate their own application.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/sellers", h.list)
		g.Get("/sellers/{id}", h.get)
		g.Get("/sellers/{id}/detail", h.get)
		g.Get("/sellers/{id}/kyc", h.listKYC)
		g.Post("/sellers/{id}/kyc", h.addKYC)
		g.Get("/sellers/{id}/bank-account", h.getBank)
		g.Put("/sellers/{id}/bank-account", h.putBank)
		g.Patch("/sellers/{id}/status", h.setStatus)
		// Admin review actions (STATE_ADMIN in-state, SUPER_ADMIN anywhere; sellers are rejected).
		g.Patch("/sellers/{id}/platform-fee", h.updatePlatformFee)
		g.Post("/sellers/{id}/verify-kyc", h.verifyKYC)
		g.Post("/sellers/{id}/verify-doc/{docType}", h.verifyDoc)
		g.Post("/sellers/{id}/reject", h.reject)
		// Seller resubmission of a rejected application (history preserved until approval).
		g.Post("/sellers/{id}/edit", h.edit)
	})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		SellerID:  strings.TrimSpace(r.URL.Query().Get("sellerId")),
		StateCode: strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state"))),
		Status:    strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status"))),
		Category:  strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("category"))),
	}
	// Role scoping: a seller sees only themself; a state admin only their state.
	switch auth.Role(r.Context()) {
	case auth.RoleSeller:
		f.SellerID = auth.SellerID(r.Context())
		if f.SellerID == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
			return
		}
		f.StateCode = ""
	case auth.RoleStateAdmin:
		f.StateCode = auth.StateCode(r.Context())
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
	if !ok || !auth.CanActForSeller(r.Context(), d.SellerID, d.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

type createSellerRequest struct {
	BusinessName    string `json:"businessName"`
	OwnerName       string `json:"ownerName"`
	Category        string `json:"category"`
	GSTIN           string `json:"gstin"`
	PAN             string `json:"pan"`
	BusinessAddress string `json:"businessAddress"`
	ContactPhone    string `json:"contactPhone"`
	ContactEmail    string `json:"contactEmail"`
	StateCode       string `json:"stateCode"`
	PlatformFeePct  *int   `json:"platformFeePct"`
	// Bank details. The full account number is accepted transiently for Razorpay Route and is
	// masked before it ever reaches Postgres.
	BankName          string `json:"bankName"`
	BankAccountNumber string `json:"bankAccountNumber"`
	BankIFSC          string `json:"bankIfsc"`
	BankBeneficiary   string `json:"bankBeneficiary"`
	// KYC uploads (private R2). Passbook is mandatory; FSSAI is mandatory for FOOD.
	PassbookFileKey string `json:"passbookFileKey"`
	PassbookAssetID string `json:"passbookAssetId"`
	FSSAINumber     string `json:"fssaiNumber"`
	FSSAIFileKey    string `json:"fssaiFileKey"`
	FSSAIAssetID    string `json:"fssaiAssetId"`
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
	req.Category = strings.ToUpper(strings.TrimSpace(req.Category))
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.GSTIN = strings.ToUpper(strings.TrimSpace(req.GSTIN))
	req.PAN = strings.ToUpper(strings.TrimSpace(req.PAN))
	req.ContactEmail = strings.TrimSpace(req.ContactEmail)

	if strings.TrimSpace(req.BusinessName) == "" || strings.TrimSpace(req.OwnerName) == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "business and owner name are required")
		return
	}
	if !validCategory(req.Category) || len(req.StateCode) != 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "category or state is invalid")
		return
	}
	if req.PlatformFeePct == nil || !validPlatformFee(req.Category, *req.PlatformFeePct) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "platform fee is outside the allowed range for this category")
		return
	}
	if !req.OTPVerified {
		httpx.Fail(w, http.StatusBadRequest, "otp_required", "OTP verification is required before submission")
		return
	}
	if req.GSTIN == "" || req.PAN == "" || !strings.Contains(req.ContactEmail, "@") {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "gstin, pan and contact email are required")
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
	if req.Category == "FOOD" {
		if strings.TrimSpace(req.FSSAINumber) == "" || !isStorageKey(req.FSSAIFileKey) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "fssai number and certificate are required for food sellers")
			return
		}
	}

	bank := &BankAccount{
		BankName: strings.TrimSpace(req.BankName), AccountNumberMasked: masked,
		IFSC:            strings.ToUpper(strings.TrimSpace(req.BankIFSC)),
		BeneficiaryName: strings.TrimSpace(req.BankBeneficiary),
	}
	docs := []KycDocument{
		{DocType: "PASSBOOK", FileKey: strings.TrimSpace(req.PassbookFileKey), AssetID: strings.TrimSpace(req.PassbookAssetID)},
	}
	if req.Category == "FOOD" {
		docs = append(docs, KycDocument{
			DocType: "FSSAI", FileKey: strings.TrimSpace(req.FSSAIFileKey), AssetID: strings.TrimSpace(req.FSSAIAssetID),
		})
	}

	s, err := h.repo.CreateExtended(r.Context(), Seller{
		BusinessName: req.BusinessName, OwnerName: req.OwnerName, Category: req.Category,
		GSTIN: req.GSTIN, PAN: req.PAN, BusinessAddress: req.BusinessAddress,
		ContactPhone: req.ContactPhone, ContactEmail: req.ContactEmail, StateCode: req.StateCode,
		PlatformFeePct: *req.PlatformFeePct, FSSAINumber: strings.TrimSpace(req.FSSAINumber),
		FSSAICertKey: strings.TrimSpace(req.FSSAIFileKey), FSSAICertAssetID: strings.TrimSpace(req.FSSAIAssetID),
		OTPVerified: true,
	}, bank, docs)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_create_failed", "could not create seller")
		return
	}

	// Provision the Route linked account at onboarding: the full account number is only available
	// here, so it is forwarded to Razorpay and never stored. Failure is non-fatal; an admin can
	// retry from the review page (the account can be created without bank details).
	if accountID, rerr := h.ensureLinkedAccount(r.Context(), s, bank, req.BankAccountNumber); rerr == nil && accountID != "" {
		if updated, ok, uerr := h.repo.SetLinkedAccount(r.Context(), s.SellerID, accountID); uerr == nil && ok {
			s = updated
		}
	}

	h.log(r, "SELLER_CREATE", s.SellerID, nil, s)
	httpx.JSON(w, http.StatusCreated, s)
}

func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	before, ok, err := h.repo.ByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSeller(r.Context(), before.SellerID, before.StateCode) {
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
	if !validSellerStatus(req.Status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid seller status")
		return
	}
	after, ok, err := h.repo.SetStatus(r.Context(), id, req.Status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update seller")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	h.log(r, "SELLER_"+req.Status, id, map[string]string{"status": before.Status}, map[string]string{"status": after.Status})
	httpx.JSON(w, http.StatusOK, after)
}

type setStatusRequest struct {
	Status string `json:"status"`
}

type platformFeeRequest struct {
	PlatformFeePct int `json:"platformFeePct"`
}

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
	if !validPlatformFee(before.Category, req.PlatformFeePct) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "platform fee is outside the allowed range for this category")
		return
	}
	after, ok, err := h.repo.UpdatePlatformFee(r.Context(), before.SellerID, req.PlatformFeePct)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update platform fee")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	h.log(r, "SELLER_PLATFORM_FEE", before.SellerID,
		map[string]int{"platformFeePct": before.PlatformFeePct},
		map[string]int{"platformFeePct": after.PlatformFeePct})
	httpx.JSON(w, http.StatusOK, after)
}

func (h *Handler) verifyKYC(w http.ResponseWriter, r *http.Request) {
	s, ok := h.adminSeller(w, r)
	if !ok {
		return
	}
	if s.RazorpayLinkedAccountID == "" {
		accountID, err := h.ensureLinkedAccount(r.Context(), s, nil, "")
		if err != nil {
			httpx.Fail(w, http.StatusBadGateway, "razorpay_unavailable", "could not create the Razorpay linked account")
			return
		}
		updated, ok, err := h.repo.SetLinkedAccount(r.Context(), s.SellerID, accountID)
		if err != nil || !ok {
			httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not save the linked account")
			return
		}
		s = updated
	}
	after, ok, err := h.repo.SetStatus(r.Context(), s.SellerID, "ACTIVE")
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not activate seller")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	h.log(r, "SELLER_VERIFY_KYC", s.SellerID,
		map[string]string{"status": s.Status, "linkedAccountId": s.RazorpayLinkedAccountID},
		map[string]string{"status": after.Status, "linkedAccountId": after.RazorpayLinkedAccountID})
	detail, _, _ := h.repo.DetailByID(r.Context(), after.SellerID)
	httpx.JSON(w, http.StatusOK, detail)
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
	BusinessName      string `json:"businessName"`
	OwnerName         string `json:"ownerName"`
	Category          string `json:"category"`
	GSTIN             string `json:"gstin"`
	PAN               string `json:"pan"`
	BusinessAddress   string `json:"businessAddress"`
	ContactPhone      string `json:"contactPhone"`
	ContactEmail      string `json:"contactEmail"`
	StateCode         string `json:"stateCode"`
	PlatformFeePct    int    `json:"platformFeePct"`
	FSSAINumber       string `json:"fssaiNumber"`
	FSSAIFileKey      string `json:"fssaiFileKey"`
	FSSAIAssetID      string `json:"fssaiAssetId"`
	PassbookFileKey   string `json:"passbookFileKey"`
	PassbookAssetID   string `json:"passbookAssetId"`
	BankName          string `json:"bankName"`
	BankAccountNumber string `json:"bankAccountNumber"`
	BankIFSC          string `json:"bankIfsc"`
	BankBeneficiary   string `json:"bankBeneficiary"`
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
	req.Category = strings.ToUpper(strings.TrimSpace(req.Category))
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.GSTIN = strings.ToUpper(strings.TrimSpace(req.GSTIN))
	req.PAN = strings.ToUpper(strings.TrimSpace(req.PAN))
	if !validCategory(req.Category) || len(req.StateCode) != 2 || !validPlatformFee(req.Category, req.PlatformFeePct) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "category, state or platform fee is invalid")
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
	if req.FSSAIFileKey != "" && !isStorageKey(req.FSSAIFileKey) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "fssai document is invalid")
		return
	}
	docs := []KycDocument{}
	if req.PassbookFileKey != "" {
		docs = append(docs, KycDocument{
			DocType: "PASSBOOK", FileKey: strings.TrimSpace(req.PassbookFileKey),
			AssetID: strings.TrimSpace(req.PassbookAssetID),
		})
	}
	if req.Category == "FOOD" && req.FSSAIFileKey != "" {
		docs = append(docs, KycDocument{
			DocType: "FSSAI", FileKey: strings.TrimSpace(req.FSSAIFileKey),
			AssetID: strings.TrimSpace(req.FSSAIAssetID),
		})
	}
	after, changes, err := h.repo.EditRequest(r.Context(), id, Seller{
		BusinessName: req.BusinessName, OwnerName: req.OwnerName, Category: req.Category,
		GSTIN: req.GSTIN, PAN: req.PAN, BusinessAddress: req.BusinessAddress,
		ContactPhone: req.ContactPhone, ContactEmail: strings.TrimSpace(req.ContactEmail),
		StateCode: req.StateCode, PlatformFeePct: req.PlatformFeePct,
		FSSAINumber: strings.TrimSpace(req.FSSAINumber), FSSAICertKey: strings.TrimSpace(req.FSSAIFileKey),
		FSSAICertAssetID: strings.TrimSpace(req.FSSAIAssetID),
	}, bank, docs, h.actor(r))
	if err != nil {
		if errors.Is(err, ErrNotEditable) {
			httpx.Fail(w, http.StatusConflict, "not_editable", "only a rejected application can be edited")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "seller_update_failed", "could not update application")
		return
	}
	h.log(r, "SELLER_RESUBMIT", id, nil, map[string]any{"changedFields": changes})
	httpx.JSON(w, http.StatusOK, after)
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
	if !ok || !auth.CanActForSeller(r.Context(), s.SellerID, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return Seller{}, false
	}
	return s, true
}

// ensureLinkedAccount creates a Route linked account and returns its id. The full account number is
// used transiently only; passing an empty number omits the bank object (the seller can complete it
// later from the Route dashboard).
func (h *Handler) ensureLinkedAccount(ctx context.Context, s Seller, bank *BankAccount, accountNumber string) (string, error) {
	if s.RazorpayLinkedAccountID != "" {
		return s.RazorpayLinkedAccountID, nil
	}
	in := razorpayroute.LinkedAccountInput{
		Email: s.ContactEmail, Phone: digitsOnly(s.ContactPhone),
		LegalBusinessName: s.BusinessName, ContactName: s.OwnerName,
		Category: "ecommerce", AddressLine: s.BusinessAddress, StateCode: s.StateCode,
	}
	if bank != nil {
		in.BankName = bank.BankName
		in.AccountNumber = digitsOnly(accountNumber)
		in.IFSC = bank.IFSC
		in.BeneficiaryName = bank.BeneficiaryName
	} else if b, ok, err := h.repo.BankAccount(ctx, s.SellerID); err == nil && ok {
		in.BankName = b.BankName
		in.IFSC = b.IFSC
		in.BeneficiaryName = b.BeneficiaryName
	}
	return h.route.CreateLinkedAccount(ctx, in)
}

func (h *Handler) listKYC(w http.ResponseWriter, r *http.Request) {
	s, ok, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSeller(r.Context(), s.SellerID, s.StateCode) {
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
	if !ok || !auth.CanActForSeller(r.Context(), s.SellerID, s.StateCode) {
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
	if !ok || !auth.CanActForSeller(r.Context(), s.SellerID, s.StateCode) {
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
	if !ok || !auth.CanActForSeller(r.Context(), s.SellerID, s.StateCode) {
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
