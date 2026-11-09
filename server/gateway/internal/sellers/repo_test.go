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

	s, err := repo.Create(ctx, "user-test-1", Seller{
		BusinessName: "Test Traders", OwnerName: "A. Kaur",
		GSTIN: "29ABCDE1234F1Z5", PAN: "ABCDE1234F", BusinessAddress: "1 Test St",
		ContactPhone: "+91 9000000000", ContactEmail: "test@example.com", StateCode: "KA",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.stores where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = $1`, s.SellerID)
	})
	if s.Status != "PENDING_REVIEW" || s.SellerID == "" || s.StateCode != "KA" {
		t.Fatalf("unexpected created seller: %+v", s)
	}

	got, ok, err := repo.ByID(ctx, s.SellerID)
	if err != nil || !ok || got.BusinessName != "Test Traders" {
		t.Fatalf("ByID: ok=%v err=%v seller=%+v", ok, err, got)
	}

	byUser, ok, err := repo.GetByUserID(ctx, "user-test-1")
	if err != nil || !ok || byUser.SellerID != s.SellerID {
		t.Fatalf("GetByUserID: ok=%v err=%v seller=%+v", ok, err, byUser)
	}
	if _, ok, _ := repo.GetByUserID(ctx, "user-does-not-exist"); ok {
		t.Fatal("GetByUserID returned a row for an unknown user")
	}

	rejected, ok, err := repo.SetStatus(ctx, s.SellerID, "REJECTED", "illegible passbook", "admin-test")
	if err != nil || !ok || rejected.Status != "REJECTED" || rejected.RejectionReason != "illegible passbook" {
		t.Fatalf("SetStatus(REJECTED): ok=%v err=%v seller=%+v", ok, err, rejected)
	}

	active, ok, err := repo.SetStatus(ctx, s.SellerID, "ACTIVE", "", "admin-test")
	if err != nil || !ok || active.Status != "ACTIVE" || active.RejectionReason != "" {
		t.Fatalf("SetStatus(ACTIVE): ok=%v err=%v seller=%+v", ok, err, active)
	}
	if _, ok, _ := repo.SetStatus(ctx, "sel-does-not-exist", "ACTIVE", "", "admin-test"); ok {
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

func strPtr(s string) *string { return &s }

func TestProfilePatchMergeAndKYCChange(t *testing.T) {
	before := Seller{
		BusinessName: "Old Name", OwnerName: "Owner", GSTIN: "29AAAAA0000A1Z5",
		PAN: "AAAAA0000A", BusinessAddress: "1 Old St", ContactPhone: "+91 9000000000",
		Status: "ACTIVE",
	}
	merged := ProfilePatch{ContactPhone: strPtr("+91 9111111111")}.apply(before)
	if merged.BusinessName != before.BusinessName || merged.GSTIN != before.GSTIN {
		t.Fatalf("partial patch must leave untouched fields unchanged: %+v", merged)
	}
	if merged.ContactPhone != "+91 9111111111" {
		t.Fatalf("contact phone not applied: %q", merged.ContactPhone)
	}
	if kycChanged(before, merged) {
		t.Fatal("a phone-only edit must not count as a KYC change")
	}
	kyc := before
	kyc.GSTIN = "29BBBBB1111B1Z5"
	if !kycChanged(before, kyc) {
		t.Fatal("a GSTIN edit must count as a KYC change")
	}
}

func TestUpdateProfileRequeueSemantics(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	s, err := repo.Create(ctx, "user-profile-test", Seller{
		BusinessName: "Profile Test", OwnerName: "P. Test",
		GSTIN: "29ABCDE1234F1Z5", PAN: "ABCDE1234F", BusinessAddress: "1 Test St",
		ContactPhone: "+91 9000000000", ContactEmail: "profile-test@example.com", StateCode: "KA",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from sellers.notification_preferences where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.sub_users where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.seller_request_history where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = $1`, s.SellerID)
	})
	if _, ok, err := repo.SetStatus(ctx, s.SellerID, "ACTIVE", "", "admin-test"); err != nil || !ok {
		t.Fatalf("set active: ok=%v err=%v", ok, err)
	}

	// A phone-only edit keeps ACTIVE and does not require re-verification.
	after, ok, err := repo.UpdateProfile(ctx, s.SellerID, ProfilePatch{ContactPhone: strPtr("+91 9222222222")}, "seller-test", true)
	if err != nil || !ok {
		t.Fatalf("phone edit: ok=%v err=%v", ok, err)
	}
	if after.Status != "ACTIVE" {
		t.Fatalf("phone-only edit re-queued the seller: status=%s", after.Status)
	}
	if after.GSTIN != "29ABCDE1234F1Z5" || after.BusinessName != "Profile Test" {
		t.Fatalf("partial edit wiped untouched fields: %+v", after)
	}

	// A real KYC change from ACTIVE re-enters review.
	after, ok, err = repo.UpdateProfile(ctx, s.SellerID, ProfilePatch{GSTIN: strPtr("29ZZZZZ9999Z1Z5")}, "seller-test", true)
	if err != nil || !ok {
		t.Fatalf("kyc edit: ok=%v err=%v", ok, err)
	}
	if after.Status != "PENDING_REVIEW" {
		t.Fatalf("KYC edit did not re-queue: status=%s", after.Status)
	}

	// A suspended seller cannot lift the suspension with a KYC edit.
	if _, ok, err := repo.SetStatus(ctx, s.SellerID, "SUSPENDED", "policy", "admin-test"); err != nil || !ok {
		t.Fatalf("suspend: ok=%v err=%v", ok, err)
	}
	after, ok, err = repo.UpdateProfile(ctx, s.SellerID, ProfilePatch{PAN: strPtr("ZZZZZ9999Z")}, "seller-test", true)
	if err != nil || !ok {
		t.Fatalf("suspended kyc edit: ok=%v err=%v", ok, err)
	}
	if after.Status != "SUSPENDED" {
		t.Fatalf("self-service edit lifted a suspension: status=%s", after.Status)
	}
}

