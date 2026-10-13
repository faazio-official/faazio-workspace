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