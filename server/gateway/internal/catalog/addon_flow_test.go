package catalog

import (
    "context"
    "testing"
    "github.com/faazio/server/gateway/internal/platform/testenv"
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

    // Create a FOOD dish (product)
    var dishID string
    err = repo.pool.QueryRow(ctx, `INSERT INTO catalog.products (store_id, name, sector, category, price_paisa, mrp_paisa, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, venueID, "Test Dish", "FOOD", "GENERAL", 500, 600, "ACTIVE").Scan(&dishID)
    if err != nil {
        t.Fatalf("create dish: %v", err)
    }

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