func TestNotificationPreferencesAndSubUsers(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	s, err := repo.Create(ctx, "user-settings-test", Seller{
		BusinessName: "Settings Test", OwnerName: "S. Test", StateCode: "KA",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from sellers.notification_preferences where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.sub_users where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.seller_request_history where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = $1`, s.SellerID)
	})

	prefs, err := repo.GetNotificationPreferences(ctx, s.SellerID)
	if err != nil {
		t.Fatalf("get defaults: %v", err)
	}
	if !prefs.NewOrder || !prefs.LowStock || !prefs.SLABreach || !prefs.Campaigns {
		t.Fatalf("absent row must default all-on: %+v", prefs)
	}
	if _, err := repo.UpsertNotificationPreferences(ctx, s.SellerID, NotificationPreferences{NewOrder: false, LowStock: true, SLABreach: true, Campaigns: true}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	prefs, err = repo.GetNotificationPreferences(ctx, s.SellerID)
	if err != nil || prefs.NewOrder {
		t.Fatalf("preferences not persisted: %+v err=%v", prefs, err)
	}

	u, err := repo.InviteSubUser(ctx, s.SellerID, "Staff One", "staff@example.com", "STAFF")
	if err != nil || u.Status != "PENDING_INVITE" || u.SubUserID == "" {
		t.Fatalf("invite: %+v err=%v", u, err)
	}
	if _, err := repo.InviteSubUser(ctx, s.SellerID, "Dup", "STAFF@example.com", "VIEWER"); err != ErrSubUserExists {
		t.Fatalf("duplicate invite (case-insensitive) err=%v, want ErrSubUserExists", err)
	}
	rows, err := repo.ListSubUsers(ctx, s.SellerID)
	if err != nil || len(rows) != 1 {
		t.Fatalf("list: len=%d err=%v", len(rows), err)
	}
	if ok, err := repo.RevokeSubUser(ctx, s.SellerID, u.SubUserID); err != nil || !ok {
		t.Fatalf("revoke: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.RevokeSubUser(ctx, s.SellerID, u.SubUserID); err != nil || !ok {
		t.Fatalf("revoke must be idempotent: ok=%v err=%v", ok, err)
	}
	// After revoke the same email can be invited again.
	if _, err := repo.InviteSubUser(ctx, s.SellerID, "Staff One", "staff@example.com", "STAFF"); err != nil {
		t.Fatalf("re-invite after revoke: %v", err)
	}
}
