package categories

import (
	"context"
	"errors"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestCategoryLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	parent, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Test Parent", SortOrder: 9000, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create parent: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where parent_id = $1`, parent.ID)
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, parent.ID)
	})

	child, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Test Child", ParentID: &parent.ID, SortOrder: 9001, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create child: %v", err)
	}
	if child.ParentID == nil || *child.ParentID != parent.ID {
		t.Fatalf("child parent = %v, want %s", child.ParentID, parent.ID)
	}

	children, err := repo.List(ctx, ListOptions{App: "MART", ParentID: &parent.ID, ActiveOnly: true})
	if err != nil {
		t.Fatalf("list children: %v", err)
	}
	if len(children) != 1 || children[0].ID != child.ID {
		t.Fatalf("children = %+v, want the single child", children)
	}

	if updated, err := repo.Update(ctx, child.ID, Input{App: "MART", Name: "ZZ Test Child 2", ParentID: &parent.ID, SortOrder: 9001, GSTRateCategoryID: "gst-mart-packaged"}, "test"); err != nil || updated.Name != "ZZ Test Child 2" {
		t.Fatalf("update: name=%q err=%v", updated.Name, err)
	}

	// A nil ParentID means "unchanged": a plain name/GST edit must never detach an existing child.
	if kept, err := repo.Update(ctx, child.ID, Input{App: "MART", Name: "ZZ Test Child 3", SortOrder: 9001, GSTRateCategoryID: "gst-mart-packaged"}, "test"); err != nil {
		t.Fatalf("update without parent: %v", err)
	} else if kept.ParentID == nil || *kept.ParentID != parent.ID {
		t.Fatalf("update without parent detached the child: parent = %v, want %s", kept.ParentID, parent.ID)
	}

	if ok, err := repo.Deactivate(ctx, child.ID, "test"); err != nil || !ok {
		t.Fatalf("deactivate child: ok=%v err=%v", ok, err)
	}
	got, err := repo.Get(ctx, child.ID)
	if err != nil {
		t.Fatalf("get child: %v", err)
	}
	if got.IsActive {
		t.Fatal("deactivated category must be is_active=false (soft delete)")
	}
	if ok, _ := repo.Deactivate(ctx, "cat-does-not-exist", "test"); ok {
		t.Fatal("deactivate on a missing id must report ok=false")
	}
	if _, err := repo.Get(ctx, "cat-does-not-exist"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("get missing err = %v, want ErrNotFound", err)
	}
}

// TestHomeRailList pins the rail read contract: curated rows at any tree level are returned, and a
// FOOD row flagged on-rail (possible for a row written before the rule existed) is never served.
func TestHomeRailList(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()
	yes := true

	root, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Rail Root", SortOrder: 9100, ShowOnHomeRail: &yes, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create root: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, root.ID)
	})

	child, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Rail Child", ParentID: &root.ID, SortOrder: 9101, ShowOnHomeRail: &yes, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create child: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, child.ID)
	})

	food, err := repo.Create(ctx, Input{App: "FOOD", Name: "ZZ Rail Food", SortOrder: 9102, ShowOnHomeRail: &yes}, "test")
	if err != nil {
		t.Fatalf("create food: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, food.ID)
	})

	rail, err := repo.List(ctx, ListOptions{ActiveOnly: true, HomeRailOnly: true})
	if err != nil {
		t.Fatalf("list rail: %v", err)
	}
	seen := map[string]bool{}
	for _, c := range rail {
		seen[c.ID] = true
		if c.App == "FOOD" {
			t.Fatalf("rail returned a FOOD row: %+v", c)
		}
	}
	if !seen[root.ID] || !seen[child.ID] {
		t.Fatalf("rail must include the curated root and child; got %+v", rail)
	}
	if seen[food.ID] {
		t.Fatal("rail must never serve a FOOD row")
	}
}

