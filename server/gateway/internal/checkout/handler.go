package checkout

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/r2"
	"github.com/faazio/server/gateway/internal/platform/taxmath"
	"github.com/go-chi/chi/v5"
)

// Handler serves orders + account endpoints.
type Handler struct {
	repo     *Repo
	service  *Service
	cache    *cache.Cache
	audit    contracts.AuditWriter
	notifier contracts.Notifier
	coupons  contracts.CouponValidator
	stores   contracts.StoreReader
	delivery contracts.DeliveryDispatcher
	signer   *r2.Signer
}

// NewHandler builds the checkout handler. notifier/coupons/stores/delivery/signer may be nil
// (dispatch, notifications and presigned invoice downloads are then disabled, e.g. in unit tests).
func NewHandler(repo *Repo, service *Service, c *cache.Cache, audit contracts.AuditWriter, notifier contracts.Notifier, coupons contracts.CouponValidator, stores contracts.StoreReader, delivery contracts.DeliveryDispatcher, signer *r2.Signer) *Handler {
	return &Handler{repo: repo, service: service, cache: c, audit: audit, notifier: notifier, coupons: coupons, stores: stores, delivery: delivery, signer: signer}
}

// Register mounts auth-scoped order + account endpoints.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/orders", h.getOrders)
		g.Post("/orders", h.placeOrder)
		g.Post("/checkout/validate-coupon", h.validateCoupon)
		g.Get("/checkout/delivery-fee", h.deliveryFee)
		g.Get("/orders/tracking/{orderID}", h.trackOrder)
		g.Get("/orders/{orderID}", h.getOrder)
		g.Get("/orders/{orderID}/invoice", h.getInvoice)
		g.Post("/orders/{orderID}/payments", h.payOrder)
		g.Get("/payments", h.getPayments)
		g.Get("/profile", h.getProfile)
		g.Get("/profile/addresses", h.getAddresses)
		g.Put("/profile/addresses", h.putAddress)
		g.Delete("/profile/addresses/{addressID}", h.deleteAddress)
		g.Get("/profile/details", h.getDetails)
		g.Get("/membership", h.getMembership)
		g.Get("/order-status", h.getOrderStatus)
		g.Get("/account-nav", h.getAccountNav)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/orders", h.sellerOrders)
		g.Put("/orders/{orderID}/status", h.setOrderStatus)
	})
}

