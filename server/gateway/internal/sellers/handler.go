package sellers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
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
}

// NewHandler builds the sellers handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit}
}

// Register mounts the sellers routes.
func (h *Handler) Register(r chi.Router) {
	// Onboarding: any authenticated applicant can create a PENDING_REVIEW seller.
	r.With(auth.Require).Post("/sellers", h.create)

	// Seller-scoped reads/writes + admin moderation.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/sellers", h.list)
		g.Get("/sellers/{id}", h.get)
		g.Get("/sellers/{id}/kyc", h.listKYC)
		g.Post("/sellers/{id}/kyc", h.addKYC)
		g.Get("/sellers/{id}/bank-account", h.getBank)
		g.Put("/sellers/{id}/bank-account", h.putBank)
		g.Patch("/sellers/{id}/status", h.setStatus)
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
	s, ok, err := h.repo.ByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "sellers_unavailable", "sellers unavailable")
		return
	}
	if !ok || !auth.CanActForSeller(r.Context(), s.SellerID, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}

type createSellerRequest struct {
	BusinessName    string `json:"businessName"`
	OwnerName       string `json:"ownerName"`
	Category        string `json:"category"`
	GSTIN           string `json:"gstin"`
	PAN             string `json:"pan"`
	BusinessAddress string `json:"businessAddress"`
	ContactPhone    string `json:"contactPhone"`
	StateCode       string `json:"stateCode"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createSellerRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Category = strings.ToUpper(strings.TrimSpace(req.Category))
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	if strings.TrimSpace(req.BusinessName) == "" || strings.TrimSpace(req.OwnerName) == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "business and owner name are required")
		return
	}
	if !validCategory(req.Category) || len(req.StateCode) != 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "category or state is invalid")
		return
	}
	s, err := h.repo.Create(r.Context(), Seller{
		BusinessName: req.BusinessName, OwnerName: req.OwnerName, Category: req.Category,
		GSTIN: req.GSTIN, PAN: req.PAN, BusinessAddress: req.BusinessAddress,
		ContactPhone: req.ContactPhone, StateCode: req.StateCode,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "seller_create_failed", "could not create seller")
		return
	}
	h.log(r, "SELLER_CREATE", s.SellerID, nil, s)
	httpx.JSON(w, http.StatusCreated, s)
}

type setStatusRequest struct {
	Status string `json:"status"`
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
	doc, err := h.repo.AddKYC(r.Context(), KycDocument{SellerID: s.SellerID, DocType: req.DocType, FileKey: req.FileKey})
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
		SellerID: s.SellerID, AccountNumberMasked: req.AccountNumberMasked,
		IFSC: req.IFSC, BeneficiaryName: req.BeneficiaryName,
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
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: "sellers.sellers", EntityID: entityID,
		Before: marshal(before), After: marshal(after),
	})
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
	case "GSTIN", "PAN", "BANK_PROOF", "SHOP_LICENSE":
		return true
	default:
		return false
	}
}

// isStorageKey rejects URLs and inline data — KYC files live in Supabase Storage as object keys.
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
