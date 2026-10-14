package checkout

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves orders + account endpoints.
type Handler struct {
	repo     *Repo
	service  *Service
	cache    *cache.Cache
	audit    contracts.AuditWriter
	notifier contracts.Notifier
}

// NewHandler builds the checkout handler. notifier may be nil.
func NewHandler(repo *Repo, service *Service, c *cache.Cache, audit contracts.AuditWriter, notifier contracts.Notifier) *Handler {
	return &Handler{repo: repo, service: service, cache: c, audit: audit, notifier: notifier}
}

// Register mounts auth-scoped order + account endpoints.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/orders", h.getOrders)
		g.Post("/orders", h.placeOrder)
		g.Get("/orders/{orderID}", h.getOrder)
		g.Post("/orders/{orderID}/payments", h.payOrder)
		g.Get("/payments", h.getPayments)
		g.Get("/profile", h.getProfile)
		g.Get("/profile/addresses", h.getAddresses)
		g.Put("/profile/addresses", h.putAddress)
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
	httpx.JSON(w, http.StatusOK, order)
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
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "order_failed", "could not place order")
	default:
		httpx.JSON(w, http.StatusCreated, order)
	}
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
	httpx.JSON(w, http.StatusOK, order)
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
