package notifications

import (
	"context"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// deadTokenSender always reports a permanently-dead token, as FCM does for a revoked/rotated token
// (UNREGISTERED).
type deadTokenSender struct{}

// Send never logs the token; it only reports that the token can no longer accept pushes.
func (deadTokenSender) Send(_ context.Context, _, _, _ string, _ []byte) error {
	return ErrTokenUnregistered
}

// Integration: an FCM UNREGISTERED response expires the outbox row (terminal, next_attempt_at null)
// and prunes the dead token from push_tokens atomically (drain worker → repo.ExpireToken). A dead
// token must not burn the retry budget nor rejoin future drains.
func TestDrainExpiresUnregisteredToken(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, nil)
	ctx := context.Background()
	const userID = "notif-dead-token-test-user"
	const token = "notif-dead-device-token"

	// notifications.outbox.user_id references checkout.users (user_id), so the test seeds its own
	// parent row and removes every trace on the way out (same convention as repo_retry_test.go).
	if _, err := pool.Exec(ctx, `
		insert into checkout.users (user_id, name, email, phone)
		values ($1, 'Notification Dead-Token Test', 'notif-dead-token@faazio.in', '9999999998')
		on conflict (user_id) do nothing`, userID); err != nil {
		t.Fatalf("seed checkout.user: %v", err)
	}
	if err := repo.Register(ctx, userID, token, "android"); err != nil {
		t.Fatalf("Register: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, `delete from notifications.push_tokens where user_id = $1`, userID)
		_, _ = pool.Exec(ctx, `delete from notifications.outbox where user_id = $1`, userID)
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, userID)
	}()

	if err := repo.Enqueue(ctx, userID, "ORDER_SHIPPED", "Shipped", "On the way", nil); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	rows, err := repo.Pending(ctx, 10)
	if err != nil {
		t.Fatalf("Pending: %v", err)
	}
	if len(rows) != 1 || rows[0].Token != token {
		t.Fatalf("expected 1 drainable row for the seeded token, got %d rows", len(rows))
	}
	id := rows[0].ID

	w := NewWorker(repo, deadTokenSender{}, nil)
	if err := w.DrainOnce(ctx); err != nil {
		t.Fatalf("DrainOnce: %v", err)
	}

	var attempts int
	var next *time.Time
	if err := pool.QueryRow(ctx,
		`select attempts, next_attempt_at from notifications.outbox where id = $1`, id).Scan(&attempts, &next); err != nil {
		t.Fatalf("read back outbox: %v", err)
	}
	if next != nil {
		t.Fatalf("dead-token row must be terminal (next_attempt_at null), got %v", next)
	}
	if attempts != MaxDeliveryAttempts {
		t.Fatalf("expected attempts exhausted (%d), got %d", MaxDeliveryAttempts, attempts)
	}

	var count int
	if err := pool.QueryRow(ctx,
		`select count(*) from notifications.push_tokens where token = $1`, token).Scan(&count); err != nil {
		t.Fatalf("count tokens: %v", err)
	}
	if count != 0 {
		t.Fatalf("dead token must be pruned from push_tokens, %d row(s) remain", count)
	}

	left, err := repo.Pending(ctx, 10)
	if err != nil {
		t.Fatalf("Pending after prune: %v", err)
	}
	for _, m := range left {
		if m.ID == id || m.Token == token {
			t.Fatal("expired row/token must not rejoin the drain")
		}
	}
}