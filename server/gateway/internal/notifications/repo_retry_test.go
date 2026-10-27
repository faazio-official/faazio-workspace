package notifications

import (
	"context"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// Integration: the drain worker's retry policy (0058). An enqueued row is PENDING and drainable; a
// failed delivery records attempts and schedules next_attempt_at (capped backoff); a FAILED row is
// re-drainable once its window opens; exhausting the budget makes it terminal (never drained again).
func TestOutboxRetryBackoffAndTerminal(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, nil)
	ctx := context.Background()
	const userID = "notif-retry-test-user"
	const token = "notif-retry-device-token"

	if err := repo.Register(ctx, userID, token, "android"); err != nil {
		t.Fatalf("Register: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, `delete from notifications.push_tokens where user_id = $1`, userID)
		_, _ = pool.Exec(ctx, `delete from notifications.outbox where user_id = $1`, userID)
	}()

	if err := repo.Enqueue(ctx, userID, "ORDER_SHIPPED", "Shipped", "On the way", nil); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}

	rows, err := repo.Pending(ctx, 10)
	if err != nil {
		t.Fatalf("Pending: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 drainable row, got %d", len(rows))
	}
	id := rows[0].ID

	// First failure: attempts=1 and a scheduled (future) next_attempt_at.
	if err := repo.MarkFailed(ctx, id); err != nil {
		t.Fatalf("MarkFailed: %v", err)
	}
	var attempts int
	var next *time.Time
	if err := pool.QueryRow(ctx,
		`select attempts, next_attempt_at from notifications.outbox where id = $1`, id).Scan(&attempts, &next); err != nil {
		t.Fatalf("read back after fail: %v", err)
	}
	if attempts != 1 || next == nil {
		t.Fatalf("expected attempts=1 and scheduled next_attempt_at, got attempts=%d next=%v", attempts, next)
	}

	// A FAILED row becomes drainable again once its retry window opens.
	if _, err := pool.Exec(ctx,
		`update notifications.outbox set next_attempt_at = now() - interval '1 second' where id = $1`, id); err != nil {
		t.Fatalf("open retry window: %v", err)
	}
	again, err := repo.Pending(ctx, 10)
	if err != nil {
		t.Fatalf("Pending after window: %v", err)
	}
	if len(again) != 1 || again[0].ID != id {
		t.Fatalf("expected the FAILED row back in the drain, got %d rows", len(again))
	}

	// Exhaust the retry budget: attempts hit the cap, next_attempt_at becomes null (terminal), and
	// the row drops out of future drains.
	for i := 0; i < MaxDeliveryAttempts; i++ {
		if err := repo.MarkFailed(ctx, id); err != nil {
			t.Fatalf("MarkFailed #%d: %v", i+2, err)
		}
	}
	var terminal *time.Time
	if err := pool.QueryRow(ctx,
		`select next_attempt_at from notifications.outbox where id = $1`, id).Scan(&terminal); err != nil {
		t.Fatalf("read back terminal: %v", err)
	}
	if terminal != nil {
		t.Fatalf("expected terminal row (next_attempt_at null), got %v", terminal)
	}
	left, err := repo.Pending(ctx, 10)
	if err != nil {
		t.Fatalf("Pending after budget: %v", err)
	}
	if len(left) != 0 {
		t.Fatalf("terminal row must not be re-drainable, got %d rows", len(left))
	}
}