func (h *Handler) getOrders(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached []Order
	if h.cache.GetJSON(r.Context(), cache.Orders(userID), &cached) {
		for i := range cached {
			cached[i].Status = mobileStatus(cached[i].Status)
		}
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	orders, err := h.repo.OrdersByUser(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "orders_unavailable", "orders unavailable")
		return
	}
	if orders == nil {
		orders = []Order{}
	}
	h.cache.SetJSON(r.Context(), cache.Orders(userID), orders, cache.TTLOrders)
	h.projectMobileStatus(orders)
	httpx.JSON(w, http.StatusOK, orders)
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	order, ok, err := h.repo.OrderDetail(r.Context(), orderID, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "orders_unavailable", "orders unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	order.Status = mobileStatus(order.Status)
	if order.InvoiceID != "" {
		if inv, ok, err := h.repo.InvoiceForUser(r.Context(), orderID, auth.UserID(r.Context())); err == nil && ok {
			order.InvoiceNumber = inv.InvoiceNumber
			order.InvoiceURL = h.invoiceURL(r, inv)
		}
	}
	httpx.JSON(w, http.StatusOK, order)
}

// invoiceView is the customer-facing tax invoice projection (cents/paisa, never raw DB columns).
type invoiceView struct {
	InvoiceID           string `json:"invoiceId"`
	InvoiceNumber       string `json:"invoiceNumber"`
	OrderID             string `json:"orderId"`
	OrderNumber         string `json:"orderNumber"`
	SellerName          string `json:"sellerName"`
	SellerGSTIN         string `json:"sellerGstin"`
	TaxRatePct          int    `json:"taxRatePct"`
	TaxableValuePaisa   int64  `json:"taxableValuePaisa"`
	ProductTaxPaisa     int64  `json:"productTaxPaisa"`
	PlatformFeePaisa    int64  `json:"platformFeePaisa"`
	PlatformGSTPaisa    int64  `json:"platformGstPaisa"`
	DeliveryFeePaisa    int64  `json:"deliveryFeePaisa"`
	TCSPaisa            int64  `json:"tcsPaisa"`
	TDSPaisa            int64  `json:"tdsPaisa"`
	CouponDiscountPaisa int64  `json:"couponDiscountPaisa"`
	TotalPaisa          int64  `json:"totalPaisa"`
	SellerNetPaisa      int64  `json:"sellerNetPaisa"`
	DownloadURL         string `json:"downloadUrl,omitempty"`
}

// getInvoice returns the immutable invoice for one of the caller's own orders. The download URL is a
// short-lived presigned R2 GET when a rendered PDF exists; otherwise the app renders the JSON natively.
func (h *Handler) getInvoice(w http.ResponseWriter, r *http.Request) {
	inv, ok, err := h.repo.InvoiceForUser(r.Context(), chi.URLParam(r, "orderID"), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "invoice_unavailable", "invoice unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "invoice not found")
		return
	}
	httpx.JSON(w, http.StatusOK, invoiceView{
		InvoiceID: inv.InvoiceID, InvoiceNumber: inv.InvoiceNumber, OrderID: inv.OrderID,
		OrderNumber: inv.OrderNumber, SellerName: inv.SellerName, SellerGSTIN: inv.SellerGSTIN,
		TaxRatePct: inv.TaxRatePct, TaxableValuePaisa: inv.TaxableValuePaisa,
		ProductTaxPaisa: inv.ProductTaxPaisa, PlatformFeePaisa: inv.PlatformFeePaisa,
		PlatformGSTPaisa: inv.PlatformGSTPaisa, DeliveryFeePaisa: inv.DeliveryFeePaisa,
		TCSPaisa: inv.TCSPaisa, TDSPaisa: inv.TDSPaisa,
		CouponDiscountPaisa: inv.CouponDiscountPaisa, TotalPaisa: inv.TotalPaisa,
		SellerNetPaisa: inv.SellerNetPaisa, DownloadURL: h.invoiceURL(r, inv),
	})
}

// invoiceURL presigns the private invoice PDF when one has been stored.
func (h *Handler) invoiceURL(r *http.Request, inv taxmath.Invoice) string {
	if inv.PDFKey == "" || h.signer == nil || !h.signer.Enabled() {
		return ""
	}
	url, err := h.signer.PresignGet(r.Context(), h.signer.PrivateBucket(), inv.PDFKey, 10*time.Minute)
	if err != nil {
		return ""
	}
	return url
}

// trackOrder returns a lightweight status projection for one of the caller's own orders — the
// monitoring poll surface (no line items / addresses / payments). 404 for another user's order.
func (h *Handler) trackOrder(w http.ResponseWriter, r *http.Request) {
	t, ok, err := h.repo.OrderTrackingForUser(r.Context(), chi.URLParam(r, "orderID"), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "orders_unavailable", "orders unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}

func (h *Handler) getAddresses(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.AddressesByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "addresses_unavailable", "addresses unavailable")
		return
	}
	if items == nil {
		items = []Address{}
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) putAddress(w http.ResponseWriter, r *http.Request) {
	var body Address
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	addr, ok, err := h.repo.UpsertAddress(r.Context(), auth.UserID(r.Context()), body)
	if err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_address", "could not save address")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "address not found")
		return
	}
	httpx.JSON(w, http.StatusOK, addr)
}

// deleteAddress removes one of the caller's saved addresses. A missing address or a cross-user id
// returns 404 (never leaks ownership); success is an idempotent `{"ok":true}`.
func (h *Handler) deleteAddress(w http.ResponseWriter, r *http.Request) {
	addressID := chi.URLParam(r, "addressID")
	ok, err := h.repo.DeleteAddress(r.Context(), auth.UserID(r.Context()), addressID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "addresses_unavailable", "could not delete address")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "address not found")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) placeOrder(w http.ResponseWriter, r *http.Request) {
	var req PlaceOrderRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	order, err := h.service.CreateOrder(r.Context(), auth.UserID(r.Context()), req)
	switch {
	case errors.Is(err, cache.ErrLockHeld):
		httpx.Fail(w, http.StatusConflict, "duplicate", "order already being placed")
	case errors.Is(err, ErrEmptyItems):
		httpx.Fail(w, http.StatusBadRequest, "empty_items", "order has no items")
	case errors.Is(err, ErrInsufficientStock):
		httpx.Fail(w, http.StatusConflict, "out_of_stock", "one or more items are out of stock")
	case errors.Is(err, ErrAddressNotOwned):
		httpx.Fail(w, http.StatusBadRequest, "invalid_address", "address does not belong to you")
	case errors.Is(err, ErrInvalidCoupon):
		httpx.Fail(w, http.StatusBadRequest, "invalid_coupon", "coupon is not valid for this order")
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "order_failed", "could not place order")
	default:
		httpx.JSON(w, http.StatusCreated, order)
	}
}

