package catalog

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestSearchFTSCoffee(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)

	got, err := repo.Search(context.Background(), "coffee", "", 0)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("expected FTS hits for 'coffee'")
	}

	// App scoping must filter to the requested brand.
	mart, err := repo.Search(context.Background(), "coffee", "MART", 0)
	if err != nil {
		t.Fatalf("Search(MART): %v", err)
	}
	if len(mart) == 0 {
		t.Fatal("expected MART coffee hits")
	}
	for _, p := range mart {
		if p.App != "MART" {
			t.Fatalf("app-scoped result leaked %s", p.App)
		}
	}
}

func TestByIDAndByIDsOrder(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	hits, err := repo.Search(ctx, "coffee", "", 3)
	if err != nil || len(hits) == 0 {
		t.Fatalf("seed lookup failed: %v (%d hits)", err, len(hits))
	}
	id := hits[0].ID

	p, ok, err := repo.ByID(ctx, id)
	if err != nil || !ok {
		t.Fatalf("ByID(%s): ok=%v err=%v", id, ok, err)
	}
	if p.ID != id || p.Name == "" {
		t.Fatalf("ByID mismatch: %+v", p)
	}
	if p.Price <= 0 {
		t.Fatalf("expected rupees price > 0, got %d", p.Price)
	}

	// ByIDs must preserve the requested id order.
	if len(hits) >= 2 {
		first, second := hits[0].ID, hits[1].ID
		batch, err := repo.ByIDs(ctx, []string{second, first, "does-not-exist"})
		if err != nil {
			t.Fatalf("ByIDs: %v", err)
		}
		if len(batch) != 2 || batch[0].ID != second || batch[1].ID != first {
			t.Fatalf("order not preserved: %+v", batch)
		}
	}

	if _, ok, _ := repo.ByID(ctx, "does-not-exist"); ok {
		t.Fatal("unknown id must report ok=false")
	}
}