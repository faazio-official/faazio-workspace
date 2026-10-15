package bookings

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves booking endpoints: a public availability projection, auth-scoped holds, the
// seller decision/config surface, and the signature-verified Razorpay webhook.
type Handler struct {
	repo    *Repo
	service *Service
	cache   *cache.Cache
	audit   contracts.AuditWriter
}

// NewHandler builds the bookings handler.
func NewHandler(repo *Repo, service *Service, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, service: service, cache: c, audit: audit}
}

// Register mounts booking endpoints onto the shared router.
func (h *Handler) Register(r chi.Router) {
	// Public, seat-count-free availability projection (safe for anon edge cache).
	r.Get("/venues/{id}/booking-availability", h.availability)
	// Public webhook (authenticated by HMAC signature, not a session).
	r.Post("/webhooks/razorpay", h.webhook)

	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/bookings", h.list)
		g.Post("/bookings", h.create)
		g.Delete("/bookings/{id}", h.cancel)
		g.Post("/bookings/{id}/payment", h.attachPayment)
		g.Get("/food-bookings", h.listFood)
		g.Post("/food-bookings", h.createFood)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/booking-config", h.getConfig)
		g.Put("/seller/booking-config", h.putConfig)
		g.Get("/seller/bookings", h.sellerList)
		g.Put("/bookings/{id}/status", h.setStatus)
		g.Post("/bookings/{id}/vacate", h.vacate)
	})
}

// availability returns {bookable, feePerSeat, timingLabel, openNow} — never seats/totals.
func (h *Handler) availability(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cached contracts.BookingAvailability
	if h.cache.GetJSON(r.Context(), cache.BookingAvail(id), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	av, err := h.repo.Availability(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bookings_unavailable", "availability unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.BookingAvail(id), av, cache.TTLBookingAvail)
	httpx.JSON(w, http.StatusOK, av)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var body contracts.Booking
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if strings.TrimSpace(body.VendorID) == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vendorId required")
		return
	}
	b, err := h.service.Create(r.Context(), auth.UserID(r.Context()), body)
	switch {
	case errors.Is(err, ErrBookableClosed):
		httpx.Fail(w, http.StatusConflict, "not_bookable", "this restaurant is not accepting bookings right now")
	case errors.Is(err, ErrSeatsUnavailable):
		httpx.Fail(w, http.StatusConflict, "seats_unavailable", "not enough seats available")
	case errors.Is(err, ErrGatewayUnavailable):
		httpx.Fail(w, http.StatusBadGateway, "payment_unavailable", "payment could not be started")
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "booking_failed", "could not create booking")
	default:
		h.cache.Del(r.Context(), cache.Bookings(b.UserID))
		h.log(r, "bookings.tables", "BOOKING_CREATE", b.ID)
		httpx.JSON(w, http.StatusCreated, b)
	}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached []contracts.Booking
	if h.cache.GetJSON(r.Context(), cache.Bookings(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	items, err := h.repo.ByUser(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bookings_unavailable", "bookings unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.Bookings(userID), items, cache.TTLBookings)
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if _, err := h.service.CancelByUser(r.Context(), userID, chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "booking not found")
			return
		}
		if errors.Is(err, ErrGatewayUnavailable) {
			httpx.Fail(w, http.StatusBadGateway, "refund_failed", "refund could not be processed")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "cancel_failed", "could not cancel booking")
		return
	}
	h.cache.Del(r.Context(), cache.Bookings(userID))
	h.log(r, "bookings.tables", "BOOKING_CANCEL", chi.URLParam(r, "id"))
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) attachPayment(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RazorpayPaymentID string `json:"razorpayPaymentId"`
	}
	if err := httpx.Decode(r, &body); err != nil || strings.TrimSpace(body.RazorpayPaymentID) == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "razorpayPaymentId required")
		return
	}
	b, err := h.service.AttachPayment(r.Context(), auth.UserID(r.Context()), chi.URLParam(r, "id"), body.RazorpayPaymentID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "booking not found")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "booking_failed", "could not attach payment")
		return
	}
	h.cache.Del(r.Context(), cache.Bookings(b.UserID))
	httpx.JSON(w, http.StatusOK, b)
}

func (h *Handler) listFood(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached []contracts.FoodBooking
	if h.cache.GetJSON(r.Context(), cache.FoodBookings(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	items, err := h.repo.FoodByUser(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bookings_unavailable", "food bookings unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.FoodBookings(userID), items, cache.TTLBookings)
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) createFood(w http.ResponseWriter, r *http.Request) {
	var body contracts.FoodBooking
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.Date == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "date required")
		return
	}
	f, err := h.repo.CreateFood(r.Context(), auth.UserID(r.Context()), body)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "booking_failed", "could not create food booking")
		return
	}
	h.cache.Del(r.Context(), cache.FoodBookings(f.UserID))
	httpx.JSON(w, http.StatusCreated, f)
}

func (h *Handler) getConfig(w http.ResponseWriter, r *http.Request) {
	vendorID := strings.TrimSpace(r.URL.Query().Get("vendorId"))
	if vendorID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vendorId required")
		return
	}
	cfg, ok, err := h.repo.ConfigByVendor(r.Context(), vendorID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bookings_unavailable", "booking config unavailable")
		return
	}
	if !ok {
		httpx.JSON(w, http.StatusOK, contracts.BookingConfig{VendorID: vendorID, OpenTime: defaultOpenTime, CloseTime: defaultCloseTime})
		return
	}
	if !roleAdmin(r) && cfg.SellerID != auth.SellerID(r.Context()) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "booking config not found")
		return
	}
	httpx.JSON(w, http.StatusOK, cfg)
}

