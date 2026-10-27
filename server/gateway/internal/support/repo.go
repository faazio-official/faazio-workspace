// Package support owns partner support tickets (support.tickets) and order returns
// (checkout.returns, migration 0015). Future service: Go + Postgres (monolith-breakdown.md §1).
// Customers raise their own; sellers/admins handle. Every status change is audited.
package support

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Ticket is one support.tickets row.
type Ticket struct {
	TicketID  string `json:"ticketId"`
	UserID    string `json:"userId,omitempty"`
	SellerID  string `json:"sellerId,omitempty"`
	StateCode string `json:"stateCode,omitempty"`
	Subject   string `json:"subject"`
	Body      string `json:"body"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

// Return is one checkout.returns row.
type Return struct {
	ReturnID  string `json:"returnId"`
	OrderID   string `json:"orderId"`
	UserID    string `json:"userId"`
	SellerID  string `json:"sellerId,omitempty"`
	Reason    string `json:"reason"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

// Repo reads/writes support.tickets + checkout.returns.
type Repo struct {
	pool *db.Pool
}

// New returns a support repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// Tickets lists tickets scoped by user, seller and/or state (empty = all).
func (r *Repo) Tickets(ctx context.Context, userID, sellerID, stateCode string) ([]Ticket, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("support: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select ticket_id, coalesce(user_id,''), coalesce(seller_id,''), coalesce(state_code,''),
		       subject, body, status::text, created_at
		  from support.tickets
		 where ($1 = '' or user_id = $1) and ($2 = '' or seller_id = $2) and ($3 = '' or state_code = $3)
		 order by created_at desc`, userID, sellerID, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Ticket{}
	for rows.Next() {
		var (
			t         Ticket
			createdAt time.Time
		)
		if err := rows.Scan(&t.TicketID, &t.UserID, &t.SellerID, &t.StateCode, &t.Subject, &t.Body, &t.Status, &createdAt); err != nil {
			return nil, err
		}
		t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, t)
	}
	return out, rows.Err()
}

// CreateTicket inserts a ticket. The parent state is derived server-side (seller state for a
// partner ticket, latest order's vendor state for a customer ticket) so a district admin's state
// queue actually sees it; a client never supplies this scope.
func (r *Repo) CreateTicket(ctx context.Context, t Ticket) (Ticket, error) {
	if r.pool == nil {
		return Ticket{}, fmt.Errorf("support: database not configured")
	}
	if t.StateCode == "" {
		t.StateCode = r.ticketState(ctx, t.UserID, t.SellerID)
	}
	t.TicketID = "tkt-" + shortID()
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into support.tickets (ticket_id, user_id, seller_id, state_code, subject, body)
		values ($1,$2,$3,$4,$5,$6)
		returning status::text, created_at`,
		t.TicketID, nullIfEmpty(t.UserID), nullIfEmpty(t.SellerID), nullIfEmpty(t.StateCode), t.Subject, t.Body).
		Scan(&t.Status, &createdAt)
	if err != nil {
		return Ticket{}, err
	}
	t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return t, nil
}

// ticketState resolves a ticket's parent state without trusting the caller: the seller's registered
// state when the ticket is seller-scoped, otherwise the state of the customer's most recent order's
// vendor. Empty when neither exists (super-admin-only row).
func (r *Repo) ticketState(ctx context.Context, userID, sellerID string) string {
	if sellerID != "" {
		var state string
		if err := r.pool.QueryRow(ctx, `select coalesce(state_code,'') from sellers.sellers where seller_id = $1`, sellerID).Scan(&state); err == nil {
			return state
		}
		return ""
	}
	if userID != "" {
		var state string
		if err := r.pool.QueryRow(ctx, `
			select coalesce((
				select s.state_code
				  from checkout.orders o
				  join directory.stores s on s.id = any(o.vendor_store_ids)
				 where o.user_id = $1 and coalesce(s.state_code,'') <> ''
				 order by o.placed_at desc limit 1), '')`, userID).Scan(&state); err == nil {
			return state
		}
	}
	return ""
}

// TicketScope returns a ticket's parent state (used to authorize an admin mutation).
func (r *Repo) TicketScope(ctx context.Context, id string) (string, bool, error) {
	if r.pool == nil {
		return "", false, fmt.Errorf("support: database not configured")
	}
	var state string
	err := r.pool.QueryRow(ctx, `select coalesce(state_code,'') from support.tickets where ticket_id = $1`, id).Scan(&state)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	return state, true, nil
}

// ReturnScope returns the parent state of a return's order (used to authorize an admin mutation).
func (r *Repo) ReturnScope(ctx context.Context, id string) (string, bool, error) {
	if r.pool == nil {
		return "", false, fmt.Errorf("support: database not configured")
	}
	var state string
	err := r.pool.QueryRow(ctx, `
		select coalesce((
			select s.state_code
			  from checkout.orders o
			  join directory.stores s on s.id = any(o.vendor_store_ids)
			 where o.order_id = ret.order_id and coalesce(s.state_code,'') <> ''
			 limit 1), '')
		  from checkout.returns ret where ret.return_id = $1`, id).Scan(&state)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	return state, true, nil
}

// OrderReturnScope verifies the caller owns the order and returns its vendor seller + state. Used by
// CreateReturn so a user cannot file a return against another user's order.
func (r *Repo) OrderReturnScope(ctx context.Context, orderID, userID string) (sellerID, stateCode string, ok bool, err error) {
	if r.pool == nil {
		return "", "", false, fmt.Errorf("support: database not configured")
	}
	var owner string
	err = r.pool.QueryRow(ctx, `select user_id from checkout.orders where order_id = $1`, orderID).Scan(&owner)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", false, nil
		}
		return "", "", false, err
	}
	if owner != userID {
		return "", "", false, nil
	}
	err = r.pool.QueryRow(ctx, `
		select coalesce((
		         select s.seller_id from directory.stores s
		          where s.id = any(o.vendor_store_ids) and coalesce(s.seller_id,'') <> ''
		          limit 1), ''),
		       coalesce((
		         select s.state_code from directory.stores s
		          where s.id = any(o.vendor_store_ids) and coalesce(s.state_code,'') <> ''
		          limit 1), '')
		  from checkout.orders o where o.order_id = $1`, orderID).Scan(&sellerID, &stateCode)
	if err != nil {
		return "", "", false, err
	}
	return sellerID, stateCode, true, nil
}

