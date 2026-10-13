package blood

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestDonorDirectoryRequestsAndMatches(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	const uid = "user-blood-test"
	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id, name, email, phone) values ($1, 'T', 't@t', '0') on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed test user: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid) })

	if err := repo.UpsertDonor(ctx, contracts.BloodDonor{UserID: uid, Name: "Test Donor", BloodGroup: "O+", City: "Chennai", Available: true, Consent: true}); err != nil {
		t.Fatalf("UpsertDonor: %v", err)
	}
	d, ok, err := repo.Donor(ctx, uid)
	if err != nil || !ok || d.BloodGroup != "O+" {
		t.Fatalf("Donor = %+v ok=%v err=%v", d, ok, err)
	}

	dir, err := repo.Directory(ctx, "O+", "Chennai")
	if err != nil {
		t.Fatalf("Directory: %v", err)
	}
	found := false
	for _, x := range dir {
		if x.UserID == uid {
			found = true
		}
	}
	if !found {
		t.Fatalf("donor not in directory: %+v", dir)
	}

	req, err := repo.CreateRequest(ctx, contracts.BloodRequest{Hospital: "Test Hospital", City: "Chennai", State: "TN", BloodGroup: "O+", UnitsRequired: 2})
	if err != nil {
		t.Fatalf("CreateRequest: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, `delete from blood.requests where id = $1`, req.ID) })
	if req.PostedAt == "" {
		t.Fatalf("request missing postedAt: %+v", req)
	}

	if err := repo.SetInterest(ctx, req.ID, uid, "interested"); err != nil {
		t.Fatalf("SetInterest: %v", err)
	}
	// Idempotent: a repeat insert must not error.
	if err := repo.SetInterest(ctx, req.ID, uid, "interested"); err != nil {
		t.Fatalf("SetInterest repeat: %v", err)
	}

	m, err := repo.CreateMatch(ctx, contracts.DonorMatch{RequesterUserID: uid, DonorUserID: uid, BloodGroup: "O+", City: "Chennai"})
	if err != nil || m.Status != "pending" {
		t.Fatalf("CreateMatch = %+v err %v", m, err)
	}
	matches, err := repo.MatchesByRequester(ctx, uid)
	if err != nil || len(matches) != 1 {
		t.Fatalf("MatchesByRequester = %+v err %v", matches, err)
	}
}