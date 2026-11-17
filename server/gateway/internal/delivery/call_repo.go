package delivery

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Call modes + statuses mirror the delivery_call_* enums (0104).
const (
	CallModeVoIP = "VOIP"
	CallModePSTN = "PSTN_BRIDGING"

	CallStatusRinging  = "RINGING"
	CallStatusActive   = "ACTIVE"
	CallStatusEnded    = "ENDED"
	CallStatusRejected = "REJECTED"
	CallStatusFailed   = "FAILED"
	CallStatusMissed   = "MISSED"
	CallStatusBusy     = "BUSY"
)

// Call is the client projection of one delivery.calls row. It carries masked identity only: the
// customer's phone number never appears here.
type Call struct {
	CallID      string `json:"callId"`
	OrderID     string `json:"orderId"`
	RiderID     string `json:"riderId"`
	InitiatedBy string `json:"initiatedBy"`
	PeerRole    string `json:"peerRole"`
	Mode        string `json:"mode"`
	Status      string `json:"status"`
	// RoomID + AuthToken are VOIP-only. AuthToken is short-lived and never logged.
	RoomID    string `json:"roomId,omitempty"`
	AuthToken string `json:"authToken,omitempty"`
	// VirtualNumber is PSTN-only and is the masked landline the rider dials.
	VirtualNumber string `json:"virtualNumber,omitempty"`
	// ProviderCallRef is the telephony provider's call id (never a credential). Server-internal: it is
	// the webhook reconciliation key and is not projected to the app.
	ProviderCallRef string `json:"-"`
	// Bridged is true when the server already placed the masked PSTN call through the provider. The
	// client must then NOT dial the virtual number: doing so would place a second call on top of the
	// live bridge. Both legs ring from the provider and the webhook flips the row ACTIVE.
	Bridged      bool   `json:"bridged,omitempty"`
	RingingAckAt string `json:"ringingAckAt,omitempty"`
	AcceptedAt   string `json:"acceptedAt,omitempty"`
	EndedAt      string `json:"endedAt,omitempty"`
	EndReason    string `json:"endReason,omitempty"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
	// FallbackAvailable is true when a VOIP call is still ringing past the ack window, so the client
	// may offer (or the server may switch to) the masked PSTN leg.
	FallbackAvailable bool `json:"fallbackAvailable"`
	// FallbackAfterSeconds is the ack window the server applies.
	FallbackAfterSeconds int `json:"fallbackAfterSeconds"`
}

// CreateCall persists a new ringing call. It refuses when the rider already has an open call; the
// partial unique index is the final guard against a concurrent double-room.
func (r *Repo) CreateCall(ctx context.Context, c Call) (Call, error) {
	return r.createCall(ctx, c, "")
}

// CreateCustomerCall persists a call the customer started. The customer is not the rider, so the
// insert may not read the row back through the rider-scoped CallByID: the caller is authorised by
// order ownership instead (see Handler.initiateCustomerCall).
func (r *Repo) CreateCustomerCall(ctx context.Context, c Call) (Call, error) {
	return r.createCall(ctx, c, customerCaller)
}

// customerCaller marks a read that is scoped by order ownership rather than rider identity.
const customerCaller = "_customer_"

func (r *Repo) createCall(ctx context.Context, c Call, caller string) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	var open string
	err := r.pool.QueryRow(ctx, `
		select call_id from delivery.calls
		 where rider_id=$1 and status in ('RINGING','ACTIVE') limit 1`, c.RiderID).Scan(&open)
	if err == nil {
		return Call{}, fmt.Errorf("%w: rider already has an open call", ErrConflict)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Call{}, err
	}
	_, err = r.pool.Exec(ctx, `
		insert into delivery.calls
		  (call_id, order_id, rider_id, initiated_by, peer_role, mode, status,
		   provider_room_id, virtual_number, provider_call_ref)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		c.CallID, c.OrderID, c.RiderID, c.InitiatedBy, c.PeerRole, c.Mode, CallStatusRinging,
		c.RoomID, c.VirtualNumber, c.ProviderCallRef)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return Call{}, fmt.Errorf("%w: rider already has an open call", ErrConflict)
		}
		return Call{}, err
	}
	if caller == customerCaller {
		return r.CallByIDForCustomer(ctx, c.OrderID, c.CallID)
	}
	return r.CallByID(ctx, c.RiderID, c.CallID)
}

