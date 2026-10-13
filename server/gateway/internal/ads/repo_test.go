package ads

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestAdSlotLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-ads-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Ads Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	s, err := repo.Request(ctx, Slot{SellerID: sellerID, ProductID: "md-1", Placement: "HOME_TOP", StateCode: "KA"})
	if err != nil {
		t.Fatalf("Request: %v", err)
	}
	if s.Status != "REQUESTED" || s.SlotID == "" {
		t.Fatalf("unexpected slot: %+v", s)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from ads.sponsored_slots where slot_id=$1`, s.SlotID) })

	approved, ok, err := repo.SetStatus(ctx, s.SlotID, "APPROVED")
	if err != nil || !ok || approved.Status != "APPROVED" {
		t.Fatalf("SetStatus: ok=%v err=%v status=%q", ok, err, approved.Status)
	}
	list, err := repo.List(ctx, sellerID, "")
	if err != nil || len(list) != 1 {
		t.Fatalf("List: err=%v n=%d", err, len(list))
	}
	if _, ok, _ := repo.SetStatus(ctx, "ad-missing", "LIVE"); ok {
		t.Fatal("SetStatus on missing slot must report ok=false")
	}
}
