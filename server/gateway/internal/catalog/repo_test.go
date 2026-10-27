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

func TestByStorePageActiveOnly(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	storeID := "st-cat-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, rating)
		values ($1,'MART','Vendor List Test', 4.0)`, storeID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID) })

	// Two ACTIVE rows (ratings 4.5, 4.1) + one DRAFT row (rating 5.0) that must never surface.
	active1, active2, draft := "prod-"+manageID(""), "prod-"+manageID(""), "prod-"+manageID("")
	seed := func(id string, rating float64, status string) {
		if _, err := pool.Exec(ctx, `
			insert into catalog.products (id, app, category, name, price_paisa, store_id, rating, status)
			values ($1,'MART','Test','Unit', 10000, $2, $3, $4)`, id, storeID, rating, status); err != nil {
			t.Fatalf("seed product %s: %v", id, err)
		}
	}
	seed(active1, 4.5, "ACTIVE")
	seed(active2, 4.1, "ACTIVE")
	seed(draft, 5.0, "DRAFT")
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from catalog.products where id = any($1)`, []string{active1, active2, draft})
	})

	// Callers pass limit+1: asking for 2 returns both ACTIVE rows, DRAFT excluded.
	page, err := repo.ByStorePage(ctx, storeID, 2, 0, "", false)
	if err != nil {
		t.Fatalf("ByStorePage: %v", err)
	}
	if len(page) != 2 {
		t.Fatalf("first page n=%d, want 2", len(page))
	}
	if page[0].ID != active1 || page[0].Rating != 4.5 {
		t.Fatalf("expected %s (4.5) first, got %s (%v)", active1, page[0].ID, page[0].Rating)
	}
	if page[0].StoreID != storeID {
		t.Fatalf("storeId = %q, want %q", page[0].StoreID, storeID)
	}
	for _, p := range page {
		if p.ID == draft {
			t.Fatal("DRAFT product leaked into the ACTIVE list")
		}
	}

	// Keyset cursor resumes after the first row.
	next, err := repo.ByStorePage(ctx, storeID, 1, page[0].Rating, page[0].ID, true)
	if err != nil {
		t.Fatalf("ByStorePage cursor: %v", err)
	}
	if len(next) == 0 || next[0].ID != active2 {
		t.Fatalf("keyset page = %+v, want %s first", next, active2)
	}
}
