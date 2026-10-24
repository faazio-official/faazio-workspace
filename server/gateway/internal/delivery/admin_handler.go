package delivery

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

const manualFareMaxPaisa int64 = 10_000_000_00 // ₹1 crore guard for a single delivery fare

// adminOrders serves the district-scoped manual-allocation board. District admins are forced to
// their own district claim (legacy state admins fall back to their parent state); super admins may
// filter any district.
func (h *Handler) adminOrders(w http.ResponseWriter, r *http.Request) {
	district := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("district")))
	state := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if auth.Role(r.Context()) != auth.RoleSuperAdmin {
		district, state = adminScope(r)
	}
	// A district filter already implies the parent state; keeping both would over-constrain legacy
	// rows whose seller state is missing while their district is present.
	if district != "" {
		state = ""
	}
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	if status == "ALL" {
		status = ""
	}
	from := parseDateParam(r.URL.Query().Get("from"), false)
	to := parseDateParam(r.URL.Query().Get("to"), true)
	items, err := h.repo.AdminOrders(r.Context(), district, state, status,
		strings.TrimSpace(r.URL.Query().Get("storeId")), from, to,
		httpx.LimitParam(r, 100, 200))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) adminOrder(w http.ResponseWriter, r *http.Request) {
	o, err := h.repo.AdminOrderByID(r.Context(), chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !auth.CanActForDistrict(r.Context(), o.DistrictCode, o.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	// An order that was never allocated has no stored fare yet; show the rate-card preview so the
	// admin sees the amount before choosing AUTOMATED and confirming the allocation.
	if o.CalculatedFarePaisa == nil {
		fareMeters := h.dropDistanceMeters(r, o, o.DistanceMeters)
		if fare, err := h.previewFare(r, o.CustomerOrderID, fareMeters); err == nil {
			o.CalculatedFarePaisa = &fare
		}
	}
	httpx.JSON(w, http.StatusOK, o)
}

// adminOrderRiders lists eligible riders nearest-first by road distance from the store. Rider
// selection is deliberately not district-restricted: any active rider may serve the order.
func (h *Handler) adminOrderRiders(w http.ResponseWriter, r *http.Request) {
	o, err := h.repo.AdminOrderByID(r.Context(), chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !auth.CanActForDistrict(r.Context(), o.DistrictCode, o.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	includeOffline := strings.EqualFold(r.URL.Query().Get("includeOffline"), "true")
	excluded := map[string]bool{}
	if o.OrderID != "" {
		if job, err := h.repo.OrderByID(r.Context(), o.OrderID); err == nil {
			for _, id := range job.ExcludedRiderIDs {
				excluded[id] = true
			}
		}
	}
	riders, err := h.repo.List(r.Context(), ListFilter{
		Status: StatusActive, Available: true, Limit: 200,
	})
	if err != nil {
		h.writeErr(w, err)
		return
	}
	// current_load only rises on accept, so a rider already holding another unaccepted offer must not
	// appear as available here either (same rule as the auto-dispatch candidate picker).
	riderIDs := make([]string, 0, len(riders))
	for _, rider := range riders {
		riderIDs = append(riderIDs, rider.RiderID)
	}
	pending, err := h.repo.PendingOfferRiderIDs(r.Context(), riderIDs, o.OrderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	out := make([]RiderCandidate, 0, len(riders))
	for _, rider := range riders {
		if excluded[rider.RiderID] || pending[rider.RiderID] ||
			rider.MaxCapacity <= 0 || rider.CurrentLoad >= rider.MaxCapacity {
			continue
		}
		var hb Heartbeat
		online := h.cache.GetJSON(r.Context(), cache.DeliveryRiderLocation(rider.RiderID), &hb)
		if !online && !includeOffline {
			continue
		}
		// -1 means "distance unknown" (offline rider or missing store fix). A real 0 is a rider at
		// the store and must still sort nearest, so it cannot share the unknown sentinel.
		meters := int64(-1)
		if online && o.StoreLatitude != nil && o.StoreLongitude != nil {
			_, meters = h.matrix.Travel(hb.Latitude, hb.Longitude, *o.StoreLatitude, *o.StoreLongitude)
		}
		// The picker needs identity + availability only; home address and emergency contact are PII
		// with no allocation purpose, so never project them here.
		rider.Phone = maskPhone(rider.Phone)
		rider.Address = ""
		rider.EmergencyContact = ""
		out = append(out, RiderCandidate{Rider: rider, DistanceMeters: meters, Online: online})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Online != out[j].Online {
			return out[i].Online
		}
		di, dj := out[i].DistanceMeters, out[j].DistanceMeters
		if di < 0 {
			di = 1 << 62
		}
		if dj < 0 {
			dj = 1 << 62
		}
		if di == dj {
			return out[i].Rating > out[j].Rating
		}
		return di < dj
	})
	if limit := httpx.LimitParam(r, 50, 200); len(out) > limit {
		out = out[:limit]
	}
	httpx.JSON(w, http.StatusOK, out)
}

type allocateRequest struct {
	RiderID    string `json:"riderId"`
	PayoutMode string `json:"payoutMode"`
}

// allocateOrder is the mandatory manual assignment path: the admin picks the rider and the payout
// mode, and the gateway creates (or re-offers) the job with a fresh 45-second accept window.
func (h *Handler) allocateOrder(w http.ResponseWriter, r *http.Request) {
	var req allocateRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid allocation body")
		return
	}
	req.RiderID = strings.TrimSpace(req.RiderID)
	if req.RiderID == "" || !validPayoutMode(req.PayoutMode) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "riderId and payoutMode (AUTOMATED|MANUAL) are required")
		return
	}
	o, err := h.repo.AdminOrderByID(r.Context(), chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !auth.CanActForDistrict(r.Context(), o.DistrictCode, o.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	rider, err := h.repo.RiderByID(r.Context(), req.RiderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if rider.Status != StatusActive || !rider.IsAvailable || rider.CurrentLoad >= rider.MaxCapacity {
		httpx.Fail(w, http.StatusConflict, "rider_unavailable", "rider is not available for a new order")
		return
	}
	if pending, err := h.repo.PendingOfferRiderIDs(r.Context(), []string{rider.RiderID}, o.OrderID); err != nil {
		h.writeErr(w, err)
		return
	} else if pending[rider.RiderID] {
		httpx.Fail(w, http.StatusConflict, "rider_busy_offer", "rider already has an unaccepted order offer")
		return
	}
	if o.OrderID != "" {
		job, err := h.repo.OrderByID(r.Context(), o.OrderID)
		if err != nil {
			h.writeErr(w, err)
			return
		}
		for _, id := range job.ExcludedRiderIDs {
			if id == rider.RiderID {
				httpx.Fail(w, http.StatusConflict, "rider_declined", "this rider already declined the order")
				return
			}
		}
	}
	if o.StoreLatitude == nil || o.StoreLongitude == nil || o.DropLatitude == nil || o.DropLongitude == nil {
		httpx.Fail(w, http.StatusConflict, "missing_coordinates", "store and drop coordinates are required")
		return
	}
	dropSeconds, dropMeters := h.matrix.Travel(*o.StoreLatitude, *o.StoreLongitude, *o.DropLatitude, *o.DropLongitude)
	totalMeters, etaSeconds := dropMeters, dropSeconds
	var hb Heartbeat
	if h.cache.GetJSON(r.Context(), cache.DeliveryRiderLocation(rider.RiderID), &hb) {
		approachSeconds, approachMeters := h.matrix.Travel(hb.Latitude, hb.Longitude, *o.StoreLatitude, *o.StoreLongitude)
		totalMeters += approachMeters
		etaSeconds += approachSeconds
	}
	fareMeters := h.dropDistanceMeters(r, o, dropMeters)
	fare, err := h.previewFare(r, o.CustomerOrderID, fareMeters)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	expires := time.Now().Add(45 * time.Second)
	mode := payoutModeOrDefault(req.PayoutMode)

	var created Order
	if o.OrderID != "" {
		created, err = h.repo.ReallocateOrder(r.Context(), o.OrderID, rider.RiderID, mode,
			o.DistrictCode, fare, expires, totalMeters, etaSeconds)
	} else {
		orderID := "dlv-" + shortID()
		pickupID := "stop-" + shortID()
		dropID := "stop-" + shortID()
		pickup := Stop{
			StopID: pickupID, DeliveryOrderID: orderID, Sequence: 1, StopType: "PICKUP",
			Label: o.StoreName, Address: o.StoreAddress, Latitude: o.StoreLatitude, Longitude: o.StoreLongitude,
		}
		drop := Stop{
			StopID: dropID, DeliveryOrderID: orderID, Sequence: 2, StopType: "DROP",
			Label: o.CustomerName, Address: o.DropAddress, Latitude: o.DropLatitude, Longitude: o.DropLongitude,
			CustomerName: o.CustomerName, CustomerPhone: o.CustomerPhone,
		}
		route, _ := jsonRoute(pickupID, dropID)
		created, err = h.repo.CreateManualOrder(r.Context(), Order{
			OrderID: orderID, CustomerOrderID: o.CustomerOrderID, StoreID: o.StoreID,
			RiderID: rider.RiderID, Status: OrderAssigned, RouteSequence: route,
			TotalDistanceMeters: totalMeters, EstimatedDurationSecs: etaSeconds,
			PayoutAmountPaisa: fare,
			DistrictCode:      o.DistrictCode, PayoutMode: mode, CalculatedFarePaisa: &fare,
		}, []Stop{pickup, drop}, expires)
	}
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditOrderEvent(r.Context(), "DELIVERY_MANUAL_ALLOCATE", created.OrderID, nil, map[string]any{
		"riderId": rider.RiderID, "districtCode": o.DistrictCode, "payoutMode": mode,
		"calculatedFarePaisa": fare,
	})
	h.notifyRider(r.Context(), rider, created)
	httpx.JSON(w, http.StatusCreated, created)
}

type payoutModeRequest struct {
	PayoutMode string `json:"payoutMode"`
}

// updatePayoutMode changes the mode after allocation but before payment. Switching to AUTOMATED
// clears the manual fields and refreshes the rate-card preview.
func (h *Handler) updatePayoutMode(w http.ResponseWriter, r *http.Request) {
	var req payoutModeRequest
	if err := httpx.Decode(r, &req); err != nil || !validPayoutMode(req.PayoutMode) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "payoutMode (AUTOMATED|MANUAL) is required")
		return
	}
	order, err := h.authorizedOrder(r, chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if payout, ok, err := h.repo.PayoutByOrder(r.Context(), order.OrderID); err != nil {
		h.writeErr(w, err)
		return
	} else if ok && payout.Status == "PAID" {
		httpx.Fail(w, http.StatusConflict, "already_paid", "a paid payout cannot change mode")
		return
	}
	fareMeters := h.dropDistanceMetersForOrder(r, order)
	fare, err := h.previewFare(r, order.CustomerOrderID, fareMeters)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	mode := payoutModeOrDefault(req.PayoutMode)
	var manualKm *float64
	var manualFare *int64
	reason := ""
	if mode == PayoutManual {
		manualKm, manualFare, reason = order.ManualDistanceKm, order.ManualFarePaisa, order.FareOverrideReason
	}
	updated, err := h.repo.SetPayoutMode(r.Context(), order.OrderID, mode, fare,
		float64(fareMeters)/1000, manualKm, manualFare, reason)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditOrderEvent(r.Context(), "DELIVERY_PAYOUT_MODE_CHANGE", order.OrderID, order, updated)
	httpx.JSON(w, http.StatusOK, updated)
}

type manualFareRequest struct {
	DistanceKm float64 `json:"distanceKm"`
	FarePaisa  *int64  `json:"farePaisa"`
	Reason     string  `json:"reason"`
}

// recordManualFare stores the admin-travelled distance and fare override for a MANUAL order. The
// rate-card fare for that distance is kept as the audit snapshot.
func (h *Handler) recordManualFare(w http.ResponseWriter, r *http.Request) {
	var req manualFareRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid manual fare body")
		return
	}
	if req.DistanceKm <= 0 || req.DistanceKm > 99999 {
		httpx.Fail(w, http.StatusBadRequest, "bad_distance", "distanceKm must be greater than zero")
		return
	}
	if req.FarePaisa != nil && (*req.FarePaisa < 0 || *req.FarePaisa > manualFareMaxPaisa) {
		httpx.Fail(w, http.StatusBadRequest, "bad_fare", "farePaisa is out of range")
		return
	}
	if len(strings.TrimSpace(req.Reason)) > 500 {
		httpx.Fail(w, http.StatusBadRequest, "bad_reason", "reason must be 500 characters or fewer")
		return
	}
	order, err := h.authorizedOrder(r, chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if order.PayoutMode != PayoutManual {
		httpx.Fail(w, http.StatusConflict, "not_manual", "manual fare is only available for MANUAL orders")
		return
	}
	calculated, err := h.previewFare(r, order.CustomerOrderID, int64(math.Round(req.DistanceKm*1000)))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	fare := calculated
	if req.FarePaisa != nil {
		fare = *req.FarePaisa
	}
	updated, err := h.repo.SetManualFare(r.Context(), order.OrderID, req.DistanceKm, calculated, fare, strings.TrimSpace(req.Reason))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditOrderEvent(r.Context(), "DELIVERY_MANUAL_FARE", order.OrderID, order, updated)
	httpx.JSON(w, http.StatusOK, updated)
}

// adminPayouts serves the dual-mode settlement board, scoped to the caller's district.
func (h *Handler) adminPayouts(w http.ResponseWriter, r *http.Request) {
	district := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("district")))
	state := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if auth.Role(r.Context()) != auth.RoleSuperAdmin {
		district, state = adminScope(r)
	}
	if district != "" {
		state = ""
	}
	mode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("mode")))
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	if mode == "ALL" {
		mode = ""
	}
	if status == "ALL" {
		status = ""
	}
	items, err := h.repo.AdminPayouts(r.Context(), district, state, mode, status,
		strings.TrimSpace(r.URL.Query().Get("riderId")),
		parseDateParam(r.URL.Query().Get("from"), false),
		parseDateParam(r.URL.Query().Get("to"), true),
		httpx.LimitParam(r, 100, 200))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// ---------------------------------------------------------------- helpers

