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
	saved    []contracts.SduiSection
}

func (f *fakeLayouts) Home(context.Context) ([]contracts.SduiSection, int64, error) {
	return f.sections, f.version, nil
}

func (f *fakeLayouts) SaveHome(_ context.Context, sections []contracts.SduiSection) (int64, error) {
	f.saved = sections
	f.version++
	return f.version, nil
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
		&fakeLayouts{sections: []contracts.SduiSection{
			{ID: "deals", Title: "Deals", ProductIDs: []string{"md-1", "md-2"}},
			{ID: "empty", Title: "Empty", ProductIDs: []string{}},
			{ID: "mostRatedDining", Title: "Dining", StoreIDs: []string{"store-f1", "store-f2"}},
		{ID: "martHero", Title: "Highlights", Banners: []contracts.SduiBanner{
			{ID: "hb-1", Title: "Big Savings", Subtitle: "UP TO 50% OFF", ImageURL: "https://img.example/hb1.jpg"},
		}},
		}},
		&fakeLayouts{},
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
	if len(sections) != 4 {
		t.Fatalf("sections = %d, want 4", len(sections))
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
	if len(sections[3].Banners) != 1 || sections[3].Banners[0].ID != "hb-1" {
		t.Fatalf("martHero banners = %+v", sections[3].Banners)
	}
}

func TestMartCompilesOnlyMartSections(t *testing.T) {
	ctx := context.Background()
	c, err := cache.Connect(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(
		&fakeLayouts{sections: []contracts.SduiSection{
			{ID: "martHero", Title: "Highlights"},
			{ID: "adBanner", Title: "Offers"},
			{ID: "martDeals", Title: "Deals", ProductIDs: []string{"md-1"}},
			{ID: "mostRatedDining", Title: "Dining", StoreIDs: []string{"store-f1"}},
			{ID: "martEssentials", Title: "Essentials", ProductIDs: []string{"gr-p3"}},
		}},
		&fakeLayouts{},
		fakeProducts{byID: map[string]contracts.Product{
			"md-1":  {ID: "md-1", Name: "Milk", Price: 60},
			"gr-p3": {ID: "gr-p3", Name: "Fresh Milk", Price: 75},
		}},
		fakeStores{byID: map[string]contracts.Store{"store-f1": {ID: "store-f1"}}},
		c,
	)

	sections, _, err := svc.Mart(ctx, "en")
	if err != nil {
		t.Fatal(err)
	}
	if len(sections) != 3 {
		t.Fatalf("sections = %d, want 3 (only Mart rails)", len(sections))
	}
	byID := map[string]contracts.HomeSection{}
	for _, s := range sections {
		byID[s.ID] = s
	}
	if _, ok := byID["adBanner"]; ok {
		t.Fatalf("adBanner leaked into the Mart feed")
	}
	if len(byID["martDeals"].Products) != 1 || byID["martDeals"].Products[0].ID != "md-1" {
		t.Fatalf("martDeals products = %+v", byID["martDeals"].Products)
	}
	if len(byID["martEssentials"].Products) != 1 || byID["martEssentials"].Products[0].ID != "gr-p3" {
		t.Fatalf("martEssentials products = %+v", byID["martEssentials"].Products)
	}
}

func TestFoodCompilesOnlyFoodSections(t *testing.T) {
	ctx := context.Background()
	c, err := cache.Connect(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(
		&fakeLayouts{sections: []contracts.SduiSection{
			{ID: "foodHero", Title: "Highlights", Banners: []contracts.SduiBanner{{ID: "fb-1", Title: "Dining Deals"}}},
			{ID: "adBanner", Title: "Offers"},
			{ID: "martDeals", Title: "Deals", ProductIDs: []string{"md-1"}},
			{ID: "diningSpecials", Title: "Specials", StoreIDs: []string{"store-f1"}},
			{ID: "mostRatedDining", Title: "Dining", StoreIDs: []string{"store-f1", "store-f2"}},
		}},
		&fakeLayouts{},
		fakeProducts{byID: map[string]contracts.Product{"md-1": {ID: "md-1", Name: "Milk", Price: 60}}},
		fakeStores{byID: map[string]contracts.Store{
			"store-f1": {ID: "store-f1"},
			"store-f2": {ID: "store-f2"},
		}},
		c,
	)

	sections, _, err := svc.Food(ctx, "en")
	if err != nil {
		t.Fatal(err)
	}
	if len(sections) != 3 {
		t.Fatalf("sections = %d, want 3 (only Food rails)", len(sections))
	}
	byID := map[string]contracts.HomeSection{}
	for _, s := range sections {
		byID[s.ID] = s
	}
	if _, ok := byID["adBanner"]; ok {
		t.Fatalf("adBanner leaked into the Food feed")
	}
	if _, ok := byID["martDeals"]; ok {
		t.Fatalf("martDeals leaked into the Food feed")
	}
	if len(byID["foodHero"].Banners) != 1 || byID["foodHero"].Banners[0].ID != "fb-1" {
		t.Fatalf("foodHero banners = %+v", byID["foodHero"].Banners)
	}
	if len(byID["mostRatedDining"].Stores) != 2 || byID["mostRatedDining"].Stores[0].ID != "store-f1" {
		t.Fatalf("mostRatedDining stores = %+v", byID["mostRatedDining"].Stores)
	}
}

func TestSaveHomeBumpsVersionAndForwardsSections(t *testing.T) {
	ctx := context.Background()
	c, err := cache.Connect(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	w := &fakeLayouts{version: 3}
	svc := NewService(w, w, fakeProducts{}, fakeStores{}, c)

	sections := []contracts.SduiSection{{ID: "deals", Title: "Deals", ProductIDs: []string{"md-1"}}}
	version, err := svc.SaveHome(ctx, sections)
	if err != nil {
		t.Fatal(err)
	}
	if version != 4 {
		t.Fatalf("version = %d, want 4", version)
	}
	if len(w.saved) != 1 || w.saved[0].ID != "deals" {
		t.Fatalf("saved = %+v", w.saved)
	}
}
