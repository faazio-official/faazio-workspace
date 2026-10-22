package delivery

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the delivery-partner API. Rider endpoints are gated by a verified phone identity
// (Firebase ID token) and resolve the rider by phone; admin endpoints are role + state scoped.
type Handler struct {
	repo                *Repo
	cache               *cache.Cache
	audit               contracts.AuditWriter
	notifier            contracts.Notifier
	matrix              RoadMatrix
	orders              contracts.OrderOwnership
	maxDispatchAttempts int
}

// NewHandler builds the delivery handler. matrix may be nil (straight-line fallback); notifier may
// be nil (the durable outbox is simply not written in non-Supabase dev environments); orders is the
// checkout ownership checker used by the customer rating path.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter, notifier contracts.Notifier, matrix RoadMatrix, orders contracts.OrderOwnership, maxDispatchAttempts int) *Handler {
	if matrix == nil {
		matrix = StraightLineMatrix{}
	}
	if c == nil {
		c = &cache.Cache{}
	}
	if maxDispatchAttempts < 1 {
		maxDispatchAttempts = 5
	}
	return &Handler{
		repo: repo, cache: c, audit: audit, notifier: notifier, matrix: matrix, orders: orders,
		maxDispatchAttempts: maxDispatchAttempts,
	}
}

// Register mounts the delivery routes.
func (h *Handler) Register(r chi.Router) {
	// Rider self-service.
	r.With(auth.Require).Post("/delivery/register", h.register)
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/delivery/me", h.me)
		g.Get("/delivery/active", h.activeOrders)
		g.Post("/delivery/heartbeat", h.heartbeat)
		g.Put("/delivery/availability", h.setAvailability)
		g.Post("/delivery/{orderId}/accept", h.acceptOrder)
		g.Post("/delivery/{orderId}/reject", h.rejectOrder)
		g.Put("/delivery/stop/{stopId}/status", h.updateStop)
		g.Get("/delivery/route/{deliveryId}", h.getRoute)
		g.Post("/delivery/otp/verify", h.verifyOTP)
	})

	// Customer post-delivery rating (any authenticated shopper).
	r.With(auth.Require).Post("/delivery/{orderId}/rate", h.rate)

	// Admin / internal control plane.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/delivery/register/pending", h.listApplications)
		g.Get("/delivery/register/{id}", h.getApplication)
		g.Put("/delivery/register/{id}/verify", h.verifyApplication)
		g.Put("/delivery/register/{id}/reject", h.rejectApplication)
		g.Put("/delivery/register/{id}/reupload-request", h.requestReupload)
		g.Get("/delivery/online-riders", h.onlineRiders)
		g.Get("/admin/delivery-boys", h.adminRiders)
		g.Get("/admin/delivery-boys/{id}/location", h.adminLocation)
		g.Post("/dispatch/assign", h.assign)
	})
	// Super-admin-only transitions.
	r.With(auth.RequireRole(auth.RoleSuperAdmin)).Put("/delivery/register/{id}/activate", h.activateApplication)
	r.With(auth.RequireRole(auth.RoleSuperAdmin)).Put("/delivery/boys/{id}/blacklist", h.blacklist)
	r.With(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin)).Put("/delivery/boys/{id}/suspend", h.suspend)
}

// ---------------------------------------------------------------- rider registration

type documentInput = DocumentInput
type bankInput = BankInput

var validDocTypes = map[string]bool{
	"AADHAAR": true, "PAN": true, "SELFIE": true, "DL_FRONT": true, "DL_BACK": true,
	"RC_FRONT": true, "RC_BACK": true, "INSURANCE_FRONT": true, "INSURANCE_BACK": true,
}

var (
	ifscPattern    = regexp.MustCompile(`^[A-Z]{4}0[A-Z0-9]{6}$`)
	pincodePattern = regexp.MustCompile(`^[0-9]{6}$`)
)

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req ApplyRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid application payload")
		return
	}
	phoneRaw := auth.Phone(r.Context())
	if phoneRaw == "" {
		if !auth.Dev(r.Context()) {
			httpx.Fail(w, http.StatusUnauthorized, "phone_required", "a verified phone is required")
			return
		}
		phoneRaw = req.Phone // dev-only: AUTH_DISABLED has no verified token
	}
	phone, ok := NormalizePhone(phoneRaw)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "invalid_phone", "a valid 10-digit mobile number is required")
		return
	}
	if msg, ok := validateApplication(&req); !ok {
		httpx.Fail(w, http.StatusBadRequest, "invalid_application", msg)
		return
	}
	masked := maskAccount(req.Bank.AccountNumber)
	rider, err := h.repo.CreateApplication(r.Context(), phone, auth.UserID(r.Context()), req, masked)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_BOY_APPLY", rider.RiderID, nil, map[string]any{
		"vehicleType": rider.VehicleType, "stateCode": rider.StateCode,
	})
	httpx.JSON(w, http.StatusAccepted, rider)
}

