package catalog

import (
	"context"
	"fmt"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"testing"
	"time"
)

func TestAddonFullLifecycleFood(t *testing.T) {
	repo := New(testenv.Pool(t))
	ctx := context.Background()
	sellerID, venueID := setupFoodVenue(t)

	// Create addon
	addon, ok, err := repo.CreateAddon(ctx, venueID, "Extra Cheese", "Toppings", "", "", 20000, true, sellerID, "")
	if err != nil || !ok {
		t.Fatalf("create addon: ok=%v err=%v", ok, err)
	}
	// Submit for review
	addon, _, err = repo.SubmitAddonForReview(ctx, addon.AddonID, sellerID, "")
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	// Approve
	addon, _, err = repo.SetAddonStatus(ctx, addon.AddonID, "ACTIVE", "", sellerID, "")
	if err != nil {
		t.Fatalf("approve: %v", err)
	}

	// Create a FOOD dish (product). The vertical column is `app` (catalog.products.sector never
	// existed), `mrp_paisa` was dropped by 0079, and `id` has no default.
	dishID := fmt.Sprintf("addon-dish-%d", time.Now().UnixNano())
	_, err = repo.pool.Exec(ctx, `INSERT INTO catalog.products (id, store_id, name, app, category, price_paisa, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`, dishID, venueID, "Test Dish", "FOOD", "GENERAL", 500, "ACTIVE")
	if err != nil {
		t.Fatalf("create dish: %v", err)
	}
	t.Cleanup(func() {
		_, _ = repo.pool.Exec(context.Background(), `delete from catalog.products where id=$1`, dishID)
	})

	// Link addon to dish
	linked, err := repo.LinkAddon(ctx, venueID, dishID, addon.AddonID, sellerID, "")
	if err != nil || !linked {
		t.Fatalf("link addon to dish: %v linked=%v", err, linked)
	}

	// Verify menu addons include the link
	menuAddons, err := repo.ListMenuAddons(ctx, sellerID, "", venueID, dishID)
	if err != nil {
		t.Fatalf("list menu addons: %v", err)
	}
	if len(menuAddons) != 1 || menuAddons[0].AddonID != addon.AddonID {
		t.Fatalf("expected linked menu addon, got %+v", menuAddons)
	}
}
