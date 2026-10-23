package settlement

import (
	"context"
	"testing"
	"time"

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
		SellerID: sellerID, Cycle: "2026-01", OrderValue: 1000, Commission: 80, TCS: 10, TDS: 1,
		ProductTax: 48, PlatformGST: 14, NetPayout: 909,
	}); err != nil {
		t.Fatalf("AddLedgerEntry: %v", err)
	}
	entries, err := repo.Ledger(ctx, sellerID, "2026-01")
	if err != nil || len(entries) != 1 {
		t.Fatalf("Ledger: err=%v n=%d", err, len(entries))
	}
	e := entries[0]
	if e.OrderValue != 1000 || e.Commission != 80 || e.TCS != 10 || e.TDS != 1 ||
		e.ProductTax != 48 || e.PlatformGST != 14 || e.NetPayout != 909 {
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

func TestHoldLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-hold-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Hold Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	due := time.Now().UTC().Add(-time.Minute)
	held, err := repo.CreateHoldPayout(ctx, Payout{
		SellerID: sellerID, Cycle: "2026-01", Amount: 900,
		ReleaseAfter: due.Format(time.RFC3339), RazorpayTransferID: "trf-" + shortID(),
	})
	if err != nil || held.Status != "ON_HOLD" {
		t.Fatalf("CreateHoldPayout: err=%v p=%+v", err, held)
	}
	dueHolds, err := repo.DueHolds(ctx, time.Now().UTC(), 100)
	if err != nil {
		t.Fatalf("DueHolds: %v", err)
	}
	found := false
	for _, p := range dueHolds {
		if p.PayoutID == held.PayoutID {
			found = true
		}
	}
	if !found {
		t.Fatalf("held payout %s not due", held.PayoutID)
	}

	paid, moved, err := repo.MarkReleasedByTransfer(ctx, held.RazorpayTransferID)
	if err != nil || !moved || paid.Status != "PAID" || paid.ReleasedAt == "" {
		t.Fatalf("MarkReleasedByTransfer: moved=%v err=%v p=%+v", moved, err, paid)
	}
	if _, moved, err := repo.MarkReleasedByTransfer(ctx, held.RazorpayTransferID); err != nil || moved {
		t.Fatalf("release must be idempotent: moved=%v err=%v", moved, err)
	}

	reversed, moved, err := repo.ReversePayout(ctx, paid.PayoutID)
	if err != nil || !moved || reversed.Status != "REVERSED" || reversed.ReversedAt == "" {
		t.Fatalf("ReversePayout: moved=%v err=%v p=%+v", moved, err, reversed)
	}

	failed, err := repo.CreateHoldPayout(ctx, Payout{
		SellerID: sellerID, Cycle: "2026-02", Amount: 100,
		ReleaseAfter: due.Format(time.RFC3339), RazorpayTransferID: "trf-fail-" + shortID(),
	})
	if err != nil {
		t.Fatalf("CreateHoldPayout(fail): %v", err)
	}
	if got, moved, err := repo.MarkFailedByTransfer(ctx, failed.RazorpayTransferID); err != nil || !moved || got.Status != "FAILED" {
		t.Fatalf("MarkFailedByTransfer: moved=%v err=%v p=%+v", moved, err, got)
	}
}
