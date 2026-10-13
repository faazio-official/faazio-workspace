package rewards

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestEarnAndView(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	// Isolated user so the test never mutates seeded rows (balances cascade on user delete).
	const uid = "user-rewards-test"
	if _, err := pool.Exec(ctx, `
		insert into checkout.users (user_id, name, email, phone) values ($1, 'T', 't@t', '0')
		on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed test user: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid) })

	before, err := repo.View(ctx, uid)
	if err != nil {
		t.Fatal(err)
	}
	if before.Coins != 0 {
		t.Fatalf("baseline coins = %d, want 0", before.Coins)
	}

	// ₹2500 paid → 2 coins earned (rate 1000); 10 requested redemptions are clamped to the 0 balance.
	if err := repo.Earn(ctx, uid, "ORD-TEST-REWARDS", 2500, 10); err != nil {
		t.Fatalf("Earn: %v", err)
	}

	after, err := repo.View(ctx, uid)
	if err != nil {
		t.Fatal(err)
	}
	if after.Coins != 2 {
		t.Fatalf("coins = %d, want 2", after.Coins)
	}
	if after.Streak != 1 {
		t.Fatalf("streak = %d, want 1", after.Streak)
	}
	if len(after.Ledger) != 1 || after.Ledger[0].Type != "EARN" || after.Ledger[0].Coins != 2 {
		t.Fatalf("ledger = %+v", after.Ledger)
	}
}

func TestRatesAndLedger(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	orig := repo.Rates(ctx)
	t.Cleanup(func() { _, _ = repo.SetRates(ctx, orig) })

	const uid = "user-rewards-rate-test"
	if _, err := pool.Exec(ctx, `
		insert into checkout.users (user_id, name, email, phone) values ($1, 'T', 't@t', '0')
		on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed test user: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid) })

	// Tune the earn rate to ₹500/coin; a ₹2500 paid order then earns 5 coins.
	if _, err := repo.SetRates(ctx, RateSet{
		CoinEarnRate: 500, CoinRedeemRate: 100, StreakTargetDays: 7,
		DiscountCardPercent: 10, CardValidityDays: 5,
	}); err != nil {
		t.Fatalf("SetRates: %v", err)
	}
	got := repo.Rates(ctx)
	if got.CoinEarnRate != 500 {
		t.Fatalf("Rates echo = %+v, want coinEarnRate 500", got)
	}
	if err := repo.Earn(ctx, uid, "ORD-TEST-RATE", 2500, 0); err != nil {
		t.Fatalf("Earn: %v", err)
	}
	view, err := repo.View(ctx, uid)
	if err != nil {
		t.Fatalf("View: %v", err)
	}
	if view.Coins != 5 {
		t.Fatalf("coins = %d, want 5 at the tuned rate", view.Coins)
	}
	ledger, err := repo.Ledger(ctx, uid, 10)
	if err != nil {
		t.Fatalf("Ledger: %v", err)
	}
	if len(ledger) != 1 || ledger[0].Coins != 5 {
		t.Fatalf("ledger = %+v", ledger)
	}
}