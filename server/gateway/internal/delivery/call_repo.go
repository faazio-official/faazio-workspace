package delivery

import (
	"context"
	"errors"
	"fmt"
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
	RingingAckAt  string `json:"ringingAckAt,omitempty"`
	AcceptedAt    string `json:"acceptedAt,omitempty"`
	EndedAt       string `json:"endedAt,omitempty"`
	EndReason     string `json:"endReason,omitempty"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
	// FallbackAvailable is true when a VOIP call is still ringing past the ack window, so the client
	// may offer (or the server may switch to) the masked PSTN leg.
	FallbackAvailable bool `json:"fallbackAvailable"`
	// FallbackAfterSeconds is the ack window the server applies.
	FallbackAfterSeconds int `json:"fallbackAfterSeconds"`
}

// CreateCall persists a new ringing call. It refuses when the rider already has an open call; the
// partial unique index is the final guard against a concurrent double-room.
func (r *Repo) CreateCall(ctx context.Context, c Call) (Call, error) {
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
		   provider_room_id, virtual_number)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		c.CallID, c.OrderID, c.RiderID, c.InitiatedBy, c.PeerRole, c.Mode, CallStatusRinging,
		c.RoomID, c.VirtualNumber)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return Call{}, fmt.Errorf("%w: rider already has an open call", ErrConflict)
		}
		return Call{}, err
	}
	return r.CallByID(ctx, c.RiderID, c.CallID)
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

// RejectCall ends an open call as REJECTED.
func (r *Repo) RejectCall(ctx context.Context, riderID, callID, reason string) (Call, error) {
	return r.transition(ctx, riderID, callID,
		`update delivery.calls set status='REJECTED', ended_at=now(), end_reason=$3, updated_at=now()
		  where call_id=$1 and rider_id=$2 and status in ('RINGING','ACTIVE') returning `+callColumns,
		"only an open call can be rejected", reason)
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
	provider_room_id, virtual_number, ringing_ack_at, accepted_at, ended_at, end_reason,
	created_at, updated_at`

const callSelect = `select ` + callColumns + ` from delivery.calls`

type callScanner interface {
	Scan(dest ...any) error
}

func scanCall(row callScanner) (Call, error) {
	var c Call
	var ringingAck, accepted, ended *time.Time
	var created, updated time.Time
	if err := row.Scan(&c.CallID, &c.OrderID, &c.RiderID, &c.InitiatedBy, &c.PeerRole, &c.Mode,
		&c.Status, &c.RoomID, &c.VirtualNumber, &ringingAck, &accepted, &ended, &c.EndReason,
		&created, &updated); err != nil {
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
	return c, nil
}
