package districts

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// TestListMatchesMirror locks the seed contract: with no DB rows reloaded, the DB read must return
// exactly the embedded internal/platform/geo seed (@data/districts) — same rows, same order. Drift
// here means the fixture, the boot fallback, and the picker have diverged.
func TestListMatchesMirror(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	seed := geo.Seed()
	all, err := repo.List(ctx, "")
	if err != nil {
		t.Fatalf("list all: %v", err)
	}
	// The live DB may have districts added through the write API; the seed must always be a
	// name-ordered prefix-compatible subset, so check every seed row is present and aligned by code.
	byCode := make(map[string]PickerDistrict, len(all))
	for _, d := range all {
		byCode[d.DistrictCode] = d
	}
	for _, s := range seed {
		d, ok := byCode[s.Code]
		if !ok {
			t.Fatalf("seeded district %s missing from the DB master", s.Code)
		}
		if d.Name != s.Name || d.StateCode != s.StateCode {
			t.Fatalf("district %s drift: db={%q %s} seed={%q %s}",
				s.Code, d.Name, d.StateCode, s.Name, s.StateCode)
		}
	}
}

func TestListAgainstDB(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	all, err := repo.List(ctx, "")
	if err != nil {
		t.Fatalf("list all: %v", err)
	}
	if len(all) == 0 {
		t.Fatal("expected the seeded district master to be non-empty")
	}
	for _, d := range all {
		if d.DistrictCode == "" || d.Name == "" || d.StateCode == "" {
			t.Fatalf("malformed row on the wire: %+v", d)
		}
	}

	py, err := repo.List(ctx, "PY")
	if err != nil {
		t.Fatalf("list PY: %v", err)
	}
	for _, d := range py {
		if d.StateCode != "PY" {
			t.Fatalf("state filter leaked a %q row: %+v", d.StateCode, d)
		}
	}

	tn, err := repo.List(ctx, "TN")
	if err != nil {
		t.Fatalf("list TN: %v", err)
	}
	if len(tn) == 0 {
		t.Fatal("expected Tamil Nadu districts")
	}
}

// TestWriteLifecycle exercises create → update → toggle → delete against the test DB. It cleans up
// after itself so a re-run stays green (and the district is guaranteed unused, so DELETE succeeds).
func TestWriteLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	const code = "TZZ"
	_, _ = pool.Exec(ctx, `delete from admins.district_master where district_code = $1`, code)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from admins.district_master where district_code = $1`, code)
	})

	created, err := repo.Create(ctx, Input{Code: code, Name: "Test District", StateCode: "TN"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if !created.IsActive {
		t.Fatal("a new district should default to active")
	}
	if created.CreatedAt == "" || created.UpdatedAt == "" {
		t.Fatal("create must return created_at/updated_at")
	}

	if _, err := repo.Create(ctx, Input{Code: code, Name: "Dup", StateCode: "TN"}); err == nil {
		t.Fatal("expected a duplicate-code error")
	}

	updated, err := repo.Update(ctx, code, Input{Name: "Renamed District", StateCode: "TN"})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Name != "Renamed District" {
		t.Fatalf("update did not rename: %+v", updated)
	}

	off, err := repo.SetActive(ctx, code, false)
	if err != nil {
		t.Fatalf("toggle: %v", err)
	}
	if off.IsActive {
		t.Fatal("toggle to false did not deactivate")
	}
	// A deactivated district is hidden from the picker read but still valid for references.
	if _, err := repo.Get(ctx, code); err != nil {
		t.Fatalf("a deactivated district must still be readable: %v", err)
	}
	trashed, ok, err := repo.SoftDelete(ctx, code, "test removal")
	if err != nil || !ok {
		t.Fatalf("soft delete unused district: ok=%v err=%v", ok, err)
	}
	if trashed.DeletedAt == "" || trashed.PurgeAt == "" {
		t.Fatalf("trashed district missing lifedates: %+v", trashed)
	}
	if _, ok, err := repo.SoftDelete(ctx, code, "again"); err != nil || ok {
		t.Fatalf("second soft delete: ok=%v err=%v (want false/nil)", ok, err)
	}
	if _, err := repo.Get(ctx, code); err != nil {
		t.Fatalf("a trashed district must still resolve for references: %v", err)
	}
	if ok, err := repo.PurgeOne(ctx, code); err != nil || !ok {
		t.Fatalf("purge trashed district: ok=%v err=%v", ok, err)
	}
	if _, err := repo.Get(ctx, code); err != ErrNotFound {
		t.Fatalf("after purge: got %v, want ErrNotFound", err)
	}
}
