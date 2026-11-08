package checkout

import "testing"

// TestDiscountedUnitPaisa locks the settlement re-pricing: the festival discount the app overlays
// must be honored server-side, and an out-of-range percent must never change (or raise) the price.
func TestDiscountedUnitPaisa(t *testing.T) {
	cases := []struct {
		name    string
		price   int64
		percent int
		want    int64
	}{
		{"no discount", 10000, 0, 10000},
		{"twenty percent", 10000, 20, 8000},
		{"rounds down", 9999, 15, 8499},
		{"hundred ignored", 10000, 100, 10000},
		{"negative ignored", 10000, -5, 10000},
		{"over hundred ignored", 10000, 150, 10000},
	}
	for _, tc := range cases {
		if got := discountedUnitPaisa(tc.price, tc.percent); got != tc.want {
			t.Errorf("%s: discountedUnitPaisa(%d, %d) = %d, want %d", tc.name, tc.price, tc.percent, got, tc.want)
		}
	}
}

// TestDiscountCardPaisa locks the streak-card settlement to the client's whole-rupee rounding
// (`Math.round(subtotal * percent / 100)`), so the invoice total matches what was displayed.
func TestDiscountCardPaisa(t *testing.T) {
	cases := []struct {
		name     string
		subtotal int64
		percent  int64
		want     int64
	}{
		{"ten percent exact", 1000, 10, 10000},
		{"rounds half up", 105, 10, 1100},
		{"rounds down", 104, 10, 1000},
		{"no card", 1000, 0, 0},
		{"empty cart", 0, 10, 0},
		{"negative percent", 1000, -5, 0},
	}
	for _, tc := range cases {
		if got := discountCardPaisa(tc.subtotal, tc.percent); got != tc.want {
			t.Errorf("%s: discountCardPaisa(%d, %d) = %d, want %d", tc.name, tc.subtotal, tc.percent, got, tc.want)
		}
	}
}
