package blood

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestModerateBloodRequest(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	req, err := repo.CreateRequest(ctx, contracts.BloodRequest{
		Hospital: "Test Hospital", City: "Testville", State: "KA", BloodGroup: "O+", UnitsRequired: 1,
	})
	if err != nil {
		t.Fatalf("CreateRequest: %v", err)
	}

	// A district admin's state scope must not delete another state's request.
	if ok, err := repo.DeleteRequest(ctx, req.ID, "TN"); err != nil || ok {
		t.Fatalf("cross-state delete must be denied: ok=%v err=%v", ok, err)
	}
	ok, err := repo.DeleteRequest(ctx, req.ID, "KA")
	if err != nil || !ok {
		t.Fatalf("DeleteRequest: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.DeleteRequest(ctx, req.ID, ""); err != nil || ok {
		t.Fatalf("second DeleteRequest must report ok=false: ok=%v err=%v", ok, err)
	}
}
