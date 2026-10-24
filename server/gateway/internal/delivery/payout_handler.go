package delivery

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// riderPayout returns (and persists) the distance + surge breakdown for one of the rider's jobs.
func (h *Handler) riderPayout(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if _, err := h.repo.orderByID(r.Context(), rider.RiderID, chi.URLParam(r, "orderId")); err != nil {
		h.writeErr(w, err)
		return
	}
	p, err := h.calculatePayout(r, chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

// riderPayouts lists the rider's recent payouts (earnings).
func (h *Handler) riderPayouts(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.repo.PayoutsByRider(r.Context(), rider.RiderID, limit)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// settlePayout records a manual "Mark Paid" for one completed delivery. District admins may only
// settle orders in their own district; the rider never settles their own money.
func (h *Handler) settlePayout(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderId")
	order, err := h.authorizedOrder(r, orderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	// Refuse before calculating so an incomplete delivery never leaves a stray PENDING payout row.
	if order.Status != OrderRouteComplete {
		httpx.Fail(w, http.StatusConflict, "not_completed",
			"only a completed delivery can be paid")
		return
	}
	if _, err := h.calculatePayout(r, orderID); err != nil {
		h.writeErr(w, err)
		return
	}
	p, ok, err := h.repo.SettleOrderPayout(r.Context(), orderID, auth.UserID(r.Context()))
	if errors.Is(err, ErrManualFareRequired) {
		httpx.Fail(w, http.StatusConflict, "manual_fare_required",
			"record the travelled distance and fare before marking this manual payout paid")
		return
	}
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "not_pending", "payout is not pending")
		return
	}
	action := "DELIVERY_PAYOUT_SETTLE"
	if order.PayoutMode == PayoutManual {
		action = "DELIVERY_MANUAL_PAYOUT_PAID"
	}
	h.auditOrderEvent(r.Context(), action, orderID, nil, p)
	httpx.JSON(w, http.StatusOK, p)
}

// payoutSettings reads the rider rate card (state/super admin).
func (h *Handler) payoutSettings(w http.ResponseWriter, r *http.Request) {
	s, err := h.repo.PayoutSettings(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}

// updatePayoutSettings writes the rider rate card (super admin only).
func (h *Handler) updatePayoutSettings(w http.ResponseWriter, r *http.Request) {
	var req PayoutSettings
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if req.BaseRatePaisa < 0 || req.BaseDistanceKm <= 0 || req.PerExtraKmPaisa < 0 ||
		req.NightSurgePaisa < 0 || req.WeatherSurgePaisa < 0 || req.FestivalSurgePaisa < 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "rate card values are out of range")
		return
	}
	if err := h.repo.UpdatePayoutSettings(r.Context(), req, auth.UserID(r.Context())); err != nil {
		h.writeErr(w, err)
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_PAYOUT_SETTINGS", "rate-card", nil, req)
	httpx.JSON(w, http.StatusOK, req)
}

// calculatePayout derives and persists the breakdown for an order (no ownership check: callers have
// already authorized the order).
func (h *Handler) calculatePayout(r *http.Request, orderID string) (RiderPayout, error) {
	order, err := h.repo.OrderByID(r.Context(), orderID)
	if err != nil {
		return RiderPayout{}, err
	}
	settings, err := h.repo.PayoutSettings(r.Context())
	if err != nil {
		return RiderPayout{}, err
	}
	at := time.Now()
	if order.AssignedAt != "" {
		if parsed, err := time.Parse(time.RFC3339, order.AssignedAt); err == nil {
			at = parsed
		}
	}
	queryWeather := truthy(r.URL.Query().Get("weather"))
	queryFestival := truthy(r.URL.Query().Get("festival"))

	// Default to the customer-paid surges recorded on the checkout order, so the rider payout can
	// never diverge from the bill. Query params stay as an explicit admin test override; legacy
	// orders with no stored basis fall back to the old clock/payout-card derivation.
	storedMeters, storedSurge, storedReason, hasBasis, err := h.repo.StoredDeliveryBasis(r.Context(), order.CustomerOrderID)
	if err != nil {
		return RiderPayout{}, err
	}

	// MANUAL orders are settled with the admin-recorded distance + fare. Until the admin records
	// them, show the rate-card preview so the rider still sees an expected amount.
	if order.PayoutMode == PayoutManual {
		meters := order.TotalDistanceMeters
		if hasBasis && !queryWeather && !queryFestival {
			meters = storedMeters
		}
		preview := ComputeRiderPayoutWithSurge(order.OrderID, order.RiderID, meters,
			settings, storedSurge, storedReason)
		manualKm := order.ManualDistanceKm
		if manualKm != nil {
			preview = ComputeRiderPayoutWithSurge(order.OrderID, order.RiderID,
				int64(math.Round(*manualKm*1000)), settings, storedSurge, storedReason)
		}
		total := preview.TotalPaisa
		if order.ManualFarePaisa != nil {
			total = *order.ManualFarePaisa
		}
		calculated := preview.TotalPaisa
		return h.repo.UpsertPayout(r.Context(), RiderPayout{
			OrderID: order.OrderID, RiderID: order.RiderID, DistanceKm: preview.DistanceKm,
			BaseRatePaisa: preview.BaseRatePaisa, ExtraKmChargePaisa: preview.ExtraKmChargePaisa,
			SurgePaisa: preview.SurgePaisa, SurgeReason: preview.SurgeReason,
			TotalPaisa: total, PayoutMode: PayoutManual, ManualDistanceKm: manualKm,
			ManualFarePaisa: order.ManualFarePaisa, CalculatedFarePaisa: &calculated,
			FareOverrideReason: order.FareOverrideReason, Status: "PENDING",
		})
	}

	var p RiderPayout
	if hasBasis && !queryWeather && !queryFestival {
		// Use exactly the distance the customer was billed on, so the ₹5 base margin and the per-km
		// pass-through hold (road-distance differences never create a divergence). A zero stored
		// distance is meaningful (e.g. a delivery placed without a live fix, billed at base only),
		// so never substitute the route distance for a stored basis.
		p = ComputeRiderPayoutWithSurge(order.OrderID, order.RiderID, storedMeters,
			settings, storedSurge, storedReason)
	} else {
		surge := SurgeInput{Weather: queryWeather, Festival: queryFestival, At: at}
		p = ComputeRiderPayout(order.OrderID, order.RiderID, order.TotalDistanceMeters, settings, surge)
	}
	if order.CalculatedFarePaisa != nil {
		p.CalculatedFarePaisa = order.CalculatedFarePaisa
	}
	return h.repo.UpsertPayout(r.Context(), p)
}

// SurgeSettings implements contracts.SurgeReader: checkout reads the rider card so the customer
// bill and rider payout share one authoritative surge rate card.
func (h *Handler) SurgeSettings(ctx context.Context) (contracts.SurgeRates, error) {
	s, err := h.repo.PayoutSettings(ctx)
	if err != nil {
		return contracts.SurgeRates{}, err
	}
	return contracts.SurgeRates{
		NightPaisa: s.NightSurgePaisa, WeatherPaisa: s.WeatherSurgePaisa, FestivalPaisa: s.FestivalSurgePaisa,
	}, nil
}

func truthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes":
		return true
	}
	return false
}
