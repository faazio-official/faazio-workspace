package checkout

import "testing"

func TestTotalPaisaIncludesAddons(t *testing.T) {
	lines := []OrderLineItem{{
		Qty: 2, UnitPrice: 100, // ₹200 base
		Addons: []OrderLineAddon{{Name: "Extra Cheese", UnitPrice: 20, Qty: 2}}, // ₹40
	}}
	if got := totalPaisa(lines); got != 24000 {
		t.Fatalf("totalPaisa = %d, want 24000", got)
	}
}
