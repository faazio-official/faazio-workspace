package admins

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestAuditAndStateAdmins(t *testing.T) {
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

	a, err := repo.CreateStateAdmin(ctx, StateAdmin{Name: "State Op", Email: "op@example.com", Phone: "9000000000", StateCode: "KA"})
	if err != nil {
		t.Fatalf("CreateStateAdmin: %v", err)
	}
	t.Cleanup(func() { _ = repo.DeleteStateAdmin(ctx, a.AdminID) })
	if a.AdminID == "" || !a.Active {
		t.Fatalf("unexpected state admin: %+v", a)
	}
	updated, ok, err := repo.SetStateAdminActive(ctx, a.AdminID, false)
	if err != nil || !ok || updated.Active {
		t.Fatalf("SetStateAdminActive: ok=%v err=%v active=%v", ok, err, updated.Active)
	}
	if err := repo.DeleteStateAdmin(ctx, a.AdminID); err != nil {
		t.Fatalf("DeleteStateAdmin: %v", err)
	}
}
