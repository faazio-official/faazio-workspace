package districts

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// TestListMatchesMirror locks the wire contract: the DB read must return exactly the in-process
// internal/platform/geo mirror (@data/districts) — same rows, same order. Drift here means the
// fixture, the validation mirror, and the picker have diverged.
func TestListMatchesMirror(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	all, err := repo.List(ctx, "")
	if err != nil {
		t.Fatalf("list all: %v", err)
	}
	if len(all) != len(geo.Districts) {
		t.Fatalf("row count: db=%d mirror=%d", len(all), len(geo.Districts))
	}
	for i := range geo.Districts {
		m := geo.Districts[i]
		d := all[i]
		if d.DistrictCode != m.Code || d.Name != m.Name || d.StateCode != m.StateCode {
			t.Fatalf("row %d ordering/parity mismatch: db={%s %q %s} mirror={%s %q %s}",
				i, d.DistrictCode, d.Name, d.StateCode, m.Code, m.Name, m.StateCode)
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
	if len(tn)+len(py) != len(all) {
		t.Fatalf("state filters do not partition the master: TN=%d PY=%d all=%d", len(tn), len(py), len(all))
	}
}