func validateApplication(req *ApplyRequest) (string, bool) {
	req.FullName = strings.TrimSpace(req.FullName)
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.HubZone = strings.TrimSpace(req.HubZone)
	req.Address = strings.TrimSpace(req.Address)
	req.City = strings.TrimSpace(req.City)
	req.Pincode = strings.TrimSpace(req.Pincode)
	req.VehicleType = strings.ToUpper(strings.TrimSpace(req.VehicleType))
	if len(req.FullName) < 3 {
		return "full name is required", false
	}
	if len(req.StateCode) != 2 {
		return "a 2-letter state code is required", false
	}
	if req.HubZone == "" {
		return "a hub zone is required", false
	}
	if len(req.Address) < 5 {
		return "a delivery address is required", false
	}
	if req.City == "" {
		return "a city is required", false
	}
	if !pincodePattern.MatchString(req.Pincode) {
		return "a 6-digit pincode is required", false
	}
	emergency, ok := NormalizePhone(req.EmergencyContact)
	if !ok {
		return "a valid 10-digit emergency contact is required", false
	}
	req.EmergencyContact = strings.TrimPrefix(emergency, "+91")
	cap, ok := CapacityForVehicle(req.VehicleType)
	if !ok {
		return "vehicle type must be BICYCLE, TWO_WHEELER or FOUR_WHEELER", false
	}
	if req.MaxCapacity == 0 {
		req.MaxCapacity = cap
	}
	if req.MaxCapacity < 1 || req.MaxCapacity > cap {
		return fmt.Sprintf("%s capacity is capped at %d orders", req.VehicleType, cap), false
	}
	if req.Bank.AccountName = strings.TrimSpace(req.Bank.AccountName); req.Bank.AccountName == "" {
		return "bank account name is required", false
	}
	digits := digitsOnly(req.Bank.AccountNumber)
	if len(digits) < 9 || len(digits) > 18 {
		return "a valid bank account number is required", false
	}
	req.Bank.IFSC = strings.ToUpper(strings.TrimSpace(req.Bank.IFSC))
	if !ifscPattern.MatchString(req.Bank.IFSC) {
		return "a valid IFSC is required", false
	}
	req.Bank.ChequeKey = strings.TrimSpace(req.Bank.ChequeKey)
	req.Bank.ChequeAssetID = strings.TrimSpace(req.Bank.ChequeAssetID)

	seen := map[string]bool{}
	for i := range req.Documents {
		d := &req.Documents[i]
		d.DocType = strings.ToUpper(strings.TrimSpace(d.DocType))
		d.FileKey = strings.TrimSpace(d.FileKey)
		d.AssetID = strings.TrimSpace(d.AssetID)
		if !validDocTypes[d.DocType] {
			return "unknown document type: " + d.DocType, false
		}
		if seen[d.DocType] {
			return "duplicate document: " + d.DocType, false
		}
		seen[d.DocType] = true
		if d.FileKey == "" {
			return "a private file key is required for " + d.DocType, false
		}
	}
	for _, required := range requiredDocsFor(req.VehicleType) {
		if !seen[required] {
			return "missing required document: " + required, false
		}
	}
	return "", true
}

func maskAccount(raw string) string {
	digits := digitsOnly(raw)
	if len(digits) <= 4 {
		return "••••" + digits
	}
	return "••••••••" + digits[len(digits)-4:]
}

func digitsOnly(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			b.WriteByte(s[i])
		}
	}
	return b.String()
}

// ---------------------------------------------------------------- admin review

