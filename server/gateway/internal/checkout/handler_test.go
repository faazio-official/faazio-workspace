package checkout

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/auth"
)

func TestAuditActorRoleFallsBackForCustomers(t *testing.T) {
	if got := auditActorRole(context.Background()); got != auth.RoleSeller {
		t.Fatalf("auditActorRole(no role) = %q, want %q", got, auth.RoleSeller)
	}
}