// validateCoupon is the authoritative coupon preview: it rules a code valid/invalid for the given
// app/sector, state and cart subtotal (rupees on the wire) and returns the server-computed discount.
// Checkout settles the same ruling again at order placement, so the client's figure is display-only.
func (h *Handler) validateCoupon(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code     string `json:"code"`
		App      string `json:"app"`
		State    string `json:"state"`
		Subtotal int64  `json:"subtotal"` // whole rupees
	}
	if err := httpx.Decode(r, &body); err != nil || strings.TrimSpace(body.Code) == "" || body.Subtotal < 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "code and subtotal required")
		return
	}
	if h.coupons == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "promo_unavailable", "promo unavailable")
		return
	}
	v, err := h.coupons.ValidateCoupon(r.Context(), body.Code,
		strings.ToUpper(strings.TrimSpace(body.App)), strings.ToUpper(strings.TrimSpace(body.State)), body.Subtotal*100)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "promo_unavailable", "promo unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"valid":        v.Valid,
		"reason":       v.Reason,
		"code":         v.Code,
		"valuePercent": v.ValuePercent,
		"maxDiscount":  v.MaxDiscountPaisa / 100,
		"minOrder":     v.MinOrderPaisa / 100,
		"discount":     v.DiscountPaisa / 100,
		"freeDelivery": v.FreeDelivery,
	})
}

// deliveryFee is the server-authoritative delivery-fee quote for a store → customer fix
// (params: storeId + lat + lng). It distances directory.stores pins (Haversine) and applies the
// tax.delivery_fee_settings rate card. Road distance is server-owned; the client mirrors this
// estimate and the same math re-runs at settlement (CreateOrder).
func (h *Handler) deliveryFee(w http.ResponseWriter, r *http.Request) {
	storeID := strings.TrimSpace(r.URL.Query().Get("storeId"))
	lat, errLat := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, errLng := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	if storeID == "" || errLat != nil || errLng != nil || !validLatitude(lat) || !validLongitude(lng) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "storeId, lat and lng are required")
		return
	}
	quote, err := h.service.DeliveryFeeForStore(r.Context(), storeID, lat, lng)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "delivery_fee_unavailable", "delivery fee unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, quote)
}

// payOrder records a payment for an order the caller owns. The amount is derived server-side from
// the stored order total minus coins redeemed (1 coin = 1 paisa); the client never sets the amount.
func (h *Handler) payOrder(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	orderID := chi.URLParam(r, "orderID")
	var body struct {
		Method        string `json:"method"`
		CoinsRedeemed int64  `json:"coinsRedeemed"`
	}
	_ = httpx.Decode(r, &body)

	totalPaisa, ok, err := h.repo.OrderTotalForUser(r.Context(), orderID, userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payment_failed", "could not record payment")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	coins := body.CoinsRedeemed
	if coins < 0 {
		coins = 0
	}
	totalRupees := totalPaisa / 100
	amount := totalRupees - coins/coinsPerRupee
	if amount < 0 {
		amount = 0
	}
	method := body.Method
	if method == "" {
		method = "COINS"
	}
	payment := Payment{
		ID:            newPaymentID(),
		OrderID:       orderID,
		UserID:        userID,
		Method:        method,
		Amount:        amount,
		CoinsRedeemed: coins,
		Status:        "PAID",
	}
	if err := h.repo.InsertPayment(r.Context(), payment); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payment_failed", "could not record payment")
		return
	}
	httpx.JSON(w, http.StatusCreated, payment)
}

func (h *Handler) getPayments(w http.ResponseWriter, r *http.Request) {
	payments, err := h.repo.PaymentsByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "payments_unavailable", "payments unavailable")
		return
	}
	if payments == nil {
		payments = []Payment{}
	}
	httpx.JSON(w, http.StatusOK, payments)
}

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	p, ok, err := h.repo.ProfileByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "profile not found")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) getDetails(w http.ResponseWriter, r *http.Request) {
	d, ok, err := h.repo.DetailsByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "details not found")
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

func (h *Handler) getMembership(w http.ResponseWriter, r *http.Request) {
	m, ok, err := h.repo.MembershipByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if !ok {
		httpx.JSON(w, http.StatusOK, nil)
		return
	}
	httpx.JSON(w, http.StatusOK, m)
}

func (h *Handler) getOrderStatus(w http.ResponseWriter, r *http.Request) {
	rows, err := h.repo.OrderStatusByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if rows == nil {
		rows = []OrderStatus{}
	}
	httpx.JSON(w, http.StatusOK, rows)
}

func (h *Handler) getAccountNav(w http.ResponseWriter, r *http.Request) {
	rows, err := h.repo.NavByUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "profile_unavailable", "profile unavailable")
		return
	}
	if rows == nil {
		rows = []Nav{}
	}
	httpx.JSON(w, http.StatusOK, rows)
}