// CallByIDForCustomer returns a call scoped to the customer's order. Authorisation is the caller's
// order ownership, checked by the handler before this read; the order id keeps the query from
// leaking another rider's call by id alone.
func (r *Repo) CallByIDForCustomer(ctx context.Context, orderID, callID string) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	row := r.pool.QueryRow(ctx, callSelect+` where call_id=$1 and order_id=$2`, callID, orderID)
	return scanCall(row)
}

// DeliveryOrderForCustomer resolves the customer-facing checkout order id to the live dispatch job.
// A customer calls with the id they see in their order detail (`checkout.orders.order_id`), while a
// call row is keyed by the delivery job id (`delivery.delivery_orders.order_id`). Only a job with an
// assigned rider can be called.
func (r *Repo) DeliveryOrderForCustomer(ctx context.Context, customerOrderID string) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	var orderID string
	err := r.pool.QueryRow(ctx, `
		select order_id from delivery.delivery_orders
		 where customer_order_id=$1 and status in ('ASSIGNED','ACCEPTED')
		 order by created_at desc limit 1`, customerOrderID).Scan(&orderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrNotFound
	}
	if err != nil {
		return Order{}, err
	}
	return r.orderByID(ctx, "", orderID)
}

// OpenCallForOrder returns the single open call belonging to a delivery job, whatever the initiator.
// It lets a returning client (either product) resync instead of relying on a rider-scoped lookup.
func (r *Repo) OpenCallForOrder(ctx context.Context, orderID string) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	row := r.pool.QueryRow(ctx, callSelect+`
		 where order_id=$1 and status in ('RINGING','ACTIVE')
		 order by created_at desc limit 1`, orderID)
	return scanCall(row)
}