func (h *Handler) listApplications(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		StateCode: strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state"))),
		Status:    strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status"))),
		Limit:     httpx.LimitParam(r, 100, 200),
	}
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		f.StateCode = auth.StateCode(r.Context())
	}
	if f.Status == "ALL" {
		f.Status = ""
	} else if f.Status == "" {
		f.Status = StatusPendingReview
	}
	if f.Status != "" && !validRiderStatus(f.Status) {
		httpx.Fail(w, http.StatusBadRequest, "invalid_status", "unknown rider status")
		return
	}
	items, err := h.repo.List(r.Context(), f)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) getApplication(w http.ResponseWriter, r *http.Request) {
	d, ok, err := h.repo.Detail(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok || !canActForState(r.Context(), d.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "application not found")
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

type verifyRequest struct {
	DocType        string `json:"docType"`
	ApproveProfile bool   `json:"approveProfile"`
}

func (h *Handler) verifyApplication(w http.ResponseWriter, r *http.Request) {
	var req verifyRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid verify payload")
		return
	}
	id := chi.URLParam(r, "id")
	d, ok, err := h.repo.Detail(r.Context(), id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok || !canActForState(r.Context(), d.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "application not found")
		return
	}
	reviewer := auth.UserID(r.Context())
	if req.DocType != "" {
		dt := strings.ToUpper(strings.TrimSpace(req.DocType))
		if !validDocTypes[dt] {
			httpx.Fail(w, http.StatusBadRequest, "invalid_doc_type", "unknown document type")
			return
		}
		if err := h.repo.SetDocumentStatus(r.Context(), id, dt, DocVerified, "", reviewer); err != nil {
			h.writeErr(w, err)
			return
		}
		h.auditEvent(r.Context(), "DELIVERY_BOY_DOC_VERIFIED", id, nil, map[string]any{"docType": dt})
	}
	if req.ApproveProfile {
		if err := h.repo.ApproveProfile(r.Context(), id, reviewer); err != nil {
			h.writeErr(w, err)
			return
		}
		h.auditEvent(r.Context(), "DELIVERY_BOY_VERIFY", id, nil, map[string]any{"status": StatusVerified})
	}
	if req.DocType == "" && !req.ApproveProfile {
		httpx.Fail(w, http.StatusBadRequest, "nothing_to_do", "verify a document or approve the profile")
		return
	}
	h.respondDetail(w, r, id)
}

type reasonRequest struct {
	Reason string `json:"reason"`
}

func (h *Handler) rejectApplication(w http.ResponseWriter, r *http.Request) {
	var req reasonRequest
	if err := httpx.Decode(r, &req); err != nil || strings.TrimSpace(req.Reason) == "" {
		httpx.Fail(w, http.StatusBadRequest, "reason_required", "a rejection reason is required")
		return
	}
	id := chi.URLParam(r, "id")
	d, ok, err := h.repo.Detail(r.Context(), id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok || !canActForState(r.Context(), d.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "application not found")
		return
	}
	switch d.Status {
	case StatusApplied, StatusPendingReview, StatusVerified, StatusRejected:
	default:
		httpx.Fail(w, http.StatusConflict, "invalid_transition", "suspend or blacklist an active rider instead")
		return
	}
	if err := h.repo.SetStatus(r.Context(), id, StatusRejected, req.Reason); err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_BOY_REJECT", id, nil, map[string]any{"reason": req.Reason})
	h.respondDetail(w, r, id)
}

type reuploadRequest struct {
	DocType string `json:"docType"`
	Reason  string `json:"reason"`
}

func (h *Handler) requestReupload(w http.ResponseWriter, r *http.Request) {
	var req reuploadRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid reupload payload")
		return
	}
	dt := strings.ToUpper(strings.TrimSpace(req.DocType))
	if !validDocTypes[dt] {
		httpx.Fail(w, http.StatusBadRequest, "invalid_doc_type", "unknown document type")
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		httpx.Fail(w, http.StatusBadRequest, "reason_required", "a re-upload reason is required")
		return
	}
	id := chi.URLParam(r, "id")
	d, ok, err := h.repo.Detail(r.Context(), id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok || !canActForState(r.Context(), d.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "application not found")
		return
	}
	if err := h.repo.SetDocumentStatus(r.Context(), id, dt, DocReuploadRequested, reason, auth.UserID(r.Context())); err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_BOY_REUPLOAD_REQUEST", id, nil, map[string]any{
		"docType": dt, "reason": reason,
	})
	h.respondDetail(w, r, id)
}

func (h *Handler) activateApplication(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	d, ok, err := h.repo.Detail(r.Context(), id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "application not found")
		return
	}
	if d.Status != StatusVerified {
		httpx.Fail(w, http.StatusConflict, "not_verified", "the profile must be verified before activation")
		return
	}
	if err := h.repo.SetStatus(r.Context(), id, StatusActive, ""); err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_BOY_ACTIVATE", id, nil, map[string]any{"status": StatusActive})
	h.respondDetail(w, r, id)
}

func (h *Handler) suspend(w http.ResponseWriter, r *http.Request) {
	var req reasonRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid suspend payload")
		return
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if req.Reason == "" {
		httpx.Fail(w, http.StatusBadRequest, "reason_required", "a suspension reason is required")
		return
	}
	id := chi.URLParam(r, "id")
	d, ok, err := h.repo.Detail(r.Context(), id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok || !canActForState(r.Context(), d.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "rider not found")
		return
	}
	if d.Status != StatusActive && d.Status != StatusSuspended {
		httpx.Fail(w, http.StatusConflict, "not_active", "only an active or suspended rider can be suspended")
		return
	}
	if err := h.repo.SetStatus(r.Context(), id, StatusSuspended, req.Reason); err != nil {
		h.writeErr(w, err)
		return
	}
	h.cache.Del(r.Context(), cache.DeliveryRiderLocation(id))
	h.auditEvent(r.Context(), "DELIVERY_BOY_SUSPEND", id, nil, map[string]any{"reason": req.Reason})
	h.respondDetail(w, r, id)
}

func (h *Handler) blacklist(w http.ResponseWriter, r *http.Request) {
	var req reasonRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid blacklist payload")
		return
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if req.Reason == "" {
		httpx.Fail(w, http.StatusBadRequest, "reason_required", "a blacklist reason is required")
		return
	}
	id := chi.URLParam(r, "id")
	d, ok, err := h.repo.Detail(r.Context(), id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "rider not found")
		return
	}
	if d.Status == StatusBlacklisted {
		httpx.Fail(w, http.StatusConflict, "already_blacklisted", "this rider is already blacklisted")
		return
	}
	if err := h.repo.SetStatus(r.Context(), id, StatusBlacklisted, req.Reason); err != nil {
		h.writeErr(w, err)
		return
	}
	h.cache.Del(r.Context(), cache.DeliveryRiderLocation(id))
	h.auditEvent(r.Context(), "DELIVERY_BOY_BLACKLIST", id, nil, map[string]any{"reason": req.Reason})
	h.respondDetail(w, r, id)
}

func (h *Handler) respondDetail(w http.ResponseWriter, r *http.Request, id string) {
	d, ok, err := h.repo.Detail(r.Context(), id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "application not found")
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

// me returns the authenticated rider's current application/active record (any status) so the
// partner app can render "under review", "verified", "suspended" etc. on cold start.
func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	phone, ok := NormalizePhone(auth.Phone(r.Context()))
	if !ok {
		httpx.Fail(w, http.StatusUnauthorized, "phone_required", "a verified phone is required")
		return
	}
	rider, err := h.repo.RiderByPhone(r.Context(), phone)
	if errors.Is(err, ErrNotFound) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "no rider application for this phone")
		return
	}
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, rider)
}

// ---------------------------------------------------------------- availability + location

// activeOrders returns every ASSIGNED/ACCEPTED job for the signed-in rider, including the ordered
// multi-stop sequence, so the partner app can render one combined route.
func (h *Handler) activeOrders(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	orders, err := h.repo.ActiveOrders(r.Context(), rider.RiderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, orders)
}

type heartbeatRequest struct {
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	Available *bool    `json:"available"`
}

func (h *Handler) heartbeat(w http.ResponseWriter, r *http.Request) {
	var req heartbeatRequest
	if err := httpx.Decode(r, &req); err != nil || req.Latitude == nil || req.Longitude == nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "latitude and longitude are required")
		return
	}
	if *req.Latitude < -90 || *req.Latitude > 90 || *req.Longitude < -180 || *req.Longitude > 180 {
		httpx.Fail(w, http.StatusBadRequest, "invalid_coordinates", "coordinates are out of range")
		return
	}
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	hb := Heartbeat{RiderID: rider.RiderID, Latitude: *req.Latitude, Longitude: *req.Longitude, UpdatedAt: now}
	h.cache.SetJSON(r.Context(), cache.DeliveryRiderLocation(rider.RiderID), hb, cache.TTLDeliveryRiderLocation)
	// The mirror is best-effort; the cache write above is the dispatch source of truth.
	_ = h.repo.Heartbeat(r.Context(), rider.RiderID, *req.Latitude, *req.Longitude)
	w.WriteHeader(http.StatusNoContent)
}

type availabilityRequest struct {
	Available bool `json:"available"`
}

func (h *Handler) setAvailability(w http.ResponseWriter, r *http.Request) {
	var req availabilityRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid availability payload")
		return
	}
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if err := h.repo.SetAvailability(r.Context(), rider.RiderID, req.Available); err != nil {
		h.writeErr(w, err)
		return
	}
	if !req.Available {
		h.cache.Del(r.Context(), cache.DeliveryRiderLocation(rider.RiderID))
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"available": req.Available})
}

func (h *Handler) onlineRiders(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		StateCode:  strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state"))),
		OnlyOnline: true,
		Limit:      httpx.LimitParam(r, 100, 200),
	}
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		f.StateCode = auth.StateCode(r.Context())
	}
	riders, err := h.repo.List(r.Context(), f)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	out := make([]RiderLocation, 0, len(riders))
	for _, rider := range riders {
		var hb Heartbeat
		if !h.cache.GetJSON(r.Context(), cache.DeliveryRiderLocation(rider.RiderID), &hb) {
			continue
		}
		out = append(out, RiderLocation{Rider: rider, Lat: hb.Latitude, Lng: hb.Longitude})
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) adminRiders(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		StateCode: strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state"))),
		Status:    strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status"))),
		Available: strings.EqualFold(r.URL.Query().Get("available"), "true"),
		Limit:     httpx.LimitParam(r, 100, 200),
	}
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		f.StateCode = auth.StateCode(r.Context())
	}
	if f.Status != "" && !validRiderStatus(f.Status) {
		httpx.Fail(w, http.StatusBadRequest, "invalid_status", "unknown rider status")
		return
	}
	riders, err := h.repo.List(r.Context(), f)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, riders)
}

func (h *Handler) adminLocation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rider, err := h.repo.RiderByID(r.Context(), id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !canActForState(r.Context(), rider.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "rider not found")
		return
	}
	var hb Heartbeat
	if h.cache.GetJSON(r.Context(), cache.DeliveryRiderLocation(id), &hb) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"riderId": id, "latitude": hb.Latitude, "longitude": hb.Longitude,
			"updatedAt": hb.UpdatedAt, "source": "valkey",
		})
		return
	}
	lat, lng, seen, ok := h.repo.HeartbeatLocation(r.Context(), id)
	if !ok {
		httpx.JSON(w, http.StatusOK, map[string]any{"riderId": id, "source": "none"})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"riderId": id, "latitude": lat, "longitude": lng, "updatedAt": seen, "source": "mirror",
	})
}

// ---------------------------------------------------------------- dispatch + execution