func (h *Handler) sellerOrders(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	if status == "NEW" {
		// NEW is the portal projection of the legacy mobile Processing rows.
		orders, err := h.repo.SellerOrders(r.Context(), sellerID, "")
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "orders_unavailable", "orders unavailable")
			return
		}
		filtered := []Order{}
		for i := range orders {
			if portalStatus(orders[i].Status) == "NEW" {
				orders[i].Status = "NEW"
				filtered = append(filtered, orders[i])
			}
		}
		httpx.JSON(w, http.StatusOK, filtered)
		return
	}
	orders, err := h.repo.SellerOrders(r.Context(), sellerID, status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "orders_unavailable", "orders unavailable")
		return
	}
	if orders == nil {
		orders = []Order{}
	}
	for i := range orders {
		orders[i].Status = portalStatus(orders[i].Status)
	}
	httpx.JSON(w, http.StatusOK, orders)
}

func (h *Handler) setOrderStatus(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	status := strings.ToUpper(strings.TrimSpace(body.Status))
	if !allowedOrderStatus(status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid order status")
		return
	}
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	order, ok, err := h.repo.SetOrderStatus(r.Context(), orderID, auth.SellerID(r.Context()), status, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "order_update_failed", "could not update order")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	h.cache.Del(r.Context(), cache.Orders(order.UserID))
	order.Status = portalStatus(order.Status)
	h.log(r, "ORDER_"+status, orderID)
	h.notifyStatus(r, order, status)
	if status == "PACKED" {
		h.autoDispatch(r.Context(), orderID)
	}
	httpx.JSON(w, http.StatusOK, order)
}

// autoDispatch queues the ready order for rider assignment. Best-effort: the order is already
// PACKED, and a failed/unavailable dispatch is left for an admin to assign manually. Runs in the
// background so a slow Routes API call never delays the seller's status action.
func (h *Handler) autoDispatch(ctx context.Context, orderID string) {
	if h.stores == nil || h.delivery == nil {
		return
	}
	base := context.WithoutCancel(ctx)
	go func() {
		ctx, cancel := context.WithTimeout(base, 20*time.Second)
		defer cancel()
		dc, ok, err := h.repo.DeliveryContextForOrder(ctx, orderID)
		if err != nil || !ok || (dc.Fulfillment != "" && dc.Fulfillment != "DELIVERY") || len(dc.StoreIDs) != 1 ||
			dc.Latitude == nil || dc.Longitude == nil {
			return
		}
		store, ok, err := h.stores.ByID(ctx, dc.StoreIDs[0])
		if err != nil || !ok || store.Latitude == nil || store.Longitude == nil ||
			strings.TrimSpace(store.StateCode) == "" {
			return
		}
		_, _ = h.delivery.DispatchOrder(ctx, contracts.DeliveryDispatchRequest{
			CustomerOrderID: dc.OrderID,
			StoreID:         store.ID,
			StoreName:       store.Name,
			StoreAddress:    store.Address,
			StoreLatitude:   *store.Latitude,
			StoreLongitude:  *store.Longitude,
			StateCode:       store.StateCode,
			CustomerName:    dc.CustomerName,
			CustomerPhone:   dc.CustomerPhone,
			CustomerAddress: dc.CustomerAddr,
			DropLatitude:    *dc.Latitude,
			DropLongitude:   *dc.Longitude,
		})
	}()
}

// notifyStatus enqueues a customer notification for customer-facing status changes. Best-effort:
// the status is already committed, so a delivery hiccup must not fail the seller's action.
func (h *Handler) notifyStatus(r *http.Request, order Order, status string) {
	if h.notifier == nil || order.UserID == "" {
		return
	}
	switch status {
	case "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED":
	default:
		return
	}
	_ = h.notifier.Enqueue(r.Context(), order.UserID, "ORDER_"+status,
		"Order "+order.ID+" updated",
		"Your order is now "+strings.ToLower(status)+".",
		map[string]any{"orderId": order.ID, "status": status})
}

// portalStatus maps the legacy mobile status onto the portal lifecycle (Processing -> NEW).
func portalStatus(s string) string {
	if s == "Processing" {
		return "NEW"
	}
	return s
}

// mobileStatus collapses the portal lifecycle back to the mobile vocabulary (NEW/PACKED -> Processing).
func mobileStatus(s string) string {
	if s == "NEW" || s == "PACKED" {
		return "Processing"
	}
	return s
}

func (h *Handler) projectMobileStatus(orders []Order) {
	for i := range orders {
		orders[i].Status = mobileStatus(orders[i].Status)
	}
}

// allowedOrderStatus is the portal order lifecycle. Mobile's Processing is expressed as NEW/PACKED.
func allowedOrderStatus(s string) bool {
	switch s {
	case "NEW", "PACKED", "SHIPPED", "DELIVERED", "RETURNED", "CANCELLED":
		return true
	default:
		return false
	}
}

func (h *Handler) log(r *http.Request, action, entityID string) {
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
		Entity: "checkout.orders", EntityID: entityID, After: raw,
	})
}
