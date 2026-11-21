package blood

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// Integration: the board nudge caps how many donors one post reaches, so *which* donors are chosen
// must be deterministic and useful — not whatever order the planner happened to return. Donors are
// ranked by how recently their push token was refreshed, with user_id as a total tie-break.
//
// This is the property that makes the cap safe: two identical posts nudge the same set, and a donor
// whose device is still in use outranks one whose token has not been refreshed in months.
func TestAlertableDonorIDsOrdersByTokenRecency(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	const (
		group = "O-"
		city  = "Orderingville"
		stale = "blood-order-stale"
		fresh = "blood-order-fresh"
	)
	users := []string{stale, fresh}
	for _, uid := range users {
		if _, err := pool.Exec(ctx, `
			insert into checkout.users (user_id, name, email, phone)
			values ($1, 'Ordering Test', $2, '9999999999')
			on conflict (user_id) do nothing`, uid, uid+"@faazio.in"); err != nil {
			t.Fatalf("seed user %s: %v", uid, err)
		}
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from notifications.push_tokens where user_id = any($1)`, users)
		_, _ = pool.Exec(ctx, `delete from blood.donors where user_id = any($1)`, users)
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = any($1)`, users)
	})

	// Both donors are identical in every filtering dimension; only token recency differs.
	for _, uid := range users {
		if _, err := pool.Exec(ctx, `
			insert into blood.donors (user_id, name, blood_group, city, consent, available)
			values ($1, 'Ordering Donor', $2, $3, true, true)
			on conflict (user_id) do update set consent = true, available = true, city = $3`,
			uid, group, city); err != nil {
			t.Fatalf("seed donor %s: %v", uid, err)
		}
		if _, err := pool.Exec(ctx, `
			insert into notifications.push_tokens (user_id, token, platform, token_kind, updated_at)
			values ($1, $2, 'android', 'push', now())
			on conflict (user_id, token_kind) do update set token = $2, updated_at = now()`,
			uid, "tok-"+uid); err != nil {
			t.Fatalf("seed token %s: %v", uid, err)
		}
	}
	// Make the "stale" donor's token old; the fresh one keeps now().
	if _, err := pool.Exec(ctx,
		`update notifications.push_tokens set updated_at = now() - interval '90 days' where user_id = $1`,
		stale); err != nil {
		t.Fatalf("age stale token: %v", err)
	}

	got, err := repo.AlertableDonorIDs(ctx, group, city)
	if err != nil {
		t.Fatalf("AlertableDonorIDs: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("recipients = %v, want both donors", got)
	}
	if got[0] != fresh {
		t.Fatalf("recipient order = %v, want the recently-refreshed token first (%s)", got, fresh)
	}

	// Determinism: the same query returns the same order (no planner-dependent shuffle).
	again, err := repo.AlertableDonorIDs(ctx, group, city)
	if err != nil {
		t.Fatalf("AlertableDonorIDs repeat: %v", err)
	}
	if len(again) != len(got) || again[0] != got[0] || again[1] != got[1] {
		t.Fatalf("recipient order not deterministic: %v then %v", got, again)
	}
}

// Integration: an empty city must match nobody. The query previously treated ” as a wildcard, which
// turned a malformed post into a nationwide broadcast to every consented donor of that blood group.
func TestAlertableDonorIDsEmptyCityMatchesNobody(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	const uid = "blood-empty-city"
	if _, err := pool.Exec(ctx, `
		insert into checkout.users (user_id, name, email, phone)
		values ($1, 'Empty City Test', 'empty-city@faazio.in', '9999999999')
		on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from notifications.push_tokens where user_id = $1`, uid)
		_, _ = pool.Exec(ctx, `delete from blood.donors where user_id = $1`, uid)
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid)
	})

	if _, err := pool.Exec(ctx, `
		insert into blood.donors (user_id, name, blood_group, city, consent, available)
		values ($1, 'Empty City Donor', 'AB-', 'Chennai', true, true)
		on conflict (user_id) do update set consent = true, available = true`, uid); err != nil {
		t.Fatalf("seed donor: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into notifications.push_tokens (user_id, token, platform, token_kind)
		values ($1, 'tok-empty-city', 'android', 'push')
		on conflict (user_id, token_kind) do update set token = 'tok-empty-city'`, uid); err != nil {
		t.Fatalf("seed token: %v", err)
	}

	got, err := repo.AlertableDonorIDs(ctx, "AB-", "")
	if err != nil {
		t.Fatalf("AlertableDonorIDs: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("empty city matched %v, want nobody (no nationwide broadcast)", got)
	}
}

// Integration: a donor with no push token must not be returned, because an outbox row for them can
// never drain (Pending() joins push_tokens) and would sit PENDING forever.
func TestAlertableDonorIDsSkipsTokenlessDonor(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	const (
		withToken = "blood-token-yes"
		noToken   = "blood-token-no"
		group     = "B-"
		city      = "Tokenville"
	)
	users := []string{withToken, noToken}
	for _, uid := range users {
		if _, err := pool.Exec(ctx, `
			insert into checkout.users (user_id, name, email, phone)
			values ($1, 'Token Test', $2, '9999999999')
			on conflict (user_id) do nothing`, uid, uid+"@faazio.in"); err != nil {
			t.Fatalf("seed user %s: %v", uid, err)
		}
		if _, err := pool.Exec(ctx, `
			insert into blood.donors (user_id, name, blood_group, city, consent, available)
			values ($1, 'Token Donor', $2, $3, true, true)
			on conflict (user_id) do update set consent = true, available = true, city = $3`,
			uid, group, city); err != nil {
			t.Fatalf("seed donor %s: %v", uid, err)
		}
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from notifications.push_tokens where user_id = any($1)`, users)
		_, _ = pool.Exec(ctx, `delete from blood.donors where user_id = any($1)`, users)
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = any($1)`, users)
	})

	if _, err := pool.Exec(ctx, `
		insert into notifications.push_tokens (user_id, token, platform, token_kind)
		values ($1, 'tok-token-yes', 'android', 'push')
		on conflict (user_id, token_kind) do update set token = 'tok-token-yes'`, withToken); err != nil {
		t.Fatalf("seed token: %v", err)
	}

	got, err := repo.AlertableDonorIDs(ctx, group, city)
	if err != nil {
		t.Fatalf("AlertableDonorIDs: %v", err)
	}
	if len(got) != 1 || got[0] != withToken {
		t.Fatalf("recipients = %v, want only the donor with a push token", got)
	}
}

// Guard: the request contract must keep carrying the identity fields, since they are the reason a
// donor can act on a board post at all.
func TestBloodRequestCarriesIdentity(t *testing.T) {
	req := contracts.BloodRequest{PatientName: "P", ContactPerson: "C", Contact: "+919876543210"}
	if req.PatientName == "" || req.ContactPerson == "" {
		t.Fatalf("identity fields missing from the contract: %+v", req)
	}
}
