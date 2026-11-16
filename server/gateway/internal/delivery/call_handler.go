package delivery

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

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

	var req initiateCallRequest
	_ = httpx.Decode(r, &req)
	forcePSTN := req.ForcePSTN || strings.EqualFold(r.URL.Query().Get("force_pstn"), "true")

	// Reject a second call before provisioning a provider room so a retried/duplicate initiate does not
	// create a billed 100ms room. The unique index remains the final guard for concurrent creates.
	if _, err := h.repo.OpenCallForRider(r.Context(), rider.RiderID); err == nil {
		httpx.Fail(w, http.StatusConflict, "conflict", "finish the current call first")
		return
	} else if !errors.Is(err, ErrNotFound) {
		h.writeErr(w, err)
		return
	}

	call := Call{
		CallID:      "call-" + shortID(),
		OrderID:     order.OrderID,
		RiderID:     rider.RiderID,
		InitiatedBy: "RIDER",
		PeerRole:    "CUSTOMER",
		Mode:        "",
	}
	authToken := ""
	if !forcePSTN && h.calls.CanVoIP() {
		roomID, roomErr := h.calls.newVoIPRoom(r.Context(), call.CallID)
		if roomErr == nil {
			token, tokenErr := h.calls.signVoIPToken(roomID, "rider:"+rider.RiderID+":"+call.CallID, h.calls.role(), 2*time.Hour)
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

	created, err := h.repo.CreateCall(r.Context(), call)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	created.AuthToken = authToken
	h.enrichCall(&created)
	httpx.JSON(w, http.StatusCreated, created)
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
// not acknowledge in time or the app detects a network/media failure.
func (h *Handler) fallbackCall(w http.ResponseWriter, r *http.Request) {
	if !h.calls.CanPSTN() {
		h.writeErr(w, fmt.Errorf("%w: no pstn number configured", ErrCallingUnavailable))
		return
	}
	h.callMutation(w, r, func(ctx context.Context, riderID, callID string) (Call, error) {
		return h.repo.SwitchCallToPSTN(ctx, riderID, callID, h.calls.VirtualNumber)
	})
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
	if c.Mode == CallModeVoIP && c.Status == CallStatusRinging && c.RingingAckAt == "" {
		if created, err := time.Parse(time.RFC3339, c.CreatedAt); err == nil {
			if time.Since(created) >= time.Duration(c.FallbackAfterSeconds)*time.Second {
				c.FallbackAvailable = h.calls.CanPSTN()
				c.VirtualNumber = h.calls.VirtualNumber
			}
		}
	}
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
