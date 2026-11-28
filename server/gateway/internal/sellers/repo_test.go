package sellers

import (
	"context"
	"errors"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestSellerLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	s, err := repo.Create(ctx, "user-test-1", Seller{
		OwnerName: "A. Kaur",
		GSTIN: "29ABCDE1234F1ZW", PAN: "ABCDE1234F", BusinessAddress: "1 Test St",
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
	if err != nil || !ok || got.OwnerName != "A. Kaur" {
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
		OwnerName: "Owner", GSTIN: "29AAAAA0000A1Z5",
		PAN: "AAAAA0000A", BusinessAddress: "1 Old St", ContactPhone: "+91 9000000000",
		Status: "ACTIVE",
	}
	merged := ProfilePatch{ContactPhone: strPtr("+91 9111111111")}.apply(before)
	if merged.GSTIN != before.GSTIN {
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
		OwnerName: "P. Test",
		GSTIN: "29ABCDE1234F1ZW", PAN: "ABCDE1234F", BusinessAddress: "1 Test St",
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
	if after.GSTIN != "29ABCDE1234F1ZW" || after.OwnerName != "P. Test" {
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
		OwnerName: "S. Test", StateCode: "KA",
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

	u, token, err := repo.InviteSubUser(ctx, s.SellerID, "Staff One", "staff@example.com", "STAFF", "owner-test")
	if err != nil || u.Status != "PENDING_INVITE" || u.SubUserID == "" || token == "" || u.InviteExpiresAt == "" {
		t.Fatalf("invite: %+v token=%q err=%v", u, token, err)
	}
	if _, _, err := repo.InviteSubUser(ctx, s.SellerID, "Dup", "STAFF@example.com", "VIEWER", "owner-test"); err != ErrSubUserExists {
		t.Fatalf("duplicate invite (case-insensitive) err=%v, want ErrSubUserExists", err)
	}
	rows, err := repo.ListSubUsers(ctx, s.SellerID)
	if err != nil || len(rows) != 1 {
		t.Fatalf("list: len=%d err=%v", len(rows), err)
	}
	if got, ok, err := repo.SubUserByInviteToken(ctx, token); err != nil || !ok || got.SubUserID != u.SubUserID {
		t.Fatalf("token lookup: ok=%v err=%v got=%+v", ok, err, got)
	}
	_, resendTok, err := repo.ResendSubUserInvite(ctx, s.SellerID, u.SubUserID)
	if err != nil || resendTok == "" || resendTok == token {
		t.Fatalf("resend must rotate the token: %q err=%v", resendTok, err)
	}
	if _, ok, _ := repo.SubUserByInviteToken(ctx, token); ok {
		t.Fatal("resending must invalidate the previous invite token")
	}
	token = resendTok
	// AcceptSubUserInvite links the roster row to a real admins.portal_users credential
	// (sub_users_portal_user_fk + portal_users_sub_role_check), so seed one for the sub-user.
	const portalUserID = "pu-test-sub"
	if _, err := pool.Exec(ctx, `
		insert into admins.portal_users
		  (user_id, email, display_name, password_hash, role, seller_id, sub_role, sub_user_id, active, must_change)
		values ($1, $2, 'Staff One', 'x', 'SELLER', $3, $4, $5, true, false)
		on conflict (user_id) do nothing`,
		portalUserID, "staff@example.com", s.SellerID, u.Role, u.SubUserID); err != nil {
		t.Fatalf("seed sub-user credential: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from admins.portal_users where user_id = $1`, portalUserID)
	})
	active, ok, err := repo.AcceptSubUserInvite(ctx, token, portalUserID)
	if err != nil || !ok || active.Status != "ACTIVE" || active.AcceptedAt == "" {
		t.Fatalf("accept: ok=%v err=%v row=%+v", ok, err, active)
	}
	// The accept link is single-use.
	if _, ok, _ := repo.SubUserByInviteToken(ctx, token); ok {
		t.Fatal("an accepted invite token must no longer resolve")
	}
	if _, ok, err := repo.RevokeSubUser(ctx, s.SellerID, u.SubUserID); err != nil || !ok {
		t.Fatalf("revoke: ok=%v err=%v", ok, err)
	}
	if _, ok, err := repo.RevokeSubUser(ctx, s.SellerID, u.SubUserID); err != nil || !ok {
		t.Fatalf("revoke must be idempotent: ok=%v err=%v", ok, err)
	}
	// After revoke the same email can be invited again.
	if _, _, err := repo.InviteSubUser(ctx, s.SellerID, "Staff One", "staff@example.com", "STAFF", "owner-test"); err != nil {
		t.Fatalf("re-invite after revoke: %v", err)
	}
}

// TestFeeChangeRequestLifecycle exercises the full fee-change SQL path: create with a seller note,
// read it back, approve it (which must carry seller_note through its RETURNING list), then create a
// second request and reject that one. This is the only test that runs the real column lists — a
// mismatch between scanFeeRequest's destinations and any RETURNING clause only fails here.
func TestFeeChangeRequestLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	s, err := repo.Create(ctx, "user-fee-test", Seller{
		OwnerName: "F. Test",
		GSTIN: "29ABCDE1234F1ZW", PAN: "ABCDE1234F", BusinessAddress: "1 Test St",
		ContactPhone: "+91 9000000000", ContactEmail: "fee-test@example.com",
		StateCode: "PY", DistrictCode: "PY0",
	})
	if err != nil {
		t.Fatalf("create seller: %v", err)
	}
	storeID := "store-fee-test-1"
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from sellers.seller_fee_change_requests where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = $1`, s.SellerID)
	})
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, platform_fee_pct)
		values ($1, 'FOOD'::app_brand, 'Fee Test Kitchen', $2, 8)`, storeID, s.SellerID); err != nil {
		t.Fatalf("insert store: %v", err)
	}

	const note = "Rent and packaging costs went up"
	created, err := repo.CreateFeeChangeRequest(ctx, s.SellerID, storeID, s.DistrictCode, note, 8, 6)
	if err != nil {
		t.Fatalf("create fee request: %v", err)
	}
	if created.SellerNote != note || created.CurrentFeePct != 8 || created.RequestedFeePct != 6 {
		t.Fatalf("created row lost the seller note or fees: %+v", created)
	}
	if created.Status != "PENDING" || created.StoreID != storeID {
		t.Fatalf("created row has the wrong status/store: %+v", created)
	}

	// One PENDING row per store.
	if _, err := repo.CreateFeeChangeRequest(ctx, s.SellerID, storeID, s.DistrictCode, "", 8, 7); !errors.Is(err, ErrPendingRequest) {
		t.Fatalf("second pending request must be refused, got %v", err)
	}

	history, err := repo.ListSellerFeeChangeRequests(ctx, s.SellerID)
	if err != nil || len(history) != 1 {
		t.Fatalf("history: len=%d err=%v", len(history), err)
	}
	if history[0].SellerNote != note {
		t.Fatalf("history lost the seller note: %+v", history[0])
	}

	// Approval rewrites the store fee and must return seller_note without a column mismatch.
	_, approved, ok, err := repo.ApproveFeeChangeRequest(ctx, created.RequestID, "admin-test", "looks fine")
	if err != nil || !ok {
		t.Fatalf("approve: ok=%v err=%v", ok, err)
	}
	if approved.Status != "APPROVED" || approved.SellerNote != note {
		t.Fatalf("approved row lost the seller note: %+v", approved)
	}
	var liveFee int
	if err := pool.QueryRow(ctx, `select platform_fee_pct from directory.stores where id = $1`, storeID).Scan(&liveFee); err != nil {
		t.Fatalf("read live fee: %v", err)
	}
	if liveFee != 6 {
		t.Fatalf("approval did not apply the requested fee: got %d want 6", liveFee)
	}

	// A fresh request after approval, then reject it (the second RETURNING list).
	second, err := repo.CreateFeeChangeRequest(ctx, s.SellerID, storeID, s.DistrictCode, "", 6, 9)
	if err != nil {
		t.Fatalf("second request after approval: %v", err)
	}
	rejected, ok, err := repo.RejectFeeChangeRequest(ctx, second.RequestID, "admin-test", "too high")
	if err != nil || !ok {
		t.Fatalf("reject: ok=%v err=%v", ok, err)
	}
	if rejected.Status != "REJECTED" || rejected.ReviewReason != "too high" {
		t.Fatalf("rejected row is wrong: %+v", rejected)
	}
}

// TestVendorsProjectShopLocation guards the admin detail read: a shop's own address and map pin are
// written to directory.stores at onboarding and must come back from DetailByID (the review page
// previously showed only the fee, so an operator could not verify where a shop actually is).
func TestVendorsProjectShopLocation(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	lat, lng := 10.7905, 78.7047
	s, err := repo.CreateExtended(ctx, "user-loc-1", Seller{
		OwnerName: "B. Kumar",
		GSTIN: "33ABCDE1234F1Z5", PAN: "ABCDE1234F", BusinessAddress: "9 Test Rd",
		ContactPhone: "+91 9000000099", ContactEmail: "loc-projection@example.com", StateCode: "TN",
	}, nil, nil, []VendorSeed{{
		Name: "Pinned Shop", App: "MART", StateCode: "TN",
		Address: "12 Shop St", Phone: "+91 9000000098", Hours: "9 AM – 9 PM",
		Latitude: &lat, Longitude: &lng, PlatformFeePct: 12,
	}}, nil, nil)
	if err != nil {
		t.Fatalf("create with vendor: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.stores where seller_id = $1`, s.SellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = $1`, s.SellerID)
	})

	d, ok, err := repo.DetailByID(ctx, s.SellerID)
	if err != nil || !ok {
		t.Fatalf("detail: ok=%v err=%v", ok, err)
	}
	if len(d.Vendors) != 1 {
		t.Fatalf("want 1 vendor, got %d", len(d.Vendors))
	}
	v := d.Vendors[0]
	if v.Address != "12 Shop St" || v.Phone != "+91 9000000098" || v.Hours != "9 AM – 9 PM" {
		t.Fatalf("vendor identity not projected: %+v", v)
	}
	if v.Latitude == nil || *v.Latitude != lat || v.Longitude == nil || *v.Longitude != lng {
		t.Fatalf("vendor pin not projected: %+v", v)
	}
}