func adminScope(r *http.Request) (district, state string) {
	return auth.DistrictCode(r.Context()), auth.StateCode(r.Context())
}

func (h *Handler) authorizedOrder(r *http.Request, orderID string) (Order, error) {
	order, err := h.repo.OrderByID(r.Context(), orderID)
	if err != nil {
		return Order{}, err
	}
	district, state, err := h.repo.OrderScope(r.Context(), orderID)
	if err != nil {
		return Order{}, err
	}
	if !auth.CanActForDistrict(r.Context(), district, state) {
		return Order{}, ErrNotFound
	}
	return order, nil
}

func (h *Handler) dropDistanceMeters(r *http.Request, o AdminOrder, fallback int64) int64 {
	if meters, _, _, ok, err := h.repo.StoredDeliveryBasis(r.Context(), o.CustomerOrderID); err == nil && ok {
		return meters
	}
	return fallback
}

func (h *Handler) dropDistanceMetersForOrder(r *http.Request, o Order) int64 {
	if meters, _, _, ok, err := h.repo.StoredDeliveryBasis(r.Context(), o.CustomerOrderID); err == nil && ok {
		return meters
	}
	return o.TotalDistanceMeters
}

func (h *Handler) previewFare(r *http.Request, customerOrderID string, distanceMeters int64) (int64, error) {
	settings, err := h.repo.PayoutSettings(r.Context())
	if err != nil {
		return 0, err
	}
	_, surge, reason, hasBasis, err := h.repo.StoredDeliveryBasis(r.Context(), customerOrderID)
	if err != nil {
		return 0, err
	}
	if hasBasis {
		return ComputeRiderPayoutWithSurge("", "", distanceMeters, settings, surge, reason).TotalPaisa, nil
	}
	return ComputeRiderPayout("", "", distanceMeters, settings, SurgeInput{At: time.Now()}).TotalPaisa, nil
}

