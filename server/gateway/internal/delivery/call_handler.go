package delivery

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// ErrCallingUnavailable means neither VOIP nor PSTN is configured. The API fails closed instead of
// returning a room/token the app cannot use.
var ErrCallingUnavailable = errors.New("delivery: calling is not configured")

type initiateCallRequest struct {
	ForcePSTN bool `json:"forcePstn"`
}

// initiateCall starts a rider→customer call. The server decides the mode: VOIP when 100ms is
// configured and a room can be provisioned, otherwise PSTN_BRIDGING with the masked virtual number.
// The customer's raw phone never leaves the database.
func (h *Handler) initiateCall(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	order, err := h.repo.orderByID(r.Context(), rider.RiderID, chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	// A rider may only call the customer on a job they have accepted (not an unaccepted offer).
	if order.Status != "ACCEPTED" {
		httpx.Fail(w, http.StatusConflict, "order_not_accepted", "accept the delivery before calling the customer")
		return
	}
	h.startCall(w, r, callParticipants{
		order:       order,
		riderID:     rider.RiderID,
		initiatedBy: "RIDER",
		peerRole:    "CUSTOMER",
		userID:      rider.UserID,
	})
}

// initiateCustomerCall starts a customer→rider call for an order the caller owns. The customer sees
// the checkout order id; the call row is keyed by the delivery job id, so the id is resolved first.
func (h *Handler) initiateCustomerCall(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		httpx.Fail(w, http.StatusUnauthorized, "unauthenticated", "sign in to call your delivery partner")
		return
	}
	order, err := h.repo.DeliveryOrderForCustomer(r.Context(), chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	// Ownership is the only authorisation for a customer call: the rider phone is never revealed, so
	// an unowned order must not start a masked leg to that rider.
	if h.orders == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "delivery_unavailable", "delivery service unavailable")
		return
	}
	owned, err := h.orders.OrderOwnedBy(r.Context(), order.CustomerOrderID, userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "delivery_unavailable", "delivery service unavailable")
		return
	}
	if !owned {
		httpx.Fail(w, http.StatusForbidden, "not_order_owner", "only the customer can call about this delivery")
		return
	}
	if order.Status != "ACCEPTED" {
		httpx.Fail(w, http.StatusConflict, "order_not_accepted", "your delivery partner has not started this delivery yet")
		return
	}
	riderPhone, err := h.repo.RiderPhoneForOrder(r.Context(), order.OrderID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.startCall(w, r, callParticipants{
		order:       order,
		riderID:     order.RiderID,
		riderPhone:  riderPhone,
		initiatedBy: "CUSTOMER",
		peerRole:    "DELIVERY_PARTNER",
		userID:      userID,
	})
}

// callParticipants is the resolved identity of a call initiator, so both directions share one
// provisioning path (VOIP room + token, PSTN bridge or handoff) instead of duplicating it.
type callParticipants struct {
	order      Order
	riderID    string
	riderPhone string
	// initiatedBy is RIDER or CUSTOMER; peerRole is the masked label the other side sees.
	initiatedBy string
	peerRole    string
	// userID is the caller's identity, used to scope the VOIP token.
	userID string
}

