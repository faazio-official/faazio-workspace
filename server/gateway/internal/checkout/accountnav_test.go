package checkout

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func navDefaultsFixture() []NavDefault {
	return []NavDefault{
		{Key: "profile", Title: "Profile settings", SortOrder: 10, Rows: json.RawMessage(`[
			{"key":"orders","icon":"package","title":"My Orders"},
			{"key":"details","icon":"idcard","title":"My Profile"}
		]`)},
		{Key: "privacy", Title: "Privacy and security", SortOrder: 20, Rows: json.RawMessage(`[
			{"key":"delete-account","icon":"trash","title":"Delete account"}
		]`)},
		{Key: "empty", Title: "Empty group", SortOrder: 30, Rows: json.RawMessage(`[]`)},
	}
}

func navOverride(userID, key, rows string) Nav {
	return Nav{UserID: userID, Key: key, Rows: json.RawMessage(rows)}
}

func TestProjectAccountNavFreshUserGetsDefaults(t *testing.T) {
	groups, err := projectAccountNav(navDefaultsFixture(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 2 {
		t.Fatalf("groups = %d, want 2 (empty group omitted)", len(groups))
	}
	if groups[0].Key != "profile" || len(groups[0].Rows) != 2 {
		t.Fatalf("profile group = %+v", groups[0])
	}
	if groups[1].Key != "privacy" || len(groups[1].Rows) != 1 {
		t.Fatalf("privacy group = %+v", groups[1])
	}
}

func TestProjectAccountNavOverrideWinsForKnownKeys(t *testing.T) {
	groups, err := projectAccountNav(navDefaultsFixture(), []Nav{
		navOverride("u-1", "profile", `[{"key":"details","icon":"idcard","title":"My details"}]`),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(groups[0].Rows) != 1 || groups[0].Rows[0].Key != "details" {
		t.Fatalf("override not applied: %+v", groups[0].Rows)
	}
}

func TestProjectAccountNavIgnoresUnknownRowsAndGroups(t *testing.T) {
	groups, err := projectAccountNav(navDefaultsFixture(), []Nav{
		navOverride("u-1", "payments", `[{"key":"payments","title":"Payments"}]`),
		navOverride("u-1", "profile", `[{"key":"recently-viewed","title":"Recently Viewed"}]`),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 2 {
		t.Fatalf("groups = %d, want 2", len(groups))
	}
	if len(groups[0].Rows) != 2 {
		t.Fatalf("stale override replaced defaults: %+v", groups[0].Rows)
	}
	for _, r := range groups[0].Rows {
		if r.Key == "recently-viewed" {
			t.Fatal("unknown row must never be served")
		}
	}
}

func TestProjectAccountNavFiltersMixedOverride(t *testing.T) {
	groups, err := projectAccountNav(navDefaultsFixture(), []Nav{
		navOverride("u-1", "profile", `[
			{"key":"orders","title":"My Orders"},
			{"key":"recently-viewed","title":"Recently Viewed"}
		]`),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(groups[0].Rows) != 1 || groups[0].Rows[0].Key != "orders" {
		t.Fatalf("mixed override not filtered: %+v", groups[0].Rows)
	}
}

func TestProjectAccountNavMalformedDefaultErrors(t *testing.T) {
	defaults := []NavDefault{{Key: "profile", Title: "Profile", Rows: json.RawMessage(`{not-json`)}}
	if _, err := projectAccountNav(defaults, nil); err == nil {
		t.Fatal("malformed default JSON must surface an error, not an empty menu")
	}
}

func TestNavDefaultsMergeForFreshUser(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	defaults, err := repo.NavDefaults(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(defaults) == 0 {
		t.Skip("accounts.nav_defaults is empty (apply migration 0101)")
	}
	groups, err := projectAccountNav(defaults, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) == 0 {
		t.Fatal("a fresh user must receive a non-empty account menu")
	}
	for _, g := range groups {
		if len(g.Rows) == 0 {
			t.Fatalf("group %s has no rows", g.Key)
		}
	}
}
