package pharma

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func manageID(prefix string) string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func TestVendorPrescriptionQuoteAndReveal(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-rx-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Rx Test','O','PHARMA','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	storeID := "store-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'PHARMA','Rx Store',$2,'KA')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID) })

	rx, err := repo.Create(ctx, Prescription{UserID: "user-1", VendorID: storeID, Fulfillment: "DELIVERY", Pages: 1})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from pharma.prescriptions where id=$1`, rx.ID) })

	// Empty profile: seller sees the Rx but no contact (name-only until READY).
	items, err := repo.VendorPrescriptions(ctx, sellerID, "")
	if err != nil || len(items) != 1 {
		t.Fatalf("VendorPrescriptions: err=%v n=%d", err, len(items))
	}
	if items[0].CustomerName == "" || items[0].CustomerPhone != "" || items[0].CustomerAddress != "" {
		t.Fatalf("redaction: name=%q phone=%q addr=%q", items[0].CustomerName, items[0].CustomerPhone, items[0].CustomerAddress)
	}

	// READY without a quote is refused.
	if _, ok, err := repo.SetStatus(ctx, rx.ID, sellerID, "READY", sellerID, "SELLER", false); !errors.Is(err, ErrEmptyQuote) || ok {
		t.Fatalf("READY without quote must fail: ok=%v err=%v", ok, err)
	}

	// Cross-seller quote denied; owner quote advances to QUOTED and computes the total.
	if _, ok, err := repo.UpsertQuote(ctx, rx.ID, "sel-other", "sel-other", "SELLER", false, []QuoteItem{{Name: "X", Qty: 1, Price: 10}}); err != nil || ok {
		t.Fatalf("cross-seller quote must be denied: ok=%v err=%v", ok, err)
	}
	q, ok, err := repo.UpsertQuote(ctx, rx.ID, sellerID, sellerID, "SELLER", false, []QuoteItem{
		{Name: "Paracetamol", Qty: 2, MRP: 30, Price: 25, Discount: 2},
		{Name: "Amoxicillin", Qty: 1, MRP: 90, Price: 80, Discount: 0},
	})
	if err != nil || !ok {
		t.Fatalf("owner quote: ok=%v err=%v", ok, err)
	}
	if q.Status != "QUOTED" || q.QuotedTotal != (2*(25-2)+80) || len(q.Quote) != 2 {
		t.Fatalf("quote result: status=%q total=%d lines=%d", q.Status, q.QuotedTotal, len(q.Quote))
	}

	// READY now succeeds, records the reveal and a status-history trail.
	ready, ok, err := repo.SetStatus(ctx, rx.ID, sellerID, "READY", sellerID, "SELLER", false)
	if err != nil || !ok || ready.Status != "READY" || ready.RevealedAt == "" || ready.RevealedBy != sellerID {
		t.Fatalf("READY: ok=%v err=%v status=%q revealedAt=%q revealedBy=%q", ok, err, ready.Status, ready.RevealedAt, ready.RevealedBy)
	}
	if len(ready.History) < 2 {
		t.Fatalf("history must record RECEIVED→QUOTED→READY, got %d", len(ready.History))
	}

	// Vendor projection now exposes contact columns (still no raw user_id field).
	items, err = repo.VendorPrescriptions(ctx, sellerID, "READY")
	if err != nil || len(items) != 1 {
		t.Fatalf("VendorPrescriptions READY: err=%v n=%d", err, len(items))
	}
}
