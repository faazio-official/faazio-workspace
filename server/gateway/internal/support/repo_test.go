package support

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestTicketsAndReturns(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	var orderID, userID string
	if err := pool.QueryRow(ctx, `select order_id, user_id from checkout.orders limit 1`).Scan(&orderID, &userID); err != nil {
		t.Skipf("no seeded order to attach a return to: %v", err)
	}

	tk, err := repo.CreateTicket(ctx, Ticket{UserID: userID, Subject: "Late delivery", Body: "Order arrived late."})
	if err != nil {
		t.Fatalf("CreateTicket: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from support.tickets where ticket_id=$1`, tk.TicketID) })
	if tk.Status != "OPEN" {
		t.Fatalf("ticket status = %q, want OPEN", tk.Status)
	}
	if closed, ok, err := repo.SetTicketStatus(ctx, tk.TicketID, "RESOLVED"); err != nil || !ok || closed.Status != "RESOLVED" {
		t.Fatalf("SetTicketStatus: ok=%v err=%v status=%q", ok, err, closed.Status)
	}

	ret, err := repo.CreateReturn(ctx, Return{OrderID: orderID, UserID: userID, Reason: "Damaged item"})
	if err != nil {
		t.Fatalf("CreateReturn: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.returns where return_id=$1`, ret.ReturnID) })
	if ret.Status != "REQUESTED" {
		t.Fatalf("return status = %q, want REQUESTED", ret.Status)
	}
	if approved, ok, err := repo.SetReturnStatus(ctx, ret.ReturnID, "APPROVED"); err != nil || !ok || approved.Status != "APPROVED" {
		t.Fatalf("SetReturnStatus: ok=%v err=%v status=%q", ok, err, approved.Status)
	}
	list, err := repo.Returns(ctx, "", userID, "")
	if err != nil || len(list) == 0 {
		t.Fatalf("Returns: err=%v n=%d", err, len(list))
	}
}

func TestTicketsStateFilter(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	tk, err := repo.CreateTicket(ctx, Ticket{Subject: "State queue", Body: "Needs a state admin."})
	if err != nil {
		t.Fatalf("CreateTicket: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from support.tickets where ticket_id=$1`, tk.TicketID) })
	if _, err := pool.Exec(ctx, `update support.tickets set state_code='KA' where ticket_id=$1`, tk.TicketID); err != nil {
		t.Fatalf("tag state: %v", err)
	}

	ka, err := repo.Tickets(ctx, "", "", "KA")
	if err != nil {
		t.Fatalf("Tickets KA: %v", err)
	}
	seen := false
	for _, t2 := range ka {
		if t2.TicketID == tk.TicketID {
			if t2.StateCode != "KA" {
				t.Fatalf("state code not projected: %+v", t2)
			}
			seen = true
		}
	}
	if !seen {
		t.Fatal("KA ticket missing from the state queue")
	}
	dl, err := repo.Tickets(ctx, "", "", "DL")
	if err != nil {
		t.Fatalf("Tickets DL: %v", err)
	}
	for _, t2 := range dl {
		if t2.TicketID == tk.TicketID {
			t.Fatal("state filter leaked a KA ticket into DL")
		}
	}
}
