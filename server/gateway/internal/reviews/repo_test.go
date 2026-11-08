package reviews

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/checkout"
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

func TestFeedbackGateAndUpserts(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	gate := checkout.New(pool)
	ctx := context.Background()
	productID := "fm-m1"
	orderID := fmt.Sprintf("test-feedback-%d", time.Now().UnixNano())

	if _, err := pool.Exec(ctx, `
		insert into checkout.orders (order_id, order_number, user_id, placed_at, status, vendor_store_ids)
		values ($1, $1, 'user-1', now(), 'Delivered', '{}')`, orderID); err != nil {
		t.Fatalf("insert delivered order: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into checkout.order_items (line_id, order_id, product_id, name, qty, unit_price_paisa)
		values ($1, $2, $3, 'test item', 1, 100)`, orderID+"-l1", orderID, productID); err != nil {
		t.Fatalf("insert order item: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, `delete from reviews.reviews where id = $1`, "pr-user-1-"+productID)
		pool.Exec(ctx, `delete from reviews.order_feedback where order_id = $1`, orderID)
		pool.Exec(ctx, `delete from checkout.order_items where order_id = $1`, orderID)
		pool.Exec(ctx, `delete from checkout.orders where order_id = $1`, orderID)
	})

	eligible, ids, err := gate.ProductPurchaseProof(ctx, "user-1", productID)
	if err != nil {
		t.Fatalf("ProductPurchaseProof: %v", err)
	}
	if !eligible || len(ids) == 0 {
		t.Fatalf("expected delivered purchase proof, got eligible=%v ids=%v", eligible, ids)
	}
	ok, err := gate.OrderDeliveredProof(ctx, "user-1", orderID)
	if err != nil || !ok {
		t.Fatalf("OrderDeliveredProof: ok=%v err=%v", ok, err)
	}

	if err := repo.UpsertProductReview(ctx, "user-1", "Test User", productID, "MART", 4, "good", ids); err != nil {
		t.Fatalf("UpsertProductReview: %v", err)
	}
	if err := repo.UpsertProductReview(ctx, "user-1", "Test User", productID, "MART", 5, "great", ids); err != nil {
		t.Fatalf("UpsertProductReview update: %v", err)
	}
	var rating int64
	var comment string
	if err := pool.QueryRow(ctx, `select rating, comment from reviews.reviews where id = $1`, "pr-user-1-"+productID).
		Scan(&rating, &comment); err != nil {
		t.Fatalf("read product review: %v", err)
	}
	if rating != 5 || comment != "great" {
		t.Fatalf("product review = (%d, %q), want (5, great)", rating, comment)
	}

	if err := repo.UpsertOrderFeedback(ctx, "user-1", "Test User", orderID, 3, "fine"); err != nil {
		t.Fatalf("UpsertOrderFeedback: %v", err)
	}
	if err := repo.UpsertOrderFeedback(ctx, "user-1", "Test User", orderID, 4, "better"); err != nil {
		t.Fatalf("UpsertOrderFeedback update: %v", err)
	}
	fb, ok, err := repo.OrderFeedback(ctx, "user-1", orderID)
	if err != nil || !ok {
		t.Fatalf("OrderFeedback: ok=%v err=%v", ok, err)
	}
	if fb.Rating != 4 || fb.Comment != "better" {
		t.Fatalf("order feedback = (%d, %q), want (4, better)", fb.Rating, fb.Comment)
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
