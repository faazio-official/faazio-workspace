package sdui

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
)

type fakeLayouts struct {
	sections []contracts.SduiSection
	version  int64
}

func (f fakeLayouts) Home(context.Context) ([]contracts.SduiSection, int64, error) {
	return f.sections, f.version, nil
}

type fakeProducts struct{ byID map[string]contracts.Product }

func (f fakeProducts) ByID(_ context.Context, id string) (contracts.Product, bool, error) {
	p, ok := f.byID[id]
	return p, ok, nil
}
func (f fakeProducts) ByIDs(_ context.Context, ids []string) ([]contracts.Product, error) {
	out := make([]contracts.Product, 0, len(ids))
	for _, id := range ids {
		if p, ok := f.byID[id]; ok {
			out = append(out, p)
		}
	}
	return out, nil
}
func (f fakeProducts) Search(context.Context, string, string, int) ([]contracts.Product, error) {
	return nil, nil
}

type fakeStores struct{ byID map[string]contracts.Store }

func (fakeStores) ByApp(context.Context, string) ([]contracts.Store, error) { return nil, nil }
func (f fakeStores) ByID(_ context.Context, id string) (contracts.Store, bool, error) {
	s, ok := f.byID[id]
	return s, ok, nil
}
func (f fakeStores) ByIDs(_ context.Context, ids []string) ([]contracts.Store, error) {
	out := make([]contracts.Store, 0, len(ids))
	for _, id := range ids {
		if s, ok := f.byID[id]; ok {
			out = append(out, s)
		}
	}
	return out, nil
}

func TestHomeCompilesSectionsWithProducts(t *testing.T) {
	ctx := context.Background()
	c, err := cache.Connect(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(
		fakeLayouts{sections: []contracts.SduiSection{
			{ID: "deals", Title: "Deals", ProductIDs: []string{"md-1", "md-2"}},
			{ID: "empty", Title: "Empty", ProductIDs: []string{}},
			{ID: "mostRatedDining", Title: "Dining", StoreIDs: []string{"store-f1", "store-f2"}},
		}},
		fakeProducts{byID: map[string]contracts.Product{
			"md-1": {ID: "md-1", Name: "Milk", Price: 60},
			"md-2": {ID: "md-2", Name: "Bread", Price: 40},
		}},
		fakeStores{byID: map[string]contracts.Store{
			"store-f1": {ID: "store-f1", Name: "Hawker Lane"},
			"store-f2": {ID: "store-f2", Name: "Ramen House"},
		}},
		c,
	)

	sections, _, err := svc.Home(ctx, "en")
	if err != nil {
		t.Fatal(err)
	}
	if len(sections) != 3 {
		t.Fatalf("sections = %d, want 3", len(sections))
	}
	if len(sections[0].Products) != 2 || sections[0].Products[0].ID != "md-1" {
		t.Fatalf("deals products = %+v", sections[0].Products)
	}
	if len(sections[1].Products) != 0 {
		t.Fatalf("empty section products = %+v", sections[1].Products)
	}
	if len(sections[2].Stores) != 2 || sections[2].Stores[0].ID != "store-f1" {
		t.Fatalf("dining stores = %+v", sections[2].Stores)
	}
}
