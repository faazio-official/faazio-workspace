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
			{ID: "foodSpecials", Title: "Specials", ProductIDs: []string{"sp-1", "sp-2"}},
			{ID: "mostRatedDining", Title: "Dining", StoreIDs: []string{"store-f1", "store-f2"}},
		}},
		&fakeLayouts{},
		fakeProducts{byID: map[string]contracts.Product{
			"md-1": {ID: "md-1", Name: "Milk", Price: 60},
			"sp-1": {ID: "sp-1", Name: "Biryani", Price: 499},
			"sp-2": {ID: "sp-2", Name: "Dum Biryani", Price: 320},
		}},
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
	if len(byID["foodSpecials"].Products) != 2 || byID["foodSpecials"].Products[0].ID != "sp-1" {
		t.Fatalf("foodSpecials products = %+v", byID["foodSpecials"].Products)
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

func TestPharmaCompilesOnlyPharmaSections(t *testing.T) {
	ctx := context.Background()
	c, err := cache.Connect(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(
		&fakeLayouts{sections: []contracts.SduiSection{
			{ID: "pharmaHero", Title: "Highlights", Banners: []contracts.SduiBanner{{ID: "phb-1", Title: "Health Essentials"}}},
			{ID: "adBanner", Title: "Offers"},
			{ID: "martDeals", Title: "Deals", ProductIDs: []string{"md-1"}},
			{ID: "pharmaPopular", Title: "Popular Medicines", ProductIDs: []string{"ph-t1", "ph-c1"}},
			{ID: "pharmaEssentials", Title: "Health Essentials", ProductIDs: []string{"ph-om1"}},
		}},
		&fakeLayouts{},
		fakeProducts{byID: map[string]contracts.Product{
			"md-1":   {ID: "md-1", Name: "Milk", Price: 60},
			"ph-t1":  {ID: "ph-t1", Name: "Turmeric Gummies", Price: 810},
			"ph-c1":  {ID: "ph-c1", Name: "Tulsi Syrup", Price: 145},
			"ph-om1": {ID: "ph-om1", Name: "Omega-3", Price: 649},
		}},
		fakeStores{},
		c,
	)

	sections, _, err := svc.Pharma(ctx, "en")
	if err != nil {
		t.Fatal(err)
	}
	if len(sections) != 3 {
		t.Fatalf("sections = %d, want 3 (only Pharma rails)", len(sections))
	}
	byID := map[string]contracts.HomeSection{}
	for _, s := range sections {
		byID[s.ID] = s
	}
	if _, ok := byID["adBanner"]; ok {
		t.Fatalf("adBanner leaked into the Pharma feed")
	}
	if _, ok := byID["martDeals"]; ok {
		t.Fatalf("martDeals leaked into the Pharma feed")
	}
	if len(byID["pharmaHero"].Banners) != 1 || byID["pharmaHero"].Banners[0].ID != "phb-1" {
		t.Fatalf("pharmaHero banners = %+v", byID["pharmaHero"].Banners)
	}
	if len(byID["pharmaPopular"].Products) != 2 || byID["pharmaPopular"].Products[0].ID != "ph-t1" {
		t.Fatalf("pharmaPopular products = %+v", byID["pharmaPopular"].Products)
	}
	if len(byID["pharmaEssentials"].Products) != 1 || byID["pharmaEssentials"].Products[0].ID != "ph-om1" {
		t.Fatalf("pharmaEssentials products = %+v", byID["pharmaEssentials"].Products)
	}
}

func TestCampaignsCompileJoinsStoreAndProducts(t *testing.T) {
	ctx := context.Background()
	c, err := cache.Connect(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(
		&fakeLayouts{sections: []contracts.SduiSection{
			{ID: "adBanner", Title: "Offers"},
			{ID: "hotBrandDeals", Title: "Deals of the day", Campaigns: []contracts.SduiCampaign{
				{ID: "camp-a", StoreID: "store-m1", ProductIDs: []string{"fm-m1", "fm-m2"}, Carousel: 1},
				{ID: "camp-b", StoreID: "store-m9", ProductIDs: []string{"fm-x1"}, Carousel: 2},
			}},
		}},
		&fakeLayouts{},
		fakeProducts{byID: map[string]contracts.Product{
			"fm-m1": {ID: "fm-m1", Name: "Phone Pro", Price: 89999},
			"fm-m2": {ID: "fm-m2", Name: "Flip 5G", Price: 69999},
			"fm-x1": {ID: "fm-x1", Name: "Missing Store Product", Price: 100},
		}},
		fakeStores{byID: map[string]contracts.Store{
			"store-m1": {ID: "store-m1", Name: "Darling Mobiles"},
		}},
		c,
	)

	campaigns, _, err := svc.Campaigns(ctx, "en")
	if err != nil {
		t.Fatal(err)
	}
	if len(campaigns) != 2 {
		t.Fatalf("campaigns = %d, want 2", len(campaigns))
	}
	a := campaigns[0]
	if a.ID != "camp-a" || a.Carousel != 1 || a.Store == nil || a.Store.ID != "store-m1" {
		t.Fatalf("camp-a = %+v", a)
	}
	if len(a.Products) != 2 || a.Products[0].ID != "fm-m1" {
		t.Fatalf("camp-a products = %+v", a.Products)
	}
	// Unknown store -> store omitted (products still join), never a fabricated store.
	b := campaigns[1]
	if b.Store != nil {
		t.Fatalf("camp-b store = %+v, want nil", b.Store)
	}
	if len(b.Products) != 1 || b.Products[0].ID != "fm-x1" {
		t.Fatalf("camp-b products = %+v", b.Products)
	}

	one, _, found, err := svc.Campaign(ctx, "en", "camp-b")
	if err != nil || !found {
		t.Fatalf("Campaign(camp-b) found=%v err=%v", found, err)
	}
	if one.ID != "camp-b" || one.Carousel != 2 {
		t.Fatalf("one = %+v", one)
	}
	if _, _, found, _ := svc.Campaign(ctx, "en", "nope"); found {
		t.Fatalf("unknown campaign should not be found")
	}
}