// startCall provisions and persists one ringing call. The initiator is already authenticated and
// authorised by the caller of this helper.
func (h *Handler) startCall(w http.ResponseWriter, r *http.Request, p callParticipants) {
	var req initiateCallRequest
	_ = httpx.Decode(r, &req)
	forcePSTN := req.ForcePSTN || strings.EqualFold(r.URL.Query().Get("force_pstn"), "true")

	// Reject a second call before provisioning a provider room so a retried/duplicate initiate does not
	// create a billed 100ms room. The unique index remains the final guard for concurrent creates.
	if _, err := h.repo.OpenCallForRider(r.Context(), p.riderID); err == nil {
		httpx.Fail(w, http.StatusConflict, "conflict", "finish the current call first")
		return
	} else if !errors.Is(err, ErrNotFound) {
		h.writeErr(w, err)
		return
	}

	call := Call{
		CallID:      "call-" + shortID(),
		OrderID:     p.order.OrderID,
		RiderID:     p.riderID,
		InitiatedBy: p.initiatedBy,
		PeerRole:    p.peerRole,
		Mode:        "",
	}
	authToken := ""
	if !forcePSTN && h.calls.CanVoIP() {
		roomID, roomErr := h.calls.newVoIPRoom(r.Context(), call.CallID)
		if roomErr == nil {
			token, tokenErr := h.calls.signVoIPToken(roomID, voipUserID(p, call.CallID), h.calls.role(), 2*time.Hour)
			if tokenErr == nil {
				call.Mode = CallModeVoIP
				call.RoomID = roomID
				authToken = token
			}
		}
		// A provider failure is not fatal when PSTN is available: fall through to the masked leg.
		if call.Mode == "" && !h.calls.CanPSTN() {
			h.writeErr(w, fmt.Errorf("%w: voip room unavailable", ErrCallingUnavailable))
			return
		}
	}
	if call.Mode == "" {
		// Clear any partially-provisioned room before persisting the PSTN leg.
		call.RoomID = ""
		if !h.calls.CanPSTN() {
			h.writeErr(w, ErrCallingUnavailable)
			return
		}
		call.Mode = CallModePSTN
		call.VirtualNumber = h.calls.VirtualNumber
	}

	create := h.repo.CreateCall
	if p.initiatedBy == "CUSTOMER" {
		create = h.repo.CreateCustomerCall
	}
	created, err := create(r.Context(), call)
	if err != nil {
		h.writeErr(w, err)
		return
	}

	// Place the bridge only after the row exists. Bridging first would dial a real phone and then
	// leave nobody to reconcile it if the insert lost the one-open-call race. With a provider
	// configured the server places the call itself, so the callee never has to dial; a provider
	// failure degrades to the dialled masked number (handoff), never a fake bridge.
	h.bridgePSTNCall(r.Context(), &created, p.riderPhone)

	created.AuthToken = authToken
	h.enrichCall(&created)
	// A bridged call rings both phones from the provider. Pushing `incoming_call` as well would also
	// raise CallKit/CallKeep on the callee (and make their client dial the masked number), so the
	// callee would get a duplicate ring on top of the live carrier call.
	if !created.Bridged {
		h.notifyCallee(r.Context(), created)
	}
	httpx.JSON(w, http.StatusCreated, created)
}

// bridgePSTNCall places the provider bridge for a call that is (or just switched to) the masked PSTN
// mode and records the provider id. It is a no-op when the bridge is already live, unconfigured, or
// either leg's phone is unknown. A bridge is only placed when its status webhook can reconcile it
// (`CanReconcilePSTN`): without answer/end events the row would stay RINGING and the sweep would mark a
// live call MISSED. Otherwise the deployment keeps the dial-only handoff. Returns true when bridged.
//
// The provider rings `first` then `second` (see bridgePSTN), so the initiator's phone is dialled
// first and the callee's second — the person who tapped Call is the one who must answer their phone
// to open the bridge.
func (h *Handler) bridgePSTNCall(ctx context.Context, c *Call, knownRiderPhone string) bool {
	if c == nil || c.Mode != CallModePSTN || c.ProviderCallRef != "" || !h.calls.CanReconcilePSTN() {
		return c != nil && c.Bridged
	}
	customerPhone, _ := h.repo.CustomerPhoneForOrder(ctx, c.OrderID)
	riderPhone := knownRiderPhone
	if riderPhone == "" {
		riderPhone, _ = h.repo.RiderPhoneForOrder(ctx, c.OrderID)
	}
	if customerPhone == "" || riderPhone == "" {
		return false
	}
	first, second := riderPhone, customerPhone
	if c.InitiatedBy == "CUSTOMER" {
		first, second = customerPhone, riderPhone
	}
	ref, err := h.calls.bridgePSTN(ctx, c.CallID, first, second)
	if err != nil {
		return false
	}
	if err := h.repo.SetProviderCallRef(ctx, c.CallID, ref); err != nil {
		return false
	}
	c.ProviderCallRef = ref
	c.Bridged = true
	return true
}

// voipUserID scopes the 100ms token to the initiator so the two peers are distinct room users. It is
// derived from the call itself (not the session identity) so a re-mint on join produces the same
// room user as the initial join.
func voipUserID(p callParticipants, callID string) string {
	if p.initiatedBy == "CUSTOMER" {
		return "customer:" + p.order.OrderID + ":" + callID
	}
	return "rider:" + p.riderID + ":" + callID
}