type dispatchRequest struct {
	CustomerOrderID   string   `json:"customerOrderId"`
	StoreID           string   `json:"storeId"`
	StoreLabel        string   `json:"storeLabel"`
	StoreAddress      string   `json:"storeAddress"`
	StoreLatitude     *float64 `json:"storeLatitude"`
	StoreLongitude    *float64 `json:"storeLongitude"`
	CustomerName      string   `json:"customerName"`
	CustomerPhone     string   `json:"customerPhone"`
	CustomerAddress   string   `json:"customerAddress"`
	DropLatitude      *float64 `json:"dropLatitude"`
	DropLongitude     *float64 `json:"dropLongitude"`
	RequireOTP        bool     `json:"requireOtp"`
	PayoutAmountPaisa int64    `json:"payoutAmountPaisa"`
}

// candidateRiders returns ACTIVE/online/under-capacity riders in the scope with a fresh Valkey
// coordinate, excluding riders who have already declined this job.
func (h *Handler) candidateRiders(ctx context.Context, stateCode string, excluded map[string]bool) ([]RiderLocation, error) {
	f := ListFilter{OnlyOnline: true, Limit: 200, StateCode: stateCode}
	riders, err := h.repo.List(ctx, f)
	if err != nil {
		return nil, err
	}
	candidates := make([]RiderLocation, 0, len(riders))
	for _, rider := range riders {
		if excluded[rider.RiderID] {
			continue
		}
		var hb Heartbeat
		if !h.cache.GetJSON(ctx, cache.DeliveryRiderLocation(rider.RiderID), &hb) {
			continue
		}
		candidates = append(candidates, RiderLocation{Rider: rider, Lat: hb.Latitude, Lng: hb.Longitude})
	}
	return candidates, nil
}

func (h *Handler) assign(w http.ResponseWriter, r *http.Request) {
	var req dispatchRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid dispatch payload")
		return
	}
	if strings.TrimSpace(req.CustomerOrderID) == "" || strings.TrimSpace(req.StoreID) == "" ||
		req.StoreLatitude == nil || req.StoreLongitude == nil || req.DropLatitude == nil || req.DropLongitude == nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_dispatch", "order, store and coordinates are required")
		return
	}
	stateCode := ""
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		stateCode = auth.StateCode(r.Context())
	}
	created, otp, assigned, err := h.dispatch(r.Context(), req, stateCode)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !assigned {
		httpx.Fail(w, http.StatusServiceUnavailable, "no_rider_available", "no rider is currently available")
		return
	}
	resp := map[string]any{"order": created}
	if otp != "" {
		// Internal-only: the checkout context delivers this to the customer. Never logged.
		resp["customerOtp"] = otp
	}
	httpx.JSON(w, http.StatusCreated, resp)
}

// DispatchOrder is the internal order-ready entry used by checkout. It is idempotent per customer
// order (a repeated PACKED transition never double-assigns) and best-effort: assigned=false means
// no eligible rider, never an error.
func (h *Handler) DispatchOrder(ctx context.Context, req contracts.DeliveryDispatchRequest) (bool, error) {
	if strings.TrimSpace(req.CustomerOrderID) == "" || strings.TrimSpace(req.StoreID) == "" {
		return false, fmt.Errorf("%w: customer order and store are required", ErrConflict)
	}
	existing, err := h.repo.HasCustomerOrder(ctx, req.CustomerOrderID)
	if err != nil {
		return false, err
	}
	if existing {
		return true, nil
	}
	storeLat, storeLng := req.StoreLatitude, req.StoreLongitude
	dropLat, dropLng := req.DropLatitude, req.DropLongitude
	_, _, assigned, err := h.dispatch(ctx, dispatchRequest{
		CustomerOrderID:   req.CustomerOrderID,
		StoreID:           req.StoreID,
		StoreLabel:        req.StoreName,
		StoreAddress:      req.StoreAddress,
		StoreLatitude:     &storeLat,
		StoreLongitude:    &storeLng,
		CustomerName:      req.CustomerName,
		CustomerPhone:     req.CustomerPhone,
		CustomerAddress:   req.CustomerAddress,
		DropLatitude:      &dropLat,
		DropLongitude:     &dropLng,
		RequireOTP:        req.RequireOTP,
		PayoutAmountPaisa: req.PayoutAmountPaisa,
	}, req.StateCode)
	if err != nil {
		return false, err
	}
	return assigned, nil
}

