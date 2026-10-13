package settlement

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestSettlementAndPayouts(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-set-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Settle Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	// Rupees in -> paisa in the DB -> rupees out (round-trip, no float).
	if _, err := repo.AddLedgerEntry(ctx, LedgerEntry{
		SellerID: sellerID, Cycle: "2026-01", OrderValue: 1000, Commission: 80, TCS: 10, NetPayout: 910,
	}); err != nil {
		t.Fatalf("AddLedgerEntry: %v", err)
	}
	entries, err := repo.Ledger(ctx, sellerID, "2026-01")
	if err != nil || len(entries) != 1 {
		t.Fatalf("Ledger: err=%v n=%d", err, len(entries))
	}
	e := entries[0]
	if e.OrderValue != 1000 || e.Commission != 80 || e.TCS != 10 || e.NetPayout != 910 {
		t.Fatalf("paisa/rupee round-trip drifted: %+v", e)
	}

	p, err := repo.CreatePayout(ctx, Payout{SellerID: sellerID, Cycle: "2026-01", Amount: 910, ScheduledFor: "2026-02-01T00:00:00Z"})
	if err != nil || p.Amount != 910 || p.Status != "SCHEDULED" {
		t.Fatalf("CreatePayout: err=%v p=%+v", err, p)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from payments.settlement_ledger where seller_id=$1`, sellerID) })
	payouts, err := repo.Payouts(ctx, sellerID)
	if err != nil || len(payouts) != 1 {
		t.Fatalf("Payouts: err=%v n=%d", err, len(payouts))
	}
}