// TestHeaderLabels pins the 0115 contract: every row carries its primary app label, a Mart/Pharma row
// can additionally be shared into MAIN_APP_HEADER, `Header` filters the curated lists, and the shared
// label mirrors show_on_home_rail.
func TestHeaderLabels(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	shared := []string{"MART", "MAIN_APP_HEADER"}
	mart, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Header Mart", SortOrder: 9200, HeaderLabels: &shared, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create mart: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, mart.ID)
	})
	if !mart.ShowOnHomeRail || !hasLabel(mart.HeaderLabels, "MAIN_APP_HEADER") || !hasLabel(mart.HeaderLabels, "MART") {
		t.Fatalf("created row = rail %v labels %v, want shared MART row", mart.ShowOnHomeRail, mart.HeaderLabels)
	}

	plain, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Header Plain", SortOrder: 9201, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create plain: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, plain.ID)
	})
	if plain.ShowOnHomeRail || hasLabel(plain.HeaderLabels, "MAIN_APP_HEADER") || !hasLabel(plain.HeaderLabels, "MART") {
		t.Fatalf("plain row = rail %v labels %v, want app label only", plain.ShowOnHomeRail, plain.HeaderLabels)
	}

	mainList, err := repo.List(ctx, ListOptions{ActiveOnly: true, Header: HeaderMainApp})
	if err != nil {
		t.Fatalf("list main header: %v", err)
	}
	if !containsID(mainList, mart.ID) || containsID(mainList, plain.ID) {
		t.Fatalf("MAIN_APP_HEADER list must hold only the shared row")
	}
	if containsID(mainList, "cat_north_indian") {
		t.Fatal("MAIN_APP_HEADER list must never serve a FOOD row")
	}

	rail, err := repo.List(ctx, ListOptions{ActiveOnly: true, HomeRailOnly: true})
	if err != nil {
		t.Fatalf("list rail: %v", err)
	}
	if !containsID(rail, mart.ID) {
		t.Fatal("rail must serve the MAIN_APP_HEADER-labelled row")
	}

	martOnly := []string{"MART"}
	updated, err := repo.Update(ctx, mart.ID, Input{
		App: "MART", Name: "ZZ Header Mart", SortOrder: 9200, HeaderLabels: &martOnly,
		GSTRateCategoryID: "gst-mart-packaged",
	}, "test")
	if err != nil {
		t.Fatalf("update labels: %v", err)
	}
	if updated.ShowOnHomeRail || hasLabel(updated.HeaderLabels, "MAIN_APP_HEADER") {
		t.Fatalf("removing the shared label must clear rail: rail %v labels %v", updated.ShowOnHomeRail, updated.HeaderLabels)
	}

	// A header-agnostic update (nil HeaderLabels, nil ShowOnHomeRail) keeps the stored labels.
	kept, err := repo.Update(ctx, mart.ID, Input{App: "MART", Name: "ZZ Header Mart 2", SortOrder: 9200}, "test")
	if err != nil {
		t.Fatalf("update untouched labels: %v", err)
	}
	if !hasLabel(kept.HeaderLabels, "MART") {
		t.Fatalf("labels = %v, want MART preserved", kept.HeaderLabels)
	}

	// FOOD can never carry the shared label, even via the legacy rail flag.
	yes := true
	food, err := repo.Create(ctx, Input{App: "FOOD", Name: "ZZ Header Food", SortOrder: 9202, ShowOnHomeRail: &yes}, "test")
	if err != nil {
		t.Fatalf("create food: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, food.ID)
	})
	if food.ShowOnHomeRail || hasLabel(food.HeaderLabels, "MAIN_APP_HEADER") || !hasLabel(food.HeaderLabels, "FOOD") {
		t.Fatalf("food = rail %v labels %v, want FOOD label only", food.ShowOnHomeRail, food.HeaderLabels)
	}
}