// getCall returns the authoritative state so the caller can drive the ringing-ack timeout and the
// server-side fallback decision.
func (h *Handler) getCall(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	call, err := h.repo.CallByID(r.Context(), rider.RiderID, chi.URLParam(r, "callId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.enrichCall(&call)
	httpx.JSON(w, http.StatusOK, call)
}

// activeCall returns the rider's open call, or 204 when there is none. A client that lost its call
// id (crash, force-quit, reinstall) can resume/end the row instead of being permanently blocked by
// the one-open-call index.
func (h *Handler) activeCall(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	call, err := h.repo.OpenCallForRider(r.Context(), rider.RiderID)
	if errors.Is(err, ErrNotFound) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.enrichCall(&call)
	httpx.JSON(w, http.StatusOK, call)
}

func (h *Handler) ackCall(w http.ResponseWriter, r *http.Request) {
	h.callMutation(w, r, func(ctx context.Context, riderID, callID string) (Call, error) {
		return h.repo.AckCallRinging(ctx, riderID, callID)
	})
}

func (h *Handler) acceptCall(w http.ResponseWriter, r *http.Request) {
	h.callMutation(w, r, func(ctx context.Context, riderID, callID string) (Call, error) {
		return h.repo.AcceptCall(ctx, riderID, callID)
	})
}

// joinCall accepts a ringing call and returns a fresh short-lived VOIP token. Incoming calls carry
// only the call id in the push; the token is minted here so it is never stale and never lives in a
// notification payload.
func (h *Handler) joinCall(w http.ResponseWriter, r *http.Request) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	callID := chi.URLParam(r, "callId")
	existing, err := h.repo.CallByID(r.Context(), rider.RiderID, callID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	// Mint the token before transitioning the row: a signing failure must not leave an ACTIVE call
	// the rider cannot join.
	authToken := ""
	if existing.Mode == CallModeVoIP && existing.RoomID != "" {
		token, tokenErr := h.calls.signVoIPToken(existing.RoomID, "rider:"+rider.RiderID+":"+callID, h.calls.role(), 2*time.Hour)
		if tokenErr != nil {
			h.writeErr(w, fmt.Errorf("%w: voip token unavailable", ErrCallingUnavailable))
			return
		}
		authToken = token
	}
	joined, err := h.repo.AcceptCall(r.Context(), rider.RiderID, callID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if authToken != "" {
		joined.RoomID = existing.RoomID
		joined.AuthToken = authToken
	}
	h.enrichCall(&joined)
	httpx.JSON(w, http.StatusOK, joined)
}

type callEndRequest struct {
	Reason string `json:"reason"`
}

func (h *Handler) rejectCall(w http.ResponseWriter, r *http.Request) {
	var req callEndRequest
	_ = httpx.Decode(r, &req)
	h.callMutation(w, r, func(ctx context.Context, riderID, callID string) (Call, error) {
		return h.repo.RejectCall(ctx, riderID, callID, safeReason(req.Reason, "rejected"))
	})
}

func (h *Handler) endCall(w http.ResponseWriter, r *http.Request) {
	var req callEndRequest
	_ = httpx.Decode(r, &req)
	h.callMutation(w, r, func(ctx context.Context, riderID, callID string) (Call, error) {
		return h.repo.EndCall(ctx, riderID, callID, safeReason(req.Reason, "ended"))
	})
}

// fallbackCall switches a ringing VOIP call to the masked PSTN leg. Used when the callee device does
// not acknowledge in time or the app detects a network/media failure. When a provider is configured
// the server also places the bridge, so the handoff stays a real connection instead of a number the
// peer would have to dial themselves.
func (h *Handler) fallbackCall(w http.ResponseWriter, r *http.Request) {
	if !h.calls.CanPSTN() {
		h.writeErr(w, fmt.Errorf("%w: no pstn number configured", ErrCallingUnavailable))
		return
	}
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	updated, err := h.repo.SwitchCallToPSTN(r.Context(), rider.RiderID, chi.URLParam(r, "callId"), h.calls.VirtualNumber)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	// Place the bridge before responding so the client knows it must not dial the masked number.
	h.bridgePSTNCall(r.Context(), &updated, "")
	h.enrichCall(&updated)
	httpx.JSON(w, http.StatusOK, updated)
}

// --- customer-facing lifecycle -------------------------------------------------------------------
//
// A customer-initiated call is authorised by order ownership, not rider identity, so it cannot use
// the rider-scoped mutations above. Each handler resolves the call's order and checks ownership
// before touching the row.

// getCustomerCall returns the authoritative state of a call belonging to one of the caller's orders.
func (h *Handler) getCustomerCall(w http.ResponseWriter, r *http.Request) {
	call, ok := h.authoriseCustomerCall(w, r)
	if !ok {
		return
	}
	h.enrichCall(&call)
	httpx.JSON(w, http.StatusOK, call)
}

// activeCustomerCall returns the open call on one of the caller's orders, or 204 when there is none.
func (h *Handler) activeCustomerCall(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		httpx.Fail(w, http.StatusUnauthorized, "unauthenticated", "sign in to read your delivery call")
		return
	}
	order, err := h.repo.DeliveryOrderForCustomer(r.Context(), chi.URLParam(r, "orderId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if !h.ownsOrder(w, r, order, userID) {
		return
	}
	call, err := h.repo.OpenCallForOrder(r.Context(), order.OrderID)
	if errors.Is(err, ErrNotFound) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.enrichCall(&call)
	httpx.JSON(w, http.StatusOK, call)
}

func (h *Handler) ackCustomerCall(w http.ResponseWriter, r *http.Request) {
	h.customerCallMutation(w, r, func(ctx context.Context, callID string) (Call, error) {
		return h.repo.AckCallRingingByID(ctx, callID)
	})
}

func (h *Handler) joinCustomerCall(w http.ResponseWriter, r *http.Request) {
	h.customerCallMutation(w, r, func(ctx context.Context, callID string) (Call, error) {
		return h.repo.JoinCallByID(ctx, callID)
	}, func(c *Call) (string, error) {
		// The customer is the initiator, so re-mint the same room user the initial join used; a long
		// ring must never hand the app an expired token.
		if c.Mode != CallModeVoIP || c.RoomID == "" {
			return "", nil
		}
		return h.calls.signVoIPToken(c.RoomID, "customer:"+c.OrderID+":"+c.CallID, h.calls.role(), 2*time.Hour)
	})
}

func (h *Handler) rejectCustomerCall(w http.ResponseWriter, r *http.Request) {
	var req callEndRequest
	_ = httpx.Decode(r, &req)
	h.customerCallMutation(w, r, func(ctx context.Context, callID string) (Call, error) {
		return h.repo.RejectCallByID(ctx, callID, safeReason(req.Reason, "rejected"))
	})
}

func (h *Handler) endCustomerCall(w http.ResponseWriter, r *http.Request) {
	var req callEndRequest
	_ = httpx.Decode(r, &req)
	h.customerCallMutation(w, r, func(ctx context.Context, callID string) (Call, error) {
		return h.repo.EndCallByID(ctx, callID, safeReason(req.Reason, "ended"))
	})
}

func (h *Handler) fallbackCustomerCall(w http.ResponseWriter, r *http.Request) {
	if !h.calls.CanPSTN() {
		h.writeErr(w, fmt.Errorf("%w: no pstn number configured", ErrCallingUnavailable))
		return
	}
	call, ok := h.authoriseCustomerCall(w, r)
	if !ok {
		return
	}
	updated, err := h.repo.SwitchCallToPSTNByID(r.Context(), call.CallID, h.calls.VirtualNumber)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.bridgePSTNCall(r.Context(), &updated, "")
	h.enrichCall(&updated)
	httpx.JSON(w, http.StatusOK, updated)
}

// authoriseCustomerCall resolves the call and proves the caller owns its order.
func (h *Handler) authoriseCustomerCall(w http.ResponseWriter, r *http.Request) (Call, bool) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		httpx.Fail(w, http.StatusUnauthorized, "unauthenticated", "sign in to manage your delivery call")
		return Call{}, false
	}
	call, err := h.repo.CallByIDUnscoped(r.Context(), chi.URLParam(r, "callId"))
	if err != nil {
		h.writeErr(w, err)
		return Call{}, false
	}
	order, err := h.repo.orderByID(r.Context(), "", call.OrderID)
	if err != nil {
		h.writeErr(w, err)
		return Call{}, false
	}
	if !h.ownsOrder(w, r, order, userID) {
		return Call{}, false
	}
	return call, true
}

// ownsOrder writes the 403 and returns false when the caller does not own the order.
func (h *Handler) ownsOrder(w http.ResponseWriter, r *http.Request, order Order, userID string) bool {
	if h.orders == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "delivery_unavailable", "delivery service unavailable")
		return false
	}
	owned, err := h.orders.OrderOwnedBy(r.Context(), order.CustomerOrderID, userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "delivery_unavailable", "delivery service unavailable")
		return false
	}
	if !owned {
		httpx.Fail(w, http.StatusForbidden, "not_order_owner", "only the customer can manage this delivery call")
		return false
	}
	return true
}