// dispatch picks the best candidate and creates the job + stops. It is shared by the admin assign
// endpoint and checkout auto-dispatch; stateCode scopes candidate riders.
func (h *Handler) dispatch(ctx context.Context, req dispatchRequest, stateCode string) (Order, string, bool, error) {
	candidates, err := h.candidateRiders(ctx, stateCode, nil)
	if err != nil {
		return Order{}, "", false, err
	}
	best := PickRider(candidates, *req.StoreLatitude, *req.StoreLongitude, h.matrix)
	if best == nil {
		return Order{}, "", false, nil
	}

	orderID := "dlv-" + shortID()
	pickupID := "stop-" + shortID()
	dropID := "stop-" + shortID()
	route, _ := json.Marshal([]string{pickupID, dropID})
	dropSeconds, dropMeters := h.matrix.Travel(*req.StoreLatitude, *req.StoreLongitude, *req.DropLatitude, *req.DropLongitude)
	approachSeconds, approachMeters := h.matrix.Travel(best.Lat, best.Lng, *req.StoreLatitude, *req.StoreLongitude)
	totalMeters := dropMeters + approachMeters
	etaSeconds := dropSeconds + approachSeconds
	expires := time.Now().Add(45 * time.Second)
	order := Order{
		OrderID: orderID, CustomerOrderID: req.CustomerOrderID, StoreID: req.StoreID,
		RiderID: best.Rider.RiderID, Status: OrderAssigned, RouteSequence: route,
		TotalDistanceMeters: totalMeters, EstimatedDurationSecs: etaSeconds,
		PayoutAmountPaisa: req.PayoutAmountPaisa, RequireOTP: req.RequireOTP,
	}
	stops := []Stop{
		{StopID: pickupID, Sequence: 1, StopType: "PICKUP", Label: req.StoreLabel, Address: req.StoreAddress,
			Latitude: req.StoreLatitude, Longitude: req.StoreLongitude},
		{StopID: dropID, Sequence: 2, StopType: "DROP", Label: req.CustomerName, Address: req.CustomerAddress,
			Latitude: req.DropLatitude, Longitude: req.DropLongitude, CustomerName: req.CustomerName,
			CustomerPhone: req.CustomerPhone},
	}
	var otp string
	var otpHash string
	var otpExpires *time.Time
	if req.RequireOTP {
		otp = newOTP()
		otpHash = hashOTP(otp, dropID)
		exp := time.Now().Add(10 * time.Minute)
		otpExpires = &exp
	}
	created, err := h.repo.CreateOrder(ctx, order, stops, otpHash, otpExpires, expires)
	if err != nil {
		return Order{}, "", false, err
	}
	h.auditEvent(ctx, "DELIVERY_BOY_ASSIGN", created.OrderID, nil, map[string]any{
		"riderId": best.Rider.RiderID, "customerOrderId": req.CustomerOrderID,
	})
	h.notifyRider(ctx, best.Rider, created)
	return created, otp, true, nil
}

func (h *Handler) acceptOrder(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !rider.IsAvailable {
		httpx.Fail(w, http.StatusConflict, "not_available", "go online before accepting an order")
		return
	}
	order, err := h.repo.AcceptOrder(r.Context(), rider.RiderID, chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_BOY_ACCEPT", order.OrderID, nil, map[string]any{"riderId": rider.RiderID})
	httpx.JSON(w, http.StatusOK, order)
}

// dispatchLegs returns the pickup/drop coordinates of a released job.
func dispatchLegs(order Order) (pickup, drop *Stop, ok bool) {
	for i := range order.Stops {
		s := &order.Stops[i]
		if s.StopType == "PICKUP" && pickup == nil {
			pickup = s
		}
		if s.StopType == "DROP" && drop == nil {
			drop = s
		}
	}
	if pickup == nil || drop == nil ||
		pickup.Latitude == nil || pickup.Longitude == nil ||
		drop.Latitude == nil || drop.Longitude == nil {
		return nil, nil, false
	}
	return pickup, drop, true
}

func (h *Handler) rejectOrder(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	id := chi.URLParam(r, "orderId")
	order, err := h.repo.RejectOrder(r.Context(), rider.RiderID, id)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_BOY_REJECT_ORDER", id, nil, map[string]any{
		"riderId": rider.RiderID, "attempt": order.DispatchAttempts,
	})

	reassigned, err := h.retryReleasedOrder(r.Context(), order, rider.StateCode)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"reassigned": reassigned,
		"exhausted":  !reassigned && order.DispatchAttempts >= h.maxDispatchAttempts,
	})
}

// retryReleasedOrder re-scores the remaining candidates for a released job and re-offers it. It
// leaves the order REJECTED when the attempt cap is reached or no eligible rider remains.
func (h *Handler) retryReleasedOrder(ctx context.Context, order Order, stateCode string) (bool, error) {
	if order.DispatchAttempts >= h.maxDispatchAttempts {
		return false, nil
	}
	excluded := map[string]bool{}
	for _, riderID := range order.ExcludedRiderIDs {
		excluded[riderID] = true
	}
	pickup, drop, ok := dispatchLegs(order)
	if !ok {
		return false, nil
	}
	candidates, err := h.candidateRiders(ctx, stateCode, excluded)
	if err != nil {
		return false, err
	}
	next := PickRider(candidates, *pickup.Latitude, *pickup.Longitude, h.matrix)
	if next == nil {
		return false, nil
	}
	approachSeconds, approachMeters := h.matrix.Travel(
		next.Lat, next.Lng, *pickup.Latitude, *pickup.Longitude,
	)
	dropSeconds, dropMeters := h.matrix.Travel(
		*pickup.Latitude, *pickup.Longitude, *drop.Latitude, *drop.Longitude,
	)
	updated, err := h.repo.ReassignOrder(
		ctx, order.OrderID, next.Rider.RiderID,
		time.Now().Add(45*time.Second),
		approachMeters+dropMeters, approachSeconds+dropSeconds,
	)
	if err != nil {
		return false, err
	}
	h.auditEvent(ctx, "DELIVERY_BOY_REASSIGN", updated.OrderID, nil, map[string]any{
		"riderId": next.Rider.RiderID, "attempt": updated.DispatchAttempts,
	})
	h.notifyRider(ctx, next.Rider, updated)
	return true, nil
}

