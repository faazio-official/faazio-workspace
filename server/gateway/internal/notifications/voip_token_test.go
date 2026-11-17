package notifications

import (
	"context"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/jackc/pgx/v5/pgxpool"
)

// seedVoipUser inserts the checkout.users parent row the outbox FKs to, registers an FCM token and a
// PushKit token for the same device (migration 0105), and removes every trace afterwards.
func seedVoipUser(t *testing.T, pool *pgxpool.Pool, userID, phone, pushToken, voipToken string) {
	t.Helper()
	ctx := context.Background()
	repo := New(pool, nil)
	if _, err := pool.Exec(ctx, `
		insert into checkout.users (user_id, name, email, phone)
		values ($1, 'VoIP Token Test', $2, $3)
		on conflict (user_id) do nothing`, userID, userID+"@faazio.in", phone); err != nil {
		t.Fatalf("seed checkout.user: %v", err)
	}
	if err := repo.Register(ctx, userID, pushToken, "android", TokenKindPush); err != nil {
		t.Fatalf("Register push: %v", err)
	}
	if err := repo.Register(ctx, userID, voipToken, "ios", TokenKindVoIP); err != nil {
		t.Fatalf("Register voip: %v", err)
	}
	t.Cleanup(func() {
		for _, q := range []string{
			`delete from notifications.push_tokens where user_id = $1`,
			`delete from notifications.outbox where user_id = $1`,
			`delete from checkout.users where user_id = $1`,
		} {
			_, _ = pool.Exec(ctx, q, userID)
		}
	})
}

// drainableFor returns the drainable row of one user. It filters by user id instead of counting the
// batch, so an unrelated PENDING row elsewhere in a shared database cannot break the assertion.
func drainableFor(t *testing.T, repo *Repo, ctx context.Context, preferVoIP bool, userID string) PendingMessage {
	t.Helper()
	rows, err := repo.Pending(ctx, 200, preferVoIP)
	if err != nil {
		t.Fatalf("Pending(preferVoIP=%v): %v", preferVoIP, err)
	}
	var found *PendingMessage
	for i := range rows {
		if rows[i].UserID != userID {
			continue
		}
		if found != nil {
			t.Fatalf("expected one drainable row for %s, got more than one", userID)
		}
		found = &rows[i]
	}
	if found == nil {
		t.Fatalf("no drainable row for %s (preferVoIP=%v)", userID, preferVoIP)
	}
	return *found
}

// Integration: a device holds both credentials (0105). An `incoming_call` uses the PushKit token only
// when the gateway can actually reach APNs; without an APNs transport the drain must pick the FCM
// token instead, because a PushKit token is not an FCM registration token and can only fail there.
func TestPendingPrefersVoIPOnlyWhenRoutable(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, nil)
	ctx := context.Background()
	const userID = "notif-voip-select-user"
	const pushToken = "notif-voip-select-fcm"
	const voipToken = "notif-voip-select-voip"
	seedVoipUser(t, pool, userID, "9999999901", pushToken, voipToken)

	if err := repo.Enqueue(ctx, userID, "incoming_call", "Incoming call", "Tap to answer", nil); err != nil {
		t.Fatalf("Enqueue call: %v", err)
	}

	withAPNs := drainableFor(t, repo, ctx, true, userID)
	if withAPNs.Token != voipToken || withAPNs.TokenKind != TokenKindVoIP {
		t.Fatalf("preferVoIP must pick the PushKit token, got kind=%q", withAPNs.TokenKind)
	}
	withoutAPNs := drainableFor(t, repo, ctx, false, userID)
	if withoutAPNs.Token != pushToken || withoutAPNs.TokenKind != TokenKindPush {
		t.Fatalf("no APNs must fall back to the FCM token, got kind=%q", withoutAPNs.TokenKind)
	}

	// A non-call row never uses the VoIP token: an alert cannot be delivered to a PushKit token.
	if err := repo.MarkSent(ctx, withAPNs.ID); err != nil {
		t.Fatalf("MarkSent: %v", err)
	}
	if err := repo.Enqueue(ctx, userID, "ORDER_SHIPPED", "Shipped", "On the way", nil); err != nil {
		t.Fatalf("Enqueue alert: %v", err)
	}
	alert := drainableFor(t, repo, ctx, true, userID)
	if alert.Token != pushToken || alert.TokenKind != TokenKindPush {
		t.Fatalf("an alert must use the FCM token, got kind=%q", alert.TokenKind)
	}
}

// Integration: losing one credential must only reopen the row when a token that can carry this row's
// kind survives. A dead FCM token with a live PushKit token leaves an alert terminal (otherwise the
// row would sit in PENDING forever, unselectable by the drain), while a call row goes back to PENDING.
func TestExpireTokenIsKindAware(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, nil)
	ctx := context.Background()

	const alertUser = "notif-voip-expire-alert-user"
	const alertPush = "notif-voip-expire-alert-fcm"
	const alertVoIP = "notif-voip-expire-alert-voip"
	seedVoipUser(t, pool, alertUser, "9999999902", alertPush, alertVoIP)
	if err := repo.Enqueue(ctx, alertUser, "ORDER_SHIPPED", "Shipped", "On the way", nil); err != nil {
		t.Fatalf("Enqueue alert: %v", err)
	}
	alert := drainableFor(t, repo, ctx, true, alertUser)
	if err := repo.ExpireToken(ctx, alert.ID, alertPush); err != nil {
		t.Fatalf("ExpireToken(alert push): %v", err)
	}
	var next *time.Time
	if err := pool.QueryRow(ctx,
		`select next_attempt_at from notifications.outbox where id = $1`, alert.ID).Scan(&next); err != nil {
		t.Fatalf("read alert row: %v", err)
	}
	if next != nil {
		t.Fatalf("an alert with only a VoIP token left must be terminal, got next_attempt_at=%v", next)
	}
	if rows, err := repo.Pending(ctx, 50, true); err != nil {
		t.Fatalf("Pending after alert expire: %v", err)
	} else {
		for _, m := range rows {
			if m.ID == alert.ID {
				t.Fatal("a terminal alert must not rejoin the drain")
			}
		}
	}

	const callUser = "notif-voip-expire-call-user"
	const callPush = "notif-voip-expire-call-fcm"
	const callVoIP = "notif-voip-expire-call-voip"
	seedVoipUser(t, pool, callUser, "9999999903", callPush, callVoIP)
	if err := repo.Enqueue(ctx, callUser, "incoming_call", "Incoming call", "Tap to answer", nil); err != nil {
		t.Fatalf("Enqueue call: %v", err)
	}
	call := drainableFor(t, repo, ctx, true, callUser)
	if call.Token != callVoIP {
		t.Fatalf("expected the PushKit token, got kind=%q", call.TokenKind)
	}
	if err := repo.ExpireToken(ctx, call.ID, callVoIP); err != nil {
		t.Fatalf("ExpireToken(call voip): %v", err)
	}
	var status string
	if err := pool.QueryRow(ctx,
		`select status from notifications.outbox where id = $1`, call.ID).Scan(&status); err != nil {
		t.Fatalf("read call row: %v", err)
	}
	if status != "PENDING" {
		t.Fatalf("a call with a surviving FCM token must go back to PENDING, got %s", status)
	}
	redrained := drainableFor(t, repo, ctx, true, callUser)
	if redrained.Token != callPush || redrained.TokenKind != TokenKindPush {
		t.Fatalf("the re-drain must use the FCM token, got kind=%q", redrained.TokenKind)
	}
}
