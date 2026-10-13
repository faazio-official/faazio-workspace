package sellers

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestSellerLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	s, err := repo.Create(ctx, Seller{
		BusinessName: "Test Traders", OwnerName: "A. Kaur", Category: "MART",
		GSTIN: "29ABCDE1234F1Z5", PAN: "ABCDE1234F", BusinessAddress: "1 Test St",
		ContactPhone: "+91 9000000000", StateCode: "KA",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = $1`, s.SellerID) })
	if s.Status != "PENDING_REVIEW" || s.SellerID == "" || s.StateCode != "KA" {
		t.Fatalf("unexpected created seller: %+v", s)
	}

	got, ok, err := repo.ByID(ctx, s.SellerID)
	if err != nil || !ok || got.BusinessName != "Test Traders" {
		t.Fatalf("ByID: ok=%v err=%v seller=%+v", ok, err, got)
	}

	active, ok, err := repo.SetStatus(ctx, s.SellerID, "ACTIVE")
	if err != nil || !ok || active.Status != "ACTIVE" {
		t.Fatalf("SetStatus: ok=%v err=%v status=%q", ok, err, active.Status)
	}
	if _, ok, _ := repo.SetStatus(ctx, "sel-does-not-exist", "ACTIVE"); ok {
		t.Fatal("SetStatus on missing seller must report ok=false")
	}

	doc, err := repo.AddKYC(ctx, KycDocument{SellerID: s.SellerID, DocType: "GSTIN", FileKey: "kyc/" + s.SellerID + "/gstin.pdf"})
	if err != nil || doc.KycID == "" {
		t.Fatalf("AddKYC: err=%v doc=%+v", err, doc)
	}
	docs, err := repo.KYC(ctx, s.SellerID)
	if err != nil || len(docs) != 1 {
		t.Fatalf("KYC: err=%v docs=%d", err, len(docs))
	}

	if _, err := repo.UpsertBankAccount(ctx, BankAccount{SellerID: s.SellerID, AccountNumberMasked: "****1234", IFSC: "HDFC0001234", BeneficiaryName: "Test Traders"}); err != nil {
		t.Fatalf("UpsertBankAccount insert: %v", err)
	}
	b, err := repo.UpsertBankAccount(ctx, BankAccount{SellerID: s.SellerID, AccountNumberMasked: "****9999", IFSC: "HDFC0001234", BeneficiaryName: "Test Traders"})
	if err != nil {
		t.Fatalf("UpsertBankAccount update: %v", err)
	}
	if b.AccountNumberMasked != "****9999" {
		t.Fatalf("upsert must replace the masked number, got %q", b.AccountNumberMasked)
	}

	list, err := repo.List(ctx, ListFilter{StateCode: "KA", Status: "ACTIVE"})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	found := false
	for _, item := range list {
		if item.SellerID == s.SellerID {
			found = true
		}
	}
	if !found {
		t.Fatalf("List(KA, ACTIVE) missing %s", s.SellerID)
	}
}
