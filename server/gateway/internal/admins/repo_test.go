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
	if _, err := pool.Exec(ctx, `
		insert into checkout.users (user_id, name, email, phone, state_code)
		values ($1, 'Customer Test', 'c@t', '0', 'KA')`, uid); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id=$1`, uid) })
	if _, err := pool.Exec(ctx, `
		insert into checkout.orders (order_id, order_number, user_id, placed_at, status, total_paisa)
		values ($1, 'CUST-1', $2, now(), 'Delivered', 12345)`, orderID, uid); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.orders where order_id=$1`, orderID) })

	list, err := repo.Customers(ctx, "KA", 10)
	if err != nil {
		t.Fatalf("Customers: %v", err)
	}
	var found *Customer
	for i := range list {
		if list[i].UserID == uid {
			found = &list[i]
		}
	}
	if found == nil {
		t.Fatalf("customer %s missing from projection", uid)
	}
	if found.OrdersCount != 1 || found.Spend != 123 { // 12345 paisa -> 123 rupees (integer)
		t.Fatalf("customer projection wrong: %+v", *found)
	}
	// Other states are filtered out.
	other, err := repo.Customers(ctx, "DL", 10)
	if err != nil {
		t.Fatalf("Customers DL: %v", err)
	}
	for _, c := range other {
		if c.UserID == uid {
			t.Fatal("state filter leaked a KA customer into DL")
		}
	}
}
