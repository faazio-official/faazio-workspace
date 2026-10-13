package main

import "testing"

func TestContextOf(t *testing.T) {
	cases := map[string]string{
		"catalog":         "catalog",
		"catalog/handler": "catalog",
		"platform/cache":  "platform",
		"server":          "server",
		"search/repo":     "search",
	}
	for in, want := range cases {
		if got := contextOf(in); got != want {
			t.Errorf("contextOf(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSpecialContexts(t *testing.T) {
	for _, ctx := range []string{"server", "platform", "contracts"} {
		if !special[ctx] {
			t.Errorf("expected %q to be exempt from the sibling-import rule", ctx)
		}
	}
	if special["catalog"] {
		t.Error("catalog must not be exempt")
	}
}
