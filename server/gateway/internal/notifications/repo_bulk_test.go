package notifications

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// Integration: EnqueueMany is the bulk broadcast path used by a public blood-request post. Three
// properties are load-bearing and each is asserted here, because getting any of them wrong is
// invisible in a single-user test but damaging in production:
//
//   - a recipient with no `push` token gets no row (Pending() joins push_tokens, so such a row
//     would sit PENDING forever and widen every later outbox scan);
//   - a `voip`-only token is not treated as deliverable for an alert (only a push token can carry
//     a board nudge);
//   - the batch is capped, so a broadcast can never queue unbounded rows ahead of ring pushes in
//     the shared FIFO.
func TestEnqueueManySkipsUndeliverableAndCaps(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, nil)
	ctx := context.Background()

	const (
		reachable   = "notif-bulk-reachable"
		tokenless   = "notif-bulk-tokenless"
		voipOnly    = "notif-bulk-voip-only"
		phoneSuffix = "9999999999"
	)

	for _, userID := range []string{reachable, tokenless, voipOnly} {
		if _, err := pool.Exec(ctx, `
			insert into checkout.users (user_id, name, email, phone)
			values ($1, 'Notification Bulk Test', $2, $3)
			on conflict (user_id) do nothing`, userID, userID+"@faazio.in", phoneSuffix); err != nil {
			t.Fatalf("seed checkout.user %s: %v", userID, err)
		}
	}
	defer func() {
		_, _ = pool.Exec(ctx, `delete from notifications.push_tokens where user_id = any($1)`,
			[]string{reachable, tokenless, voipOnly})
		_, _ = pool.Exec(ctx, `delete from notifications.outbox where user_id = any($1)`,
			[]string{reachable, tokenless, voipOnly})
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = any($1)`,
			[]string{reachable, tokenless, voipOnly})
	}()

	if err := repo.Register(ctx, reachable, "bulk-reachable-token", "android", TokenKindPush); err != nil {
		t.Fatalf("Register reachable: %v", err)
	}
	// tokenless: no push_tokens row at all. voipOnly: a PushKit token only.
	if err := repo.Register(ctx, voipOnly, "bulk-voip-token", "ios", TokenKindVoIP); err != nil {
		t.Fatalf("Register voip: %v", err)
	}

	data := map[string]any{"kind": "BLOOD_REQUEST_NEW"}
	if err := repo.EnqueueMany(ctx,
		[]string{reachable, tokenless, voipOnly},
		"BLOOD_REQUEST_NEW", "A new blood request needs donors", "Open the board.", data,
	); err != nil {
		t.Fatalf("EnqueueMany: %v", err)
	}

	count := func(userID string) int {
		t.Helper()
		var n int
		if err := pool.QueryRow(ctx,
			`select count(*) from notifications.outbox where user_id = $1`, userID).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", userID, err)
		}
		return n
	}

	if got := count(reachable); got != 1 {
		t.Errorf("reachable donor rows = %d, want 1", got)
	}
	if got := count(tokenless); got != 0 {
		t.Errorf("tokenless donor rows = %d, want 0 (would never drain)", got)
	}
	if got := count(voipOnly); got != 0 {
		t.Errorf("voip-only donor rows = %d, want 0 (an alert cannot use a PushKit token)", got)
	}
}

// Integration: the cap bounds one broadcast, so a single post cannot queue an unbounded batch ahead
// of incoming_call ring pushes in the shared outbox FIFO.
func TestEnqueueManyCapsRecipients(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, nil)
	ctx := context.Background()

	const userID = "notif-bulk-cap-user"
	if _, err := pool.Exec(ctx, `
		insert into checkout.users (user_id, name, email, phone)
		values ($1, 'Notification Cap Test', 'notif-bulk-cap@faazio.in', '9999999999')
		on conflict (user_id) do nothing`, userID); err != nil {
		t.Fatalf("seed checkout.user: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, `delete from notifications.push_tokens where user_id = $1`, userID)
		_, _ = pool.Exec(ctx, `delete from notifications.outbox where user_id = $1`, userID)
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, userID)
	}()

	if err := repo.Register(ctx, userID, "bulk-cap-token", "android", TokenKindPush); err != nil {
		t.Fatalf("Register: %v", err)
	}

	// Duplicate ids stand in for an oversized broadcast; the statement inserts per unnested row, so
	// the cap (not uniqueness) is what this measures.
	recipients := make([]string, maxEnqueueMany+25)
	for i := range recipients {
		recipients[i] = userID
	}
	if err := repo.EnqueueMany(ctx, recipients, "BLOOD_REQUEST_NEW", "t", "b", nil); err != nil {
		t.Fatalf("EnqueueMany: %v", err)
	}

	var n int
	if err := pool.QueryRow(ctx,
		`select count(*) from notifications.outbox where user_id = $1`, userID).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n > maxEnqueueMany {
		t.Errorf("rows = %d, want <= %d (cap)", n, maxEnqueueMany)
	}
}
