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

	parent, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Test Parent", SortOrder: 9000}, "test")
	if err != nil {
		t.Fatalf("create parent: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where parent_id = $1`, parent.ID)
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = $1`, parent.ID)
	})

	child, err := repo.Create(ctx, Input{App: "MART", Name: "ZZ Test Child", ParentID: &parent.ID, SortOrder: 9001}, "test")
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

	if updated, err := repo.Update(ctx, child.ID, Input{App: "MART", Name: "ZZ Test Child 2", ParentID: &parent.ID, SortOrder: 9001}, "test"); err != nil || updated.Name != "ZZ Test Child 2" {
		t.Fatalf("update: name=%q err=%v", updated.Name, err)
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