// ExpireOffers releases ASSIGNED jobs whose 45 s accept window elapsed and re-offers them to the
// next candidate. It is safe to run on multiple gateway instances: the conditional reject makes
// exactly one worker win a given order, and an accepted order is never touched.
func (h *Handler) ExpireOffers(ctx context.Context) (int, error) {
	ids, err := h.repo.ExpiredAssignments(ctx, 25)
	if err != nil {
		return 0, err
	}
	expired := 0
	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return expired, err
		}
		order, err := h.repo.OrderByID(ctx, id)
		if err != nil || order.Status != OrderAssigned {
			continue
		}
		origin, err := h.repo.RiderByID(ctx, order.RiderID)
		if err != nil {
			continue
		}
		released, err := h.repo.RejectOrder(ctx, order.RiderID, id)
		if err != nil {
			continue
		}
		expired++
		h.auditEvent(ctx, "DELIVERY_BOY_OFFER_EXPIRED", id, nil, map[string]any{
			"riderId": order.RiderID, "attempt": released.DispatchAttempts,
		})
		if _, err := h.retryReleasedOrder(ctx, released, origin.StateCode); err != nil {
			slog.Warn("delivery: expired offer reassign failed", "order", id, "err", err)
		}
	}
	return expired, nil
}

// RunExpiry sweeps elapsed offers until ctx is cancelled. Started by the composition root when a
// database is configured.
func (h *Handler) RunExpiry(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := h.ExpireOffers(ctx)
			if err != nil {
				slog.Warn("delivery: offer expiry sweep failed", "err", err)
			} else if n > 0 {
				slog.Info("delivery: expired offers re-offered", "count", n)
			}
		}
	}
}

type stopStatusRequest struct {
	Status        string `json:"status"`
	FailureReason string `json:"failureReason"`
}

func (h *Handler) updateStop(w http.ResponseWriter, r *http.Request) {
	var req stopStatusRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid stop status payload")
		return
	}
	status := strings.ToUpper(strings.TrimSpace(req.Status))
	switch status {
	case StopAtPickup, StopPickedUp, StopAtCustomer, StopDelivered, StopFailed:
	default:
		httpx.Fail(w, http.StatusBadRequest, "invalid_status", "unknown stop status")
		return
	}
	req.FailureReason = strings.TrimSpace(req.FailureReason)
	if status == StopFailed && len(req.FailureReason) < 3 {
		httpx.Fail(w, http.StatusBadRequest, "reason_required", "a failure reason is required")
		return
	}
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if status == StopDelivered {
		_, hash, _, err := h.repo.OTPTarget(r.Context(), rider.RiderID, chi.URLParam(r, "stopId"))
		if err != nil {
			h.writeErr(w, err)
			return
		}
		if hash != "" {
			httpx.Fail(w, http.StatusConflict, "otp_required", "verify the customer OTP to complete this stop")
			return
		}
	}
	order, err := h.repo.UpdateStop(r.Context(), rider.RiderID, chi.URLParam(r, "stopId"), status, req.FailureReason)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	action := "DELIVERY_BOY_STOP_" + status
	if status == StopDelivered {
		action = "DELIVERY_BOY_DELIVERED"
	}
	if status == StopPickedUp {
		action = "DELIVERY_BOY_PICKUP"
	}
	h.auditEvent(r.Context(), action, order.OrderID, nil, map[string]any{"stopId": chi.URLParam(r, "stopId")})
	httpx.JSON(w, http.StatusOK, order)
}

