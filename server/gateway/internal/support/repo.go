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

// Tickets lists tickets scoped by user and/or seller.
func (r *Repo) Tickets(ctx context.Context, userID, sellerID string) ([]Ticket, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("support: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select ticket_id, coalesce(user_id,''), coalesce(seller_id,''), subject, body, status::text, created_at
		  from support.tickets
		 where ($1 = '' or user_id = $1) and ($2 = '' or seller_id = $2)
		 order by created_at desc`, userID, sellerID)
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
		if err := rows.Scan(&t.TicketID, &t.UserID, &t.SellerID, &t.Subject, &t.Body, &t.Status, &createdAt); err != nil {
			return nil, err
		}
		t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, t)
	}
	return out, rows.Err()
}

// CreateTicket inserts a ticket.
func (r *Repo) CreateTicket(ctx context.Context, t Ticket) (Ticket, error) {
	if r.pool == nil {
		return Ticket{}, fmt.Errorf("support: database not configured")
	}
	t.TicketID = "tkt-" + shortID()
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into support.tickets (ticket_id, user_id, seller_id, subject, body)
		values ($1,$2,$3,$4,$5)
		returning status::text, created_at`,
		t.TicketID, nullIfEmpty(t.UserID), nullIfEmpty(t.SellerID), t.Subject, t.Body).
		Scan(&t.Status, &createdAt)
	if err != nil {
		return Ticket{}, err
	}
	t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return t, nil
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

// Returns lists returns scoped by seller and/or user.
func (r *Repo) Returns(ctx context.Context, sellerID, userID string) ([]Return, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("support: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select return_id, order_id, user_id, coalesce(seller_id,''), reason, status::text, created_at
		  from checkout.returns
		 where ($1 = '' or seller_id = $1) and ($2 = '' or user_id = $2)
		 order by created_at desc`, sellerID, userID)
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
