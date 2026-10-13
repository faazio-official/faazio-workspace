package reviews

import (
	"context"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestProductReviewsPageBounds(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	rows, _, _, hasMore, err := repo.ProductReviewsPage(ctx, "fm-m1", 1, time.Time{}, "", false)
	if err != nil {
		t.Fatalf("ProductReviewsPage: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("rows = %d, want 1 (bounded by limit)", len(rows))
	}
	if !hasMore {
		t.Fatal("expected hasMore for a product with >1 review")
	}
}

func TestVendorSummaryMatchesAggregate(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	var vendorID string
	if err := pool.QueryRow(ctx, `select vendor_id from reviews.vendor_summary limit 1`).Scan(&vendorID); err != nil {
		t.Skipf("no vendor summary rows: %v", err)
	}

	s, err := repo.VendorSummary(ctx, vendorID)
	if err != nil {
		t.Fatalf("VendorSummary: %v", err)
	}

	var wantCount, wantSum int64
	if err := pool.QueryRow(ctx, `select count(*), coalesce(sum(rating),0) from reviews.vendor_reviews where vendor_id = $1`, vendorID).
		Scan(&wantCount, &wantSum); err != nil {
		t.Fatal(err)
	}
	if s.Count != wantCount {
		t.Fatalf("count = %d, want %d", s.Count, wantCount)
	}
	if wantCount > 0 && s.Average != float64(wantSum)/float64(wantCount) {
		t.Fatalf("average = %v, want %v", s.Average, float64(wantSum)/float64(wantCount))
	}

	var wantDist [5]int64
	rows, err := pool.Query(ctx, `select rating, count(*) from reviews.vendor_reviews where vendor_id = $1 group by rating`, vendorID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var star, count int64
		if err := rows.Scan(&star, &count); err != nil {
			t.Fatal(err)
		}
		wantDist[star-1] = count
	}
	if wantDist != s.Distribution {
		t.Fatalf("distribution = %v, want %v", s.Distribution, wantDist)
	}
}

func TestVendorAppLookup(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	app, err := repo.VendorApp(context.Background(), "store-m3")
	if err != nil {
		t.Fatal(err)
	}
	if app != "MART" {
		t.Fatalf("app = %q, want MART", app)
	}
}
