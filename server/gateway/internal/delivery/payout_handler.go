package delivery

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

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
	// Self-heal historical completed jobs that predate completion-time payout materialisation, so the
	// earnings ledger never silently omits a finished delivery. Idempotent and bounded.
	h.healCompletedPayouts(r, rider.RiderID)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.repo.PayoutsByRider(r.Context(), rider.RiderID, limit)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type payoutSummaryResponse struct {
	PendingPaisa int64 `json:"pendingPaisa"`
	PaidPaisa    int64 `json:"paidPaisa"`
}

// riderPayoutSummary returns the rider's lifetime pending/paid totals for the KPI strip, so the
// totals are not limited to the rows on the current list page.
func (h *Handler) riderPayoutSummary(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.healCompletedPayouts(r, rider.RiderID)
	pending, paid, err := h.repo.PayoutSummary(r.Context(), rider.RiderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, payoutSummaryResponse{PendingPaisa: pending, PaidPaisa: paid})
}

// healCompletedPayouts materialises payout rows for completed jobs that predate completion-time
// materialisation. Idempotent and bounded; best-effort so a list still loads if healing fails.
func (h *Handler) healCompletedPayouts(r *http.Request, riderID string) {
	ids, err := h.repo.CompletedOrdersMissingPayout(r.Context(), riderID, 100)
	if err != nil {
		return
	}
	for _, orderID := range ids {
		if _, err := h.calculatePayout(r, orderID); err != nil {
			return
		}
	}
}

// settlePayout records a manual "Mark Paid" for one completed delivery. District admins may only
// settle orders in their own district; the rider never settles their own money. An optional
// amountPaisa may be typed by the admin — a smaller amount leaves a balance that carries forward.
func (h *Handler) settlePayout(w http.ResponseWriter, r *http.Request) {
	var req payoutSettleRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
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
	calculated, err := h.calculatePayout(r, orderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	amount := req.AmountPaisa
	if amount <= 0 {
		amount = calculated.TotalPaisa
	}
	p, ok, err := h.repo.MarkDeliveryPayoutPaid(r.Context(), orderID, amount, auth.UserID(r.Context()))
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
		httpx.Fail(w, http.StatusConflict, "already_paid", "payout is already fully paid")
		return
	}
	action := "DELIVERY_PAYOUT_SETTLE"
	if order.PayoutMode == PayoutManual {
		action = "DELIVERY_MANUAL_PAYOUT_PAID"
	}
	h.auditOrderEvent(r.Context(), action, orderID, nil, p)
	httpx.JSON(w, http.StatusOK, p)
}

// markDeliveryPayoutPaid is the canonical manual payout route ("Mark as Paid" with a typed amount).
func (h *Handler) markDeliveryPayoutPaid(w http.ResponseWriter, r *http.Request) {
	var req payoutSettleRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if req.AmountPaisa <= 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "amountPaisa is required")
		return
	}
	orderID := chi.URLParam(r, "orderId")
	order, err := h.authorizedOrder(r, orderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if order.Status != OrderRouteComplete {
		httpx.Fail(w, http.StatusConflict, "not_completed", "only a completed delivery can be paid")
		return
	}
	if _, err := h.calculatePayout(r, orderID); err != nil {
		h.writeErr(w, err)
		return
	}
	p, ok, err := h.repo.MarkDeliveryPayoutPaid(r.Context(), orderID, req.AmountPaisa, auth.UserID(r.Context()))
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
		httpx.Fail(w, http.StatusConflict, "already_paid", "payout is already fully paid")
		return
	}
	h.auditOrderEvent(r.Context(), "DELIVERY_MANUAL_PAYOUT_PAID", orderID, nil, p)
	httpx.JSON(w, http.StatusOK, p)
}

type payoutSettleRequest struct {
	AmountPaisa int64 `json:"amountPaisa"`
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
	queryWeather := truthy(r.URL.Query().Get("weather"))
	queryFestival := truthy(r.URL.Query().Get("festival"))

	// Default to the customer-paid surges recorded on the checkout order, so the rider payout can
	// never diverge from the bill. Query params stay as an explicit admin test override; legacy
	// orders with no stored basis fall back to the old clock/payout-card derivation.
	storedMeters, storedSurge, storedReason, hasBasis, err := h.repo.StoredDeliveryBasis(r.Context(), order.CustomerOrderID)
	if err != nil {
		return RiderPayout{}, err
	}
	return h.repo.UpsertPayout(r.Context(),
		CalculatePayoutDetails(order, settings, storedMeters, storedSurge, storedReason, hasBasis, queryWeather, queryFestival))
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
