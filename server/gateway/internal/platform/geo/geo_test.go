package geo

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestSeedMatchesContract(t *testing.T) {
	s := Seed()
	if len(s) != 42 {
		t.Fatalf("seed size = %d, want 42 (38 TN + 4 PY)", len(s))
	}
	tn, py := 0, 0
	for _, d := range s {
		switch d.StateCode {
		case "TN":
			tn++
		case "PY":
			py++
		}
		if d.Code == "" || d.Name == "" || !d.Active {
			t.Fatalf("malformed seed row: %+v", d)
		}
	}
	if tn != 38 || py != 4 {
		t.Fatalf("seed split TN=%d PY=%d, want 38/4", tn, py)
	}
}

func TestLookups(t *testing.T) {
	if !IsValid("TCH") || !IsValid("tch") {
		t.Fatal("TCH should be valid after normalisation")
	}
	if IsValid("ZZZ") {
		t.Fatal("ZZZ should be invalid")
	}
	if got := StateForDistrict("TCH"); got != "TN" {
		t.Fatalf("StateForDistrict(TCH) = %q, want TN", got)
	}
	if got := Name("PY0"); got != "Puducherry" {
		t.Fatalf("Name(PY0) = %q, want Puducherry", got)
	}
	if !InCoverageState("tn") {
		t.Fatal("TN should be a coverage state (normalised)")
	}
	if got := ForState("PY"); len(got) != 4 {
		t.Fatalf("ForState(PY) = %d districts, want 4", len(got))
	}
}

// TestPlaceIDLookup proves the place_id index (0127): a district is resolvable by the Google
// place_id a reverse geocode returns, and an empty place_id is never a key.
func TestPlaceIDLookup(t *testing.T) {
	s := newSnapshot([]District{
		{Code: "TCH", Name: "Chennai", StateCode: "TN", GooglePlaceID: "ChIJchennai", Active: true},
		{Code: "TNK", Name: "Kanchipuram", StateCode: "TN", Active: true},
	})
	if got, ok := s.byPlaceID["ChIJchennai"]; !ok || got.Code != "TCH" {
		t.Fatalf("byPlaceID[ChIJchennai] = %+v,%v; want TCH,true", got, ok)
	}
	if _, ok := s.byPlaceID[""]; ok {
		t.Fatal("an empty place_id must never be a key")
	}
	if _, ok := s.byPlaceID["ChIJnope"]; ok {
		t.Fatal("an unknown place_id must not resolve")
	}
}

// TestReloadFromDB proves the read-through cache: whatever the live master holds becomes the
// validation snapshot, including a row added through the write path.
func TestReloadFromDB(t *testing.T) {
	pool := testenv.Pool(t)
	ctx := context.Background()

	const code = "TZY"
	_, _ = pool.Exec(ctx, `delete from admins.district_master where district_code = $1`, code)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from admins.district_master where district_code = $1`, code)
		_ = Reload(context.Background(), pool)
	})

	if _, err := pool.Exec(ctx,
		`insert into admins.district_master (district_code, district_name, state_code) values ($1,$2,$3)`,
		code, "Reload Test", "TN"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	if IsValid(code) {
		t.Fatal("the new row must not be valid before Reload")
	}
	if err := Reload(ctx, pool); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if !IsValid(code) {
		t.Fatal("Reload must make the new row valid")
	}
	if got := StateForDistrict(code); got != "TN" {
		t.Fatalf("StateForDistrict(%s) = %q, want TN", code, got)
	}
}

// TestReloadNilPoolIsNoop keeps the health-only boot path (no Postgres) on the embedded seed.
func TestReloadNilPoolIsNoop(t *testing.T) {
	if err := Init(context.Background(), nil); err != nil {
		t.Fatalf("Init(nil) = %v, want nil", err)
	}
	if !IsValid("TCH") {
		t.Fatal("the seed should still serve when the pool is nil")
	}
}