// TestDeleteWithMove pins the category-delete contract: the subtree is hidden, listings are never
// orphaned, a move target is mandatory once listings exist, and the target must be a live
// sibling-level category in the same app.
func TestDeleteWithMove(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	var storeID string
	if err := pool.QueryRow(ctx, `
		select id from directory.stores where app = 'MART'::app_brand and is_live order by id limit 1`).
		Scan(&storeID); err != nil {
		t.Skipf("no live MART store to hang test listings on: %v", err)
	}

	mkProduct := func(id, category, taxonomyID string) {
		if _, err := pool.Exec(ctx, `
			insert into catalog.products (id, app, category, name, price_paisa, store_id, status, taxonomy_category_id)
			values ($1, 'MART'::app_brand, $2, $1, 1000, $3, 'ACTIVE'::product_status, $4)`,
			id, category, storeID, taxonomyID); err != nil {
			t.Fatalf("seed product %s: %v", id, err)
		}
	}

	parent, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Del Parent", SortOrder: 9300, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create parent: %v", err)
	}
	keep, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Del Keep", SortOrder: 9301, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create keep: %v", err)
	}
	keepLeaf, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Del Keep Leaf", ParentID: &keep.ID, SortOrder: 9302, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create keep leaf: %v", err)
	}
	child, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Del Child", ParentID: &parent.ID, SortOrder: 9303, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create child: %v", err)
	}
	grand, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Del Grand", ParentID: &child.ID, SortOrder: 9304, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create grandchild: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from catalog.products where id like 'zzdel-%'`)
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = any($1)`,
			[]string{grand.ID, child.ID, parent.ID, keepLeaf.ID, keep.ID})
	})

	mkProduct("zzdel-a", grand.Name, grand.ID)
	mkProduct("zzdel-b", grand.Name, grand.ID)
	mkProduct("zzdel-c", child.Name, child.ID)

	// 1. Listings in the subtree and no move target → refused, nothing hidden.
	if _, err := repo.Delete(ctx, parent.ID, "", "", "test"); !errors.Is(err, ErrCategoryHasProducts) {
		t.Fatalf("delete without moveTo err = %v, want ErrCategoryHasProducts", err)
	}
	if got, err := repo.Get(ctx, parent.ID); err != nil || !got.IsActive {
		t.Fatalf("a refused delete must leave the category live: active=%v err=%v", got.IsActive, err)
	}

	// 2. A same-level but different-level target (leaf child) is rejected: parent→child mixes levels.
	if _, err := repo.Delete(ctx, parent.ID, child.ID, "", "test"); !errors.Is(err, ErrInvalidMoveTarget) {
		t.Fatalf("cross-level target err = %v, want ErrInvalidMoveTarget", err)
	}
	// A target inside the subtree is rejected too.
	if _, err := repo.Delete(ctx, parent.ID, parent.ID, "", "test"); !errors.Is(err, ErrInvalidMoveTarget) {
		t.Fatalf("self target err = %v, want ErrInvalidMoveTarget", err)
	}

	// 3. A valid top-level target moves every listing onto its active leaf and hides the subtree.
	res, err := repo.Delete(ctx, parent.ID, keep.ID, "", "test")
	if err != nil {
		t.Fatalf("delete with moveTo: %v", err)
	}
	if res.MovedProducts != 3 {
		t.Fatalf("movedProducts = %d, want 3", res.MovedProducts)
	}
	if res.Trashed != 3 {
		t.Fatalf("deactivated = %d, want 3 (parent+child+grandchild)", res.Trashed)
	}
	if res.TargetID != keepLeaf.ID || res.TargetName != keepLeaf.Name {
		t.Fatalf("target = %s/%s, want the destination's active leaf %s/%s",
			res.TargetID, res.TargetName, keepLeaf.ID, keepLeaf.Name)
	}
	for _, id := range []string{"zzdel-a", "zzdel-b", "zzdel-c"} {
		var cat, tax string
		if err := pool.QueryRow(ctx, `select category, taxonomy_category_id from catalog.products where id = $1`, id).
			Scan(&cat, &tax); err != nil {
			t.Fatalf("read moved product %s: %v", id, err)
		}
		if tax != keepLeaf.ID || cat != keepLeaf.Name {
			t.Fatalf("product %s = %q/%q, want %q/%q", id, cat, tax, keepLeaf.Name, keepLeaf.ID)
		}
	}
	for _, id := range []string{parent.ID, child.ID, grand.ID} {
		got, err := repo.Get(ctx, id)
		if err != nil {
			t.Fatalf("get %s: %v", id, err)
		}
		if got.IsActive || got.DeletedAt == "" || got.PurgeAt == "" {
			t.Fatalf("category %s must be trashed (inactive + deletedAt/purgeAt): %+v", id, got)
		}
	}
	if got, err := repo.Get(ctx, keep.ID); err != nil || !got.IsActive {
		t.Fatalf("the move target must stay live: active=%v err=%v", got.IsActive, err)
	}

	// 4. A category with no listings needs no move target and still hides its subtree.
	empty, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Del Empty", SortOrder: 9305, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create empty parent: %v", err)
	}
	emptyChild, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Del Empty Child", ParentID: &empty.ID, SortOrder: 9306, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create empty child: %v", err)
	}
	if res, err := repo.Delete(ctx, empty.ID, "", "", "test"); err != nil {
		t.Fatalf("delete without listings: %v", err)
	} else if res.Trashed != 2 || res.MovedProducts != 0 {
		t.Fatalf("empty delete = hidden %d moved %d, want 2/0", res.Trashed, res.MovedProducts)
	}
	if got, err := repo.Get(ctx, emptyChild.ID); err != nil || got.IsActive || got.DeletedAt == "" {
		t.Fatalf("deleting a parent must cascade to its children: %+v err=%v", got, err)
	}
	// 5. A missing id reports ErrCategoryNotFound.
	if _, err := repo.Delete(ctx, "cat-does-not-exist", "", "", "test"); !errors.Is(err, ErrCategoryNotFound) {
		t.Fatalf("missing id err = %v, want ErrCategoryNotFound", err)
	}
}

// TestCategoryProductCount pins the count the portal uses to decide whether a delete needs a move
// target: it counts live listings linked directly to the node.
func TestCategoryProductCount(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	var storeID string
	if err := pool.QueryRow(ctx, `
		select id from directory.stores where app = 'MART'::app_brand and is_live order by id limit 1`).
		Scan(&storeID); err != nil {
		t.Skipf("no live MART store to hang test listings on: %v", err)
	}

	cat, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Count Cat", SortOrder: 9400, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from catalog.products where id like 'zzcnt-%'`)
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, cat.ID)
	})
	for _, id := range []string{"zzcnt-1", "zzcnt-2"} {
		if _, err := pool.Exec(ctx, `
			insert into catalog.products (id, app, category, name, price_paisa, store_id, status, taxonomy_category_id)
			values ($1, 'MART'::app_brand, $2, $1, 1000, $3, 'ACTIVE'::product_status, $4)`,
			id, cat.Name, storeID, cat.ID); err != nil {
			t.Fatalf("seed product: %v", err)
		}
	}

	got, err := repo.Get(ctx, cat.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ProductCount != 2 {
		t.Fatalf("productCount = %d, want 2", got.ProductCount)
	}
}

// TestCategoryTrashLifecycle pins the soft-delete contract: a delete moves the node and its subtree
// to the trash (excluded from live reads, listed under Trash), restore brings the subtree back
// deactivated, and a permanent delete removes only an unreferenced trashed subtree.
func TestCategoryTrashLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	parent, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Trash Parent", SortOrder: 9500, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create parent: %v", err)
	}
	child, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Trash Child", ParentID: &parent.ID, SortOrder: 9501, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create child: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = any($1)`,
			[]string{child.ID, parent.ID})
	})

	if _, err := repo.Delete(ctx, parent.ID, "", "duplicate row", "test"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	// A trashed row is excluded from the live list, and listed only under Trash.
	live, err := repo.List(ctx, ListOptions{App: "MART"})
	if err != nil {
		t.Fatalf("list live: %v", err)
	}
	for _, c := range live {
		if c.ID == parent.ID || c.ID == child.ID {
			t.Fatalf("a trashed row leaked into the live list: %s", c.ID)
		}
	}
	trash, err := repo.List(ctx, ListOptions{App: "MART", Trash: true})
	if err != nil {
		t.Fatalf("list trash: %v", err)
	}
	seen := map[string]Category{}
	for _, c := range trash {
		seen[c.ID] = c
	}
	// Only the root of the trashed subtree is listed (the child's parent is trashed).
	if _, ok := seen[child.ID]; ok {
		t.Fatalf("a trashed descendant leaked into the trash list; only the subtree root should list")
	}
	c, ok := seen[parent.ID]
	if !ok {
		t.Fatalf("trashed root %s missing from the trash list", parent.ID)
	}
	if c.DeletedAt == "" || c.PurgeAt == "" || c.IsActive {
		t.Fatalf("trashed row %s = %+v, want deletedAt/purgeAt set and inactive", parent.ID, c)
	}
	if c.DeleteReason != "duplicate row" {
		t.Fatalf("delete reason = %q, want %q", c.DeleteReason, "duplicate row")
	}

	// Restore brings the whole subtree back, deactivated.
	restored, err := repo.Restore(ctx, parent.ID, "test")
	if err != nil {
		t.Fatalf("restore: %v", err)
	}
	if restored.DeletedAt != "" || restored.IsActive {
		t.Fatalf("restored row = %+v, want live but deactivated", restored)
	}
	if got, err := repo.Get(ctx, child.ID); err != nil || got.DeletedAt != "" {
		t.Fatalf("restore must clear the child's trash flag too: %+v err=%v", got, err)
	}

	// Purge one subtree: trash it again, then delete forever.
	if _, err := repo.Delete(ctx, parent.ID, "", "", "test"); err != nil {
		t.Fatalf("delete again: %v", err)
	}
	res, err := repo.PurgeOne(ctx, parent.ID)
	if err != nil {
		t.Fatalf("purge: %v", err)
	}
	if res.Purged != 2 {
		t.Fatalf("purged = %d, want 2 (parent+child)", res.Purged)
	}
	for _, id := range []string{parent.ID, child.ID} {
		if _, err := repo.Get(ctx, id); !errors.Is(err, ErrNotFound) {
			t.Fatalf("row %s still exists after purge: err=%v", id, err)
		}
	}
}

// TestCategoryPurgeRefusesReferences pins that a trashed subtree still referenced by a listing or a
// store is never hard-deleted, so "delete forever" cannot orphan a reference.
func TestCategoryPurgeRefusesReferences(t *testing.T) {
	pool := testenv.Pool(t)
	repo := NewRepo(pool)
	ctx := context.Background()

	cat, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Purge Ref", SortOrder: 9600, GSTRateCategoryID: "gst-mart-packaged"}, "test")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.stores where seller_category_id = $1`, cat.ID)
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, cat.ID)
	})
	if _, err := repo.Delete(ctx, cat.ID, "", "", "test"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	var storeID string
	if err := pool.QueryRow(ctx, `
		select id from directory.stores where app = 'MART'::app_brand order by id limit 1`).Scan(&storeID); err != nil {
		t.Skipf("no MART store to reference the category: %v", err)
	}
	if _, err := pool.Exec(ctx, `update directory.stores set seller_category_id = $1 where id = $2`, cat.ID, storeID); err != nil {
		t.Fatalf("link store: %v", err)
	}

	if _, err := repo.PurgeOne(ctx, cat.ID); !errors.Is(err, ErrStillReferenced) {
		t.Fatalf("purge with a store reference err = %v, want ErrStillReferenced", err)
	}
	if _, err := repo.Get(ctx, cat.ID); err != nil {
		t.Fatalf("a refused purge must leave the trashed row in place: %v", err)
	}
}

func hasLabel(labels []string, want string) bool {
	for _, h := range labels {
		if h == want {
			return true
		}
	}
	return false
}

func containsID(rows []Category, id string) bool {
	for _, c := range rows {
		if c.ID == id {
			return true
		}
	}
	return false
}
