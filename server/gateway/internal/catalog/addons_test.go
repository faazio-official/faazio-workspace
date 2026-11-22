package catalog

import (
    "context"
    "testing"
    "github.com/faazio/server/gateway/internal/platform/testenv"
)

// Helper to create a test repo with in‑memory DB.
func setupTestRepo(t *testing.T) *Repo {
    t.Helper()
    pool := testenv.NewTestPool(t)
    repo := NewRepo(pool, nil)
    return repo
}

func TestAddonWorkflow(t *testing.T) {
    repo := setupTestRepo(t)
    ctx := context.Background()
    venueID := "venue-1"
    sellerID := "seller-1"
    district := "dist-1"

    // 1. Create an add‑on (draft)
    a, err := repo.CreateAddon(ctx, venueID, "Extra Cheese", "Toppings", 200, true)
    if err != nil {
        t.Fatalf("create addon: %v", err)
    }
    if a.Status != "DRAFT" {
        t.Fatalf("expected DRAFT, got %s", a.Status)
    }

    // 2. Submit for review
    a, found, err := repo.SubmitAddonForReview(ctx, a.AddonID, sellerID, district)
    if err != nil || !found {
        t.Fatalf("submit for review: %v, found=%v", err, found)
    }
    if a.Status != "PENDING_REVIEW" {
        t.Fatalf("expected PENDING_REVIEW, got %s", a.Status)
    }

    // 3. Approve as admin
    a, found, err = repo.SetAddonStatus(ctx, a.AddonID, "ACTIVE", "", sellerID, district)
    if err != nil || !found {
        t.Fatalf("approve: %v, found=%v", err, found)
    }
    if a.Status != "ACTIVE" {
        t.Fatalf("expected ACTIVE, got %s", a.Status)
    }

    // 4. Link to a product (create dummy product first)
    var productID string
    err = repo.pool.QueryRow(ctx, `INSERT INTO catalog.products (store_id, name, sector, category, price_paisa, mrp_paisa, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, venueID, "Test Product", "MART", "GENERAL", 500, 600, "ACTIVE").Scan(&productID)
    if err != nil {
        t.Fatalf("create product: %v", err)
    }

    linked, err := repo.LinkProductAddon(ctx, venueID, productID, a.AddonID, sellerID, district)
    if err != nil || !linked {
        t.Fatalf("link addon to product: %v, linked=%v", err, linked)
    }

    // 5. Public list should now include the addon for the product
    public, err := repo.ListProductAddonsPublic(ctx, productID)
    if err != nil {
        t.Fatalf("list public addons: %v", err)
    }
    if len(public) != 1 || public[0].ID != a.AddonID {
        t.Fatalf("expected public addon list to contain the linked addon, got %+v", public)
    }
}

func TestAddonRejectAndRequestChanges(t *testing.T) {
    repo := setupTestRepo(t)
    ctx := context.Background()
    venueID := "venue-2"
    sellerID := "seller-2"
    district := "dist-2"

    a, err := repo.CreateAddon(ctx, venueID, "Bad Addon", "Toppings", 100, false)
    if err != nil {
        t.Fatalf("create addon: %v", err)
    }
    // Submit
    a, _, _ = repo.SubmitAddonForReview(ctx, a.AddonID, sellerID, district)

    // Reject with reason
    a, _, err = repo.SetAddonStatus(ctx, a.AddonID, "DRAFT", "Too cheap", sellerID, district)
    if err != nil {
        t.Fatalf("reject addon: %v", err)
    }
    if a.Status != "DRAFT" || a.ReviewReason != "Too cheap" {
        t.Fatalf("reject did not set status/reason: %+v", a)
    }

    // Request changes
    a, _, err = repo.SetAddonStatus(ctx, a.AddonID, "CHANGES_REQUESTED", "Add description", sellerID, district)
    if err != nil {
        t.Fatalf("request changes: %v", err)
    }
    if a.Status != "CHANGES_REQUESTED" {
        t.Fatalf("expected CHANGES_REQUESTED, got %s", a.Status)
    }
}