// SetTicketStatus updates a ticket's status.
func (r *Repo) SetTicketStatus(ctx context.Context, id, status string) (Ticket, bool, error) {
	if r.pool == nil {
		return Ticket{}, false, fmt.Errorf("support: database not configured")
	}
	var (
		t         Ticket
		createdAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update support.tickets set status = $2::ticket_status
		 where ticket_id = $1
		 returning ticket_id, coalesce(user_id,''), coalesce(seller_id,''), subject, body, status::text, created_at`,
		id, status).
		Scan(&t.TicketID, &t.UserID, &t.SellerID, &t.Subject, &t.Body, &t.Status, &createdAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Ticket{}, false, nil
		}
		return Ticket{}, false, err
	}
	t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return t, true, nil
}

// Returns lists returns scoped by seller, user and/or parent state.
func (r *Repo) Returns(ctx context.Context, sellerID, userID, stateCode string) ([]Return, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("support: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select return_id, order_id, user_id, coalesce(seller_id,''), reason, status::text, created_at
		  from checkout.returns ret
		 where ($1 = '' or seller_id = $1) and ($2 = '' or user_id = $2)
		   and ($3 = '' or exists (
		         select 1 from checkout.orders o
		          join directory.stores s on s.id = any(o.vendor_store_ids)
		         where o.order_id = ret.order_id and s.state_code = $3))
		 order by created_at desc`, sellerID, userID, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Return{}
	for rows.Next() {
		var (
			r2        Return
			createdAt time.Time
		)
		if err := rows.Scan(&r2.ReturnID, &r2.OrderID, &r2.UserID, &r2.SellerID, &r2.Reason, &r2.Status, &createdAt); err != nil {
			return nil, err
		}
		r2.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, r2)
	}
	return out, rows.Err()
}

// CreateReturn inserts a return request.
func (r *Repo) CreateReturn(ctx context.Context, ret Return) (Return, error) {
	if r.pool == nil {
		return Return{}, fmt.Errorf("support: database not configured")
	}
	ret.ReturnID = "ret-" + shortID()
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into checkout.returns (return_id, order_id, user_id, seller_id, reason)
		values ($1,$2,$3,$4,$5)
		returning status::text, created_at`,
		ret.ReturnID, ret.OrderID, ret.UserID, nullIfEmpty(ret.SellerID), ret.Reason).
		Scan(&ret.Status, &createdAt)
	if err != nil {
		return Return{}, err
	}
	ret.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return ret, nil
}

// SetReturnStatus updates a return's status.
func (r *Repo) SetReturnStatus(ctx context.Context, id, status string) (Return, bool, error) {
	if r.pool == nil {
		return Return{}, false, fmt.Errorf("support: database not configured")
	}
	var (
		ret       Return
		createdAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update checkout.returns set status = $2::return_status
		 where return_id = $1
		 returning return_id, order_id, user_id, coalesce(seller_id,''), reason, status::text, created_at`,
		id, status).
		Scan(&ret.ReturnID, &ret.OrderID, &ret.UserID, &ret.SellerID, &ret.Reason, &ret.Status, &createdAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Return{}, false, nil
		}
		return Return{}, false, err
	}
	ret.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return ret, true, nil
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}