func (h *Handler) putConfig(w http.ResponseWriter, r *http.Request) {
	var body contracts.BookingConfig
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if strings.TrimSpace(body.VendorID) == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vendorId required")
		return
	}
	admin := roleAdmin(r)
	sellerID := auth.SellerID(r.Context())
	if !admin && sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	out, ok, err := h.service.UpsertConfig(r.Context(), body, sellerID, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "booking_config_failed", "could not save booking config")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "vendor is not owned by this seller")
		return
	}
	h.log(r, "bookings.venue_configs", "BOOKING_CONFIG_UPDATE", out.VendorID)
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) sellerList(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	status := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	items, err := h.repo.SellerBookings(r.Context(), sellerID, status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bookings_unavailable", "bookings unavailable")
		return
	}
	// The rows are already scoped server-side; echo the scope so a seller-scoped client can filter
	// without a second lookup (bookings.tables has no seller_id column — ownership is via the venue).
	if sellerID != "" {
		for i := range items {
			items[i].SellerID = sellerID
		}
	}
	httpx.JSON(w, http.StatusOK, items)
}

// setStatus is the seller decision: accept (capture) or reject (refund). `confirmed`/`cancelled`
// remain accepted as admin aliases.
func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	action := strings.ToLower(strings.TrimSpace(body.Status))
	switch action {
	case "accept", "confirmed":
		action = "accept"
	case "reject", "cancelled":
		action = "reject"
	default:
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "status must be accept or reject")
		return
	}
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	b, err := h.service.Decide(r.Context(), id, auth.SellerID(r.Context()), action, admin)
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Fail(w, http.StatusNotFound, "not_found", "booking not found")
	case errors.Is(err, ErrNotPending):
		httpx.Fail(w, http.StatusConflict, "not_pending", "booking already decided")
	case errors.Is(err, ErrPaymentNotReady):
		httpx.Fail(w, http.StatusConflict, "payment_not_ready", "payment is not authorized yet")
	case errors.Is(err, ErrGatewayUnavailable):
		httpx.Fail(w, http.StatusBadGateway, "payment_failed", "payment action failed")
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "booking_failed", "could not update booking")
	default:
		h.cache.Del(r.Context(), cache.Bookings(b.UserID))
		h.log(r, "bookings.tables", "BOOKING_"+strings.ToUpper(action), id)
		httpx.JSON(w, http.StatusOK, b)
	}
}

func (h *Handler) vacate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	b, err := h.service.Vacate(r.Context(), id, auth.SellerID(r.Context()), admin)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "confirmed booking not found")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "booking_failed", "could not vacate booking")
		return
	}
	h.cache.Del(r.Context(), cache.Bookings(b.UserID))
	h.log(r, "bookings.tables", "BOOKING_VACATE", id)
	httpx.JSON(w, http.StatusOK, b)
}

// webhook applies a signature-verified Razorpay event to the booking ledger. It never trusts the
// body without a valid HMAC and never logs the raw payload.
func (h *Handler) webhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, httpx.DefaultMaxBodyBytes))
	if err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	signature := r.Header.Get("X-Razorpay-Signature")
	orderID, paymentID, status := razorpayEvent(body)
	ok, err := h.service.HandleWebhook(r.Context(), body, signature, orderID, paymentID, status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "webhook_failed", "could not process webhook")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "invalid_signature", "signature verification failed")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

type razorpayWebhook struct {
	Event   string `json:"event"`
	Payload struct {
		Payment struct {
			Entity struct {
				ID      string `json:"id"`
				OrderID string `json:"order_id"`
			} `json:"entity"`
		} `json:"payment"`
		Refund struct {
			Entity struct {
				PaymentID string `json:"payment_id"`
			} `json:"entity"`
		} `json:"refund"`
	} `json:"payload"`
}

// razorpayEvent maps an event to (orderId, paymentId, ledger status). Unknown events map to "".
func razorpayEvent(body []byte) (orderID, paymentID, status string) {
	var evt razorpayWebhook
	if err := json.Unmarshal(body, &evt); err != nil {
		return "", "", ""
	}
	paymentID = evt.Payload.Payment.Entity.ID
	orderID = evt.Payload.Payment.Entity.OrderID
	switch evt.Event {
	case "payment.authorized":
		status = "AUTHORIZED"
	case "payment.captured":
		status = "CAPTURED"
	case "payment.failed":
		status = "FAILED"
	case "refund.created", "refund.processed":
		status = "REFUNDED"
		if evt.Payload.Refund.Entity.PaymentID != "" {
			paymentID = evt.Payload.Refund.Entity.PaymentID
		}
	}
	return orderID, paymentID, status
}

func roleAdmin(r *http.Request) bool {
	role := auth.Role(r.Context())
	return role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
}

func (h *Handler) log(r *http.Request, entity, action, entityID string) {
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
	raw, _ := json.Marshal(map[string]string{"action": action})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: entity, EntityID: entityID, After: raw,
	})
}