// SetProviderCallRef records the telephony provider's call id so the status webhook can reconcile
// answer/end. It is written after the provider accepts the bridge, never before.
func (r *Repo) SetProviderCallRef(ctx context.Context, callID, ref string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		update delivery.calls set provider_call_ref=$2, updated_at=now() where call_id=$1`,
		callID, ref)
	return err
}

// CallByProviderRef finds the call a provider webhook refers to. The provider echoes our call id in
// CustomField, but matching the stored ref keeps the webhook authoritative even if it does not.
func (r *Repo) CallByProviderRef(ctx context.Context, ref string) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	row := r.pool.QueryRow(ctx, callSelect+` where provider_call_ref=$1`, ref)
	return scanCall(row)
}

// RiderPhoneForOrder resolves the assigned rider's phone for a delivery job. It exists only for the
// server-side PSTN bridge (the provider needs both legs); the number never reaches a client.
func (r *Repo) RiderPhoneForOrder(ctx context.Context, orderID string) (string, error) {
	if err := r.ready(); err != nil {
		return "", err
	}
	var phone string
	err := r.pool.QueryRow(ctx, `
		select coalesce(b.phone,'')
		  from delivery.delivery_orders o
		  join delivery.delivery_boys b on b.rider_id = o.rider_id
		 where o.order_id=$1`, orderID).Scan(&phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return phone, err
}

// CustomerPhoneForOrder resolves the customer's phone for a delivery job from the DROP stop. It is
// server-only: the value is handed to the telephony provider for the bridge and is never projected
// into a call row or an API response.
func (r *Repo) CustomerPhoneForOrder(ctx context.Context, orderID string) (string, error) {
	if err := r.ready(); err != nil {
		return "", err
	}
	var phone string
	err := r.pool.QueryRow(ctx, `
		select coalesce(customer_phone,'')
		  from delivery.delivery_stops
		 where delivery_order_id=$1 and stop_type='DROP'
		 order by sequence limit 1`, orderID).Scan(&phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return phone, err
}

// CallRiderUserID returns the notification identity of the rider on a delivery job, so the callee
// can be pinged without exposing the rider's phone to the customer.
func (r *Repo) CallRiderUserID(ctx context.Context, orderID string) (string, error) {
	if err := r.ready(); err != nil {
		return "", err
	}
	var userID string
	err := r.pool.QueryRow(ctx, `
		select coalesce(b.user_id,'')
		  from delivery.delivery_orders o
		  join delivery.delivery_boys b on b.rider_id = o.rider_id
		 where o.order_id=$1`, orderID).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return userID, err
}

// CustomerUserIDForOrder returns the checkout owner of a delivery job's customer order, so a
// rider-initiated call can ping the customer without the rider ever seeing their identity.
func (r *Repo) CustomerUserIDForOrder(ctx context.Context, orderID string) (string, error) {
	if err := r.ready(); err != nil {
		return "", err
	}
	var userID string
	err := r.pool.QueryRow(ctx, `
		select coalesce(co.user_id,'')
		  from delivery.delivery_orders o
		  left join checkout.orders co on co.order_id = o.customer_order_id
		 where o.order_id=$1`, orderID).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return userID, err
}

// OpenCallForRider returns the rider's single RINGING/ACTIVE call. It is used before provisioning a
// provider room (so a conflicting request cannot leak a room) and by the resume endpoint so a client
// that lost its call id after a crash can recover instead of being locked out.
func (r *Repo) OpenCallForRider(ctx context.Context, riderID string) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	row := r.pool.QueryRow(ctx, callSelect+`
		 where rider_id=$1 and status in ('RINGING','ACTIVE')
		 order by created_at desc limit 1`, riderID)
	return scanCall(row)
}

// CallByID returns a call scoped to its rider.
func (r *Repo) CallByID(ctx context.Context, riderID, callID string) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	row := r.pool.QueryRow(ctx, callSelect+` where call_id=$1 and rider_id=$2`, callID, riderID)
	return scanCall(row)
}

// AckCallRinging records the callee's <3s delivery receipt without changing status.
func (r *Repo) AckCallRinging(ctx context.Context, riderID, callID string) (Call, error) {
	return r.transition(ctx, riderID, callID,
		`update delivery.calls set ringing_ack_at=coalesce(ringing_ack_at, now()), updated_at=now()
		  where call_id=$1 and rider_id=$2 and status='RINGING' returning `+callColumns,
		"ringing acknowledgement is only valid while the call is ringing")
}

// AcceptCall moves a ringing call to ACTIVE.
func (r *Repo) AcceptCall(ctx context.Context, riderID, callID string) (Call, error) {
	return r.transition(ctx, riderID, callID,
		`update delivery.calls set status='ACTIVE', accepted_at=now(), updated_at=now()
		  where call_id=$1 and rider_id=$2 and status='RINGING' returning `+callColumns,
		"only a ringing call can be accepted")
}

// RejectCall ends an open call. A "busy" reason is recorded as BUSY so the caller/ops can tell a
// second-call rejection from an explicit decline.
func (r *Repo) RejectCall(ctx context.Context, riderID, callID, reason string) (Call, error) {
	status := CallStatusRejected
	if strings.EqualFold(strings.TrimSpace(reason), "busy") {
		status = CallStatusBusy
	}
	return r.transition(ctx, riderID, callID,
		`update delivery.calls
		    set status=$4::delivery_call_status, ended_at=now(), end_reason=$3, updated_at=now()
		  where call_id=$1 and rider_id=$2 and status in ('RINGING','ACTIVE') returning `+callColumns,
		"only an open call can be rejected", reason, status)
}

// EndCall ends an open call as ENDED.
func (r *Repo) EndCall(ctx context.Context, riderID, callID, reason string) (Call, error) {
	return r.transition(ctx, riderID, callID,
		`update delivery.calls set status='ENDED', ended_at=now(), end_reason=$3, updated_at=now()
		  where call_id=$1 and rider_id=$2 and status in ('RINGING','ACTIVE') returning `+callColumns,
		"only an open call can be ended", reason)
}

// SwitchCallToPSTN moves a VOIP call onto the masked PSTN leg (ringing or already active).
func (r *Repo) SwitchCallToPSTN(ctx context.Context, riderID, callID, virtualNumber string) (Call, error) {
	return r.transition(ctx, riderID, callID,
		`update delivery.calls
		    set mode='PSTN_BRIDGING', provider_room_id='', virtual_number=$3, updated_at=now()
		  where call_id=$1 and rider_id=$2 and status in ('RINGING','ACTIVE') and mode='VOIP'
		  returning `+callColumns,
		"only an open VOIP call can switch to PSTN", virtualNumber)
}

// --- call-id-scoped lifecycle ------------------------------------------------------------------
//
// The customer is not the rider, so the rider-scoped transitions above cannot serve the customer
// app, and a provider webhook has no session identity at all. These statements key on the call id
// alone. Callers must authorise the call first: the customer handlers prove order ownership, and the
// PSTN webhook proves the shared URL token. They are never mounted without one of those gates.

// JoinCallByID accepts a call reached by its id — the customer answering a rider-initiated call, or
// the customer re-attaching to a ring it started. It must move the row to ACTIVE, exactly like
// AcceptCall/AcceptCallByID: leaving it RINGING would let the sweep mark a live call MISSED after the
// ring TTL while both peers are still connected.
func (r *Repo) JoinCallByID(ctx context.Context, callID string) (Call, error) {
	return r.transitionByCall(ctx, callID,
		`update delivery.calls
		    set status='ACTIVE', accepted_at=coalesce(accepted_at, now()), updated_at=now()
		  where call_id=$1 and status in ('RINGING','ACTIVE') returning `+callColumns,
		"only an open call can be joined")
}

// RejectCallByID ends a customer-initiated call the customer cancels or the rider declines.
func (r *Repo) RejectCallByID(ctx context.Context, callID, reason string) (Call, error) {
	status := CallStatusRejected
	if strings.EqualFold(strings.TrimSpace(reason), "busy") {
		status = CallStatusBusy
	}
	return r.transitionByCall(ctx, callID,
		`update delivery.calls
		    set status=$3::delivery_call_status, ended_at=now(), end_reason=$2, updated_at=now()
		  where call_id=$1 and status in ('RINGING','ACTIVE') returning `+callColumns,
		"only an open call can be rejected", reason, status)
}

// EndCallByID ends a customer-initiated call as ENDED.
func (r *Repo) EndCallByID(ctx context.Context, callID, reason string) (Call, error) {
	return r.transitionByCall(ctx, callID,
		`update delivery.calls set status='ENDED', ended_at=now(), end_reason=$2, updated_at=now()
		  where call_id=$1 and status in ('RINGING','ACTIVE') returning `+callColumns,
		"only an open call can be ended", reason)
}

// AckCallRingingByID records the rider device's delivery receipt for a customer-initiated call.
func (r *Repo) AckCallRingingByID(ctx context.Context, callID string) (Call, error) {
	return r.transitionByCall(ctx, callID,
		`update delivery.calls set ringing_ack_at=coalesce(ringing_ack_at, now()), updated_at=now()
		  where call_id=$1 and status='RINGING' returning `+callColumns,
		"ringing acknowledgement is only valid while the call is ringing")
}

// SwitchCallToPSTNByID moves a customer-initiated VOIP call onto the masked PSTN leg.
func (r *Repo) SwitchCallToPSTNByID(ctx context.Context, callID, virtualNumber string) (Call, error) {
	return r.transitionByCall(ctx, callID,
		`update delivery.calls
		    set mode='PSTN_BRIDGING', provider_room_id='', virtual_number=$2, updated_at=now()
		  where call_id=$1 and status in ('RINGING','ACTIVE') and mode='VOIP'
		  returning `+callColumns,
		"only an open VOIP call can switch to PSTN", virtualNumber)
}

// transitionByCall runs a call-id-only update for a caller already authorised by order ownership.
func (r *Repo) transitionByCall(ctx context.Context, callID, query, conflictMsg string, args ...any) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	full := []any{callID}
	full = append(full, args...)
	c, err := scanCall(r.pool.QueryRow(ctx, query, full...))
	if errors.Is(err, ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
		if _, getErr := r.CallByIDUnscoped(ctx, callID); errors.Is(getErr, ErrNotFound) {
			return Call{}, ErrNotFound
		}
		return Call{}, fmt.Errorf("%w: %s", ErrConflict, conflictMsg)
	}
	return c, err
}

// CallByIDUnscoped reads a call without a rider scope. It exists only for the ownership-gated
// customer path and for provider-webhook reconciliation; it is never exposed directly.
func (r *Repo) CallByIDUnscoped(ctx context.Context, callID string) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	row := r.pool.QueryRow(ctx, callSelect+` where call_id=$1`, callID)
	return scanCall(row)
}

// AcceptCallByID moves a ringing call to ACTIVE regardless of who initiated it. It is used only by the
// provider webhook, where the telephony provider — not a client — is the authoritative answer signal.
func (r *Repo) AcceptCallByID(ctx context.Context, callID string) (Call, error) {
	return r.transitionByCall(ctx, callID,
		`update delivery.calls set status='ACTIVE', accepted_at=coalesce(accepted_at, now()), updated_at=now()
		  where call_id=$1 and status in ('RINGING','ACTIVE') returning `+callColumns,
		"only an open call can be answered")
}

// SweepOpenCalls closes calls that can no longer be live. A RINGING row older than ringTTL is MISSED
// (nobody answered / the push never landed); an ACTIVE row past activeTTL is ENDED. Without this, a
// killed app or a lost network leaves an open row that the one-open-call index treats as permanent,
// locking the rider out of every later call.
func (r *Repo) SweepOpenCalls(ctx context.Context, ringTTL, activeTTL time.Duration) (int64, error) {
	if err := r.ready(); err != nil {
		return 0, err
	}
	tag, err := r.pool.Exec(ctx, `
		update delivery.calls
		   set status = case when status='RINGING' then 'MISSED'::delivery_call_status
		                     else 'ENDED'::delivery_call_status end,
		       ended_at = now(),
		       end_reason = case when status='RINGING' then 'ring_timeout' else 'max_duration' end,
		       updated_at = now()
		 where (status='RINGING' and created_at < now() - make_interval(secs => $1))
		    or (status='ACTIVE' and coalesce(accepted_at, created_at) < now() - make_interval(secs => $2))`,
		ringTTL.Seconds(), activeTTL.Seconds())
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// transition runs an update-scoped statement and reports a conflict when the state moved on.
func (r *Repo) transition(ctx context.Context, riderID, callID, query, conflictMsg string, args ...any) (Call, error) {
	if err := r.ready(); err != nil {
		return Call{}, err
	}
	full := []any{callID, riderID}
	// The statements take $3 for the reason/number when present.
	for _, a := range args {
		full = append(full, a)
	}
	row := r.pool.QueryRow(ctx, query, full...)
	c, err := scanCall(row)
	if errors.Is(err, ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
		// Distinguish a missing call from a stale state, so callers get 404 rather than a blind 409.
		if _, getErr := r.CallByID(ctx, riderID, callID); errors.Is(getErr, ErrNotFound) {
			return Call{}, ErrNotFound
		}
		return Call{}, fmt.Errorf("%w: %s", ErrConflict, conflictMsg)
	}
	return c, err
}

const callColumns = `call_id, order_id, rider_id, initiated_by, peer_role, mode::text, status::text,
	provider_room_id, virtual_number, provider_call_ref, ringing_ack_at, accepted_at, ended_at,
	end_reason, created_at, updated_at`

const callSelect = `select ` + callColumns + ` from delivery.calls`

type callScanner interface {
	Scan(dest ...any) error
}

func scanCall(row callScanner) (Call, error) {
	var c Call
	var ringingAck, accepted, ended *time.Time
	var created, updated time.Time
	if err := row.Scan(&c.CallID, &c.OrderID, &c.RiderID, &c.InitiatedBy, &c.PeerRole, &c.Mode,
		&c.Status, &c.RoomID, &c.VirtualNumber, &c.ProviderCallRef, &ringingAck, &accepted, &ended,
		&c.EndReason, &created, &updated); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Call{}, ErrNotFound
		}
		return Call{}, err
	}
	c.RingingAckAt = iso(ringingAck)
	c.AcceptedAt = iso(accepted)
	c.EndedAt = iso(ended)
	c.CreatedAt = created.UTC().Format(time.RFC3339)
	c.UpdatedAt = updated.UTC().Format(time.RFC3339)
	c.Bridged = c.Mode == CallModePSTN && c.ProviderCallRef != ""
	return c, nil
}
