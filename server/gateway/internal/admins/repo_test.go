package admins

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestAuditAndDistrictAdmins(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	if err := repo.Audit(ctx, contracts.AuditEntry{
		ActorID: "user-1", ActorRole: "SUPER_ADMIN", Action: "TEST_ACTION",
		Entity: "sellers.sellers", EntityID: "sel-test",
		After: []byte(`{"ok":true}`),
	}); err != nil {
		t.Fatalf("Audit: %v", err)
	}
	logs, err := repo.ListLogs(ctx, "SUPER_ADMIN", "sellers.sellers", 10)
	if err != nil {
		t.Fatalf("ListLogs: %v", err)
	}
	if len(logs) == 0 || logs[0].Action == "" {
		t.Fatalf("expected at least one audit row, got %+v", logs)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from admins.audit_logs where entity_id = 'sel-test'`) })

	a, err := repo.CreateDistrictAdmin(ctx, DistrictAdmin{Name: "District Op", Email: "op@example.com", Phone: "9000000000", DistrictCode: "TCH", StateCode: "TN"})
	if err != nil {
		t.Fatalf("CreateDistrictAdmin: %v", err)
	}
	t.Cleanup(func() { _ = repo.DeleteDistrictAdmin(ctx, a.AdminID) })
	if a.AdminID == "" || !a.Active {
		t.Fatalf("unexpected district admin: %+v", a)
	}
	updated, ok, err := repo.SetDistrictAdminActive(ctx, a.AdminID, false)
	if err != nil || !ok || updated.Active {
		t.Fatalf("SetDistrictAdminActive: ok=%v err=%v active=%v", ok, err, updated.Active)
	}
	if err := repo.DeleteDistrictAdmin(ctx, a.AdminID); err != nil {
		t.Fatalf("DeleteDistrictAdmin: %v", err)
	}
}

func TestCustomersProjection(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	uid := "user-cust-" + shortID()
	orderID := "ord-" + shortID()
	code := "fa600001919000000123"
	if _, err := pool.Exec(ctx, `
		insert into checkout.users (user_id, name, email, phone, state_code, district_code, pincode, customer_code)
		values ($1, 'Customer Test', 'c@t', '919000000123', 'KA', 'BLR', '560001', $2)`, uid, code); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id=$1`, uid) })
	if _, err := pool.Exec(ctx, `
		insert into checkout.orders (order_id, order_number, user_id, placed_at, status, total_paisa)
		values ($1, 'CUST-1', $2, now(), 'Delivered', 12345)`, orderID, uid); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.orders where order_id=$1`, orderID) })

	page, err := repo.Customers(ctx, CustomerFilter{StateCode: "KA", Limit: 10})
	if err != nil {
		t.Fatalf("Customers: %v", err)
	}
	var found *Customer
	for i := range page.Items {
		if page.Items[i].UserID == uid {
			found = &page.Items[i]
		}
	}
	if found == nil {
		t.Fatalf("customer %s missing from projection", uid)
	}
	if found.OrdersCount != 1 || found.Spend != 123 { // 12345 paisa -> 123 rupees (integer)
		t.Fatalf("customer projection wrong: %+v", *found)
	}
	if found.Phone != "919000000123" {
		t.Fatalf("phone missing from projection: %+v", *found)
	}
	if found.DistrictCode != "BLR" || found.Pincode != "560001" || found.CustomerCode != code {
		t.Fatalf("location fields missing from projection: %+v", *found)
	}
	if page.Total < 1 || page.TotalOrders < 1 || page.TotalSpendPaisa < 12345 {
		t.Fatalf("page totals wrong: %+v", page)
	}
	// The search term matches phone/name/user id/customer code/pincode server-side.
	for _, term := range []string{"9000000123", "customer test", uid, code, "560001"} {
		matched, err := repo.Customers(ctx, CustomerFilter{Query: term, Limit: 10})
		if err != nil {
			t.Fatalf("Customers search %q: %v", term, err)
		}
		var hit bool
		for _, c := range matched.Items {
			if c.UserID == uid {
				hit = true
			}
		}
		if !hit {
			t.Fatalf("search %q did not surface %s", term, uid)
		}
	}
	// District scoping narrows the directory.
	byDistrict, err := repo.Customers(ctx, CustomerFilter{DistrictCode: "BLR", Limit: 10})
	if err != nil {
		t.Fatalf("Customers district: %v", err)
	}
	var districtHit bool
	for _, c := range byDistrict.Items {
		if c.UserID == uid {
			districtHit = true
		}
	}
	if !districtHit {
		t.Fatalf("district filter did not surface %s", uid)
	}
	// Other states are filtered out.
	other, err := repo.Customers(ctx, CustomerFilter{StateCode: "DL", Limit: 10})
	if err != nil {
		t.Fatalf("Customers DL: %v", err)
	}
	for _, c := range other.Items {
		if c.UserID == uid {
			t.Fatal("state filter leaked a KA customer into DL")
		}
	}
	// Pagination: offset past the only matching row returns an empty page but keeps the total.
	paged, err := repo.Customers(ctx, CustomerFilter{StateCode: "KA", Limit: 10, Offset: 1000})
	if err != nil {
		t.Fatalf("Customers page: %v", err)
	}
	if len(paged.Items) != 0 || paged.Total < 1 {
		t.Fatalf("pagination wrong: %+v", paged)
	}
}