// customerCallMutation runs an ownership-gated call transition and echoes the new state.
func (h *Handler) customerCallMutation(
	w http.ResponseWriter,
	r *http.Request,
	fn func(context.Context, string) (Call, error),
	withToken ...func(*Call) (string, error),
) {
	call, ok := h.authoriseCustomerCall(w, r)
	if !ok {
		return
	}
	updated, err := fn(r.Context(), call.CallID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	for _, mint := range withToken {
		token, terr := mint(&updated)
		if terr != nil {
			h.writeErr(w, fmt.Errorf("%w: voip token unavailable", ErrCallingUnavailable))
			return
		}
		updated.AuthToken = token
	}
	h.enrichCall(&updated)
	httpx.JSON(w, http.StatusOK, updated)
}

// pstnWebhook reconciles a bridged PSTN call from the telephony provider's status callback. It is
// unauthenticated by design (the provider calls it) and gated by the shared URL token instead.
func (h *Handler) pstnWebhook(w http.ResponseWriter, r *http.Request) {
	if !h.calls.verifyWebhookToken(r.URL.Query().Get("token")) {
		httpx.Fail(w, http.StatusUnauthorized, "invalid_token", "invalid webhook token")
		return
	}
	if err := r.ParseForm(); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_payload", "unreadable webhook payload")
		return
	}
	// Exotel posts JSON when StatusCallbackContentType=application/json, form fields otherwise.
	event := struct {
		CallSid     string
		CallStatus  string
		Status      string
		CustomField string
	}{}
	if strings.Contains(r.Header.Get("Content-Type"), "application/json") {
		var body struct {
			CallSid     string `json:"CallSid"`
			CallStatus  string `json:"CallStatus"`
			Status      string `json:"Status"`
			CustomField string `json:"CustomField"`
		}
		if err := httpx.Decode(r, &body); err == nil {
			event.CallSid, event.CallStatus, event.Status, event.CustomField =
				body.CallSid, body.CallStatus, body.Status, body.CustomField
		}
	} else {
		event.CallSid = r.PostFormValue("CallSid")
		event.CallStatus = r.PostFormValue("CallStatus")
		event.Status = r.PostFormValue("Status")
		event.CustomField = r.PostFormValue("CustomField")
	}
	callID := strings.TrimSpace(event.CustomField)
	if callID == "" && event.CallSid != "" {
		if call, err := h.repo.CallByProviderRef(r.Context(), event.CallSid); err == nil {
			callID = call.CallID
		}
	}
	if callID == "" {
		// Nothing to reconcile; acknowledge so the provider stops retrying a payload we cannot map.
		w.WriteHeader(http.StatusNoContent)
		return
	}
	// `Status` carries the call status; `CallStatus` is the event name when the callback is subscribed
	// per-event (Exotel sends `answered`/`terminal`). Prefer the specific field rather than
	// concatenating both, which could never match a status.
	state := strings.ToLower(strings.TrimSpace(event.Status))
	if state == "" {
		state = strings.ToLower(strings.TrimSpace(event.CallStatus))
	}
	switch state {
	case "in-progress", "answered":
		_, _ = h.repo.AcceptCallByID(r.Context(), callID)
	case "completed", "terminal":
		_, _ = h.repo.EndCallByID(r.Context(), callID, "provider_completed")
	case "failed", "busy", "no-answer", "canceled", "cancelled":
		_, _ = h.repo.RejectCallByID(r.Context(), callID, state)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) callMutation(w http.ResponseWriter, r *http.Request, fn func(context.Context, string, string) (Call, error)) {
	rider, err := h.currentRider(r.Context())
	if err != nil {
		h.writeErr(w, err)
		return
	}
	call, err := fn(r.Context(), rider.RiderID, chi.URLParam(r, "callId"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	h.enrichCall(&call)
	httpx.JSON(w, http.StatusOK, call)
}

// enrichCall computes the server-driven fallback signal. VOIP tokens are only attached on initiate.
func (h *Handler) enrichCall(c *Call) {
	c.FallbackAfterSeconds = h.calls.fallbackSeconds()
	c.Bridged = c.Mode == CallModePSTN && c.ProviderCallRef != ""
	if c.Mode == CallModeVoIP && c.Status == CallStatusRinging && c.RingingAckAt == "" {
		if created, err := time.Parse(time.RFC3339, c.CreatedAt); err == nil {
			if time.Since(created) >= time.Duration(c.FallbackAfterSeconds)*time.Second {
				c.FallbackAvailable = h.calls.CanPSTN()
				c.VirtualNumber = h.calls.VirtualNumber
			}
		}
	}
}

// notifyCallee enqueues the data-only `incoming_call` push that wakes the other product. Without it
// a created call row never rings anywhere: the client's background handler only reacts to this kind.
// The payload is PII-free (ids + masked role only); the VOIP token is minted on answer, never here.
func (h *Handler) notifyCallee(ctx context.Context, c Call) {
	if h.notifier == nil || c.InitiatedBy == "" {
		return
	}
	// The callee is the other product: a rider-initiated call rings the customer and vice versa.
	var target string
	var err error
	if c.InitiatedBy == "RIDER" {
		target, err = h.repo.CustomerUserIDForOrder(ctx, c.OrderID)
	} else {
		target, err = h.repo.CallRiderUserID(ctx, c.OrderID)
	}
	if err != nil || target == "" {
		// No linked identity (e.g. an unlinked seeded rider): the call still exists and the client can
		// recover it on next foreground, but no push is fabricated.
		return
	}
	// CallKit keys a call by UUID, and rejects a non-UUID string, while the call id is `call-<hex>`.
	// `callUuid` is derived deterministically so a re-delivered push answers/ends the same CallKit
	// call instead of stacking a duplicate. `callerLabel` is the masked name of the *caller* (the
	// peer the callee sees), which the client cannot derive from `peerRole` alone.
	_ = h.notifier.Enqueue(ctx, target, "incoming_call", "Incoming call", "Tap to answer the delivery call",
		map[string]any{
			"type":        "incoming_call",
			"callId":      c.CallID,
			"callUuid":    callUUID(c.CallID),
			"orderId":     c.OrderID,
			"peerRole":    c.PeerRole,
			"callerLabel": callerLabel(c.InitiatedBy),
			"mode":        c.Mode,
		})
	// The ring has a 45s TTL; deliver it now instead of waiting for the 30s drain tick.
	if h.nudger != nil {
		h.nudger.Nudge()
	}
}

// callerLabel is the masked display name of the peer who started the call — what the callee sees on
// the CallKit screen. Never a phone number or a real name.
func callerLabel(initiatedBy string) string {
	if initiatedBy == "RIDER" {
		return "Delivery Partner"
	}
	return "Customer"
}

// callUUID derives a stable UUID from the call id. CallKit requires a UUID and iOS terminates an app
// that reports an incoming call with an unparseable one; deriving it (instead of storing a new
// column) keeps the value identical across a push re-delivery and the JS answer path.
func callUUID(callID string) string {
	sum := sha256.Sum256([]byte("faazio-call:" + callID))
	sum[6] = (sum[6] & 0x0f) | 0x40 // version 4
	sum[8] = (sum[8] & 0x3f) | 0x80 // RFC 4122 variant
	return fmt.Sprintf("%x-%x-%x-%x-%x", sum[0:4], sum[4:6], sum[6:8], sum[8:10], sum[10:16])
}

// safeReason keeps a client-supplied reason short and free of control characters. It is an
// operational label only and is never shown to the other peer.
func safeReason(raw, fallback string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	if len(raw) > 80 {
		raw = raw[:80]
	}
	return strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, raw)
}
