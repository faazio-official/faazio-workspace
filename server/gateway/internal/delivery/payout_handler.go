package delivery

import (
	"net/http"
	"strconv"
	"strings"
	"time"

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

// settlePayout marks a rider payout PAID. Super-admin only: the rider never settles their own money.
func (h *Handler) settlePayout(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderId")
	if _, ok, err := h.repo.PayoutByOrder(r.Context(), orderID); err != nil {
		h.writeErr(w, err)
		return
	} else if !ok {
		if _, err := h.calculatePayout(r, orderID); err != nil {
			h.writeErr(w, err)
			return
		}
	}
	p, ok, err := h.repo.SettlePayout(r.Context(), orderID, auth.UserID(r.Context()))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "not_pending", "payout is not pending")
		return
	}
	h.auditEvent(r.Context(), "DELIVERY_PAYOUT_SETTLE", p.PayoutID, nil, p)
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
	surge := SurgeInput{
		Weather:  truthy(r.URL.Query().Get("weather")),
		Festival: truthy(r.URL.Query().Get("festival")),
		At:       at,
	}
	p := ComputeRiderPayout(order.OrderID, order.RiderID, order.TotalDistanceMeters, settings, surge)
	return h.repo.UpsertPayout(r.Context(), p)
}

func truthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes":
		return true
	}
	return false
}