func (h *Handler) auditOrderEvent(ctx context.Context, action, entityID string, before, after any) {
	if h.audit == nil {
		return
	}
	b, _ := json.Marshal(before)
	a, _ := json.Marshal(after)
	_ = h.audit.Audit(ctx, contracts.AuditEntry{
		ActorID: auth.UserID(ctx), ActorRole: auth.Role(ctx), Action: action,
		Entity: "delivery.delivery_orders", EntityID: entityID, Before: b, After: a,
	})
}

func parseDateParam(raw string, endOfDay bool) *time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return &t
	}
	// Date-only filters are calendar days in IST (the business timezone), not UTC, so a "today"
	// filter does not silently drop the first 5.5 hours of the operator's day.
	ist := time.FixedZone("IST", 5*3600+1800)
	t, err := time.ParseInLocation("2006-01-02", raw, ist)
	if err != nil {
		return nil
	}
	if endOfDay {
		t = t.Add(24*time.Hour - time.Nanosecond)
	}
	return &t
}

func maskPhone(phone string) string {
	digits := make([]byte, 0, 12)
	for i := 0; i < len(phone); i++ {
		if phone[i] >= '0' && phone[i] <= '9' {
			digits = append(digits, phone[i])
		}
	}
	s := string(digits)
	if len(s) > 4 {
		return strings.Repeat("*", len(s)-4) + s[len(s)-4:]
	}
	return s
}

func jsonRoute(ids ...string) ([]byte, error) {
	return json.Marshal(ids)
}