func (h *Handler) getRoute(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	order, err := h.repo.Route(r.Context(), rider.RiderID, chi.URLParam(r, "deliveryId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, order)
}

type otpRequest struct {
	StopID string `json:"stopId"`
	OTP    string `json:"otp"`
}

func (h *Handler) verifyOTP(w http.ResponseWriter, r *http.Request) {
	var req otpRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_body", "invalid OTP payload")
		return
	}
	if len(digitsOnly(req.OTP)) != 4 || strings.TrimSpace(req.StopID) == "" {
		httpx.Fail(w, http.StatusBadRequest, "invalid_otp", "a 4-digit OTP and stop id are required")
		return
	}
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	_, hash, expires, err := h.repo.OTPTarget(r.Context(), rider.RiderID, req.StopID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if hash == "" {
		httpx.Fail(w, http.StatusConflict, "otp_not_required", "this stop does not require an OTP")
		return
	}
	if expires == nil || time.Now().After(*expires) {
		httpx.Fail(w, http.StatusConflict, "otp_expired", "the OTP has expired")
		return
	}
	allowed, err := h.repo.ConsumeOTPAttempt(r.Context(), rider.RiderID, req.StopID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !allowed {
		httpx.Fail(w, http.StatusTooManyRequests, "otp_locked", "too many incorrect OTP attempts")
		return
	}
	want := hashOTP(digitsOnly(req.OTP), req.StopID)
	if subtle.ConstantTimeCompare([]byte(hash), []byte(want)) != 1 {
		httpx.Fail(w, http.StatusUnauthorized, "otp_incorrect", "incorrect OTP")
		return
	}
	order, err := h.repo.UpdateStop(r.Context(), rider.RiderID, req.StopID, StopDelivered, "")
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_BOY_DELIVERED", order.OrderID, nil, map[string]any{"stopId": req.StopID, "otp": true})
	httpx.JSON(w, http.StatusOK, order)
}

type ratingRequest struct {
	Rating  int    `json:"rating"`
	Comment string `json:"comment"`
}

func (h *Handler) rate(w http.ResponseWriter, r *http.Request) {
	var req ratingRequest
	if err := httpx.Decode(r, &req); err != nil || req.Rating < 1 || req.Rating > 5 {
		httpx.Fail(w, http.StatusBadRequest, "invalid_rating", "rating must be between 1 and 5")
		return
	}
	orderID := chi.URLParam(r, "orderId")
	riderID, customerOrderID, status, err := h.repo.OrderForRating(r.Context(), orderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if status != OrderRouteComplete {
		httpx.Fail(w, http.StatusConflict, "not_completed", "only a completed delivery can be rated")
		return
	}
	userID := auth.UserID(r.Context())
	if h.orders != nil {
		owned, oerr := h.orders.OrderOwnedBy(r.Context(), customerOrderID, userID)
		if oerr != nil {
			httpx.Fail(w, http.StatusInternalServerError, "delivery_unavailable", "delivery service unavailable")
			return
		}
		if !owned {
			httpx.Fail(w, http.StatusForbidden, "not_order_owner", "only the customer can rate this delivery")
			return
		}
	}
	if err := h.repo.Rate(r.Context(), orderID, riderID, userID, req.Rating, req.Comment); err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true})
}

// ---------------------------------------------------------------- helpers

func (h *Handler) currentRider(ctx context.Context) (Rider, error) {
	phone, ok := NormalizePhone(auth.Phone(ctx))
	if !ok {
		return Rider{}, fmt.Errorf("%w: a verified phone is required", ErrConflict)
	}
	rider, err := h.repo.RiderByPhone(ctx, phone)
	if errors.Is(err, ErrNotFound) {
		return Rider{}, fmt.Errorf("%w: no rider application for this phone", ErrNotFound)
	}
	if err != nil {
		return Rider{}, err
	}
	if rider.Status != StatusActive {
		return Rider{}, fmt.Errorf("%w: rider is not active", ErrConflict)
	}
	return rider, nil
}

func canActForState(ctx context.Context, state string) bool {
	switch auth.Role(ctx) {
	case auth.RoleSuperAdmin:
		return true
	case auth.RoleStateAdmin:
		return auth.StateCode(ctx) != "" && auth.StateCode(ctx) == strings.ToUpper(state)
	default:
		return false
	}
}

// notifyRider enqueues the durable order-ping into the shared notifications outbox (FCM/webhook
// drain is owned by internal/notifications). The payload is PII-free: only the job id and TTL.
func (h *Handler) notifyRider(ctx context.Context, rider Rider, order Order) {
	if h.notifier == nil || rider.UserID == "" {
		return
	}
	ttl := 45
	_ = h.notifier.Enqueue(ctx, rider.UserID, "delivery_assigned",
		"New delivery assigned",
		"Open Faazio Delivery Partner to accept before the offer expires.",
		map[string]any{"orderId": order.OrderID, "acceptSeconds": ttl, "stops": len(order.Stops)})
}

func (h *Handler) auditEvent(ctx context.Context, action, entityID string, before, after any) {
	if h.audit == nil {
		return
	}
	b, _ := json.Marshal(before)
	a, _ := json.Marshal(after)
	_ = h.audit.Audit(ctx, contracts.AuditEntry{
		ActorID:   auth.UserID(ctx),
		ActorRole: auth.Role(ctx),
		Action:    action,
		Entity:    "delivery.delivery_boys",
		EntityID:  entityID,
		Before:    b,
		After:     a,
	})
}

func (h *Handler) writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Fail(w, http.StatusNotFound, "not_found", "not found")
	case errors.Is(err, ErrConflict):
		httpx.Fail(w, http.StatusConflict, "conflict", err.Error())
	default:
		httpx.Fail(w, http.StatusInternalServerError, "delivery_unavailable", "delivery service unavailable")
	}
}

func newOTP() string {
	n, err := rand.Int(rand.Reader, big.NewInt(10000))
	if err != nil {
		return "0000"
	}
	return fmt.Sprintf("%04d", n.Int64())
}

func hashOTP(otp, stopID string) string {
	sum := sha256.Sum256([]byte(otp + ":" + stopID))
	return fmt.Sprintf("%x", sum[:])
}
