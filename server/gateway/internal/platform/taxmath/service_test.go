package taxmath

import "testing"

func TestComputeSingleLine(t *testing.T) {
	// ₹1180 at 18% inclusive → ₹1000 taxable + ₹180 GST. 10% commission = ₹118.
	// TCS 1% = ₹11.80 → ₹12; TDS 0.1% = ₹1.18 → ₹1; delivery ₹50.
	b := Compute([]Line{{GrossPaisa: 118000, GSTRatePct: 18, PlatformFeePct: 10}}, DefaultRates())

	if b.TaxableValuePaisa != 100000 || b.ProductTaxPaisa != 18000 {
		t.Fatalf("taxable/tax = %d/%d, want 100000/18000", b.TaxableValuePaisa, b.ProductTaxPaisa)
	}
	if b.PlatformFeePaisa != 11800 {
		t.Fatalf("platform fee = %d, want 11800", b.PlatformFeePaisa)
	}
	if b.PlatformGSTPaisa != 2124 {
		t.Fatalf("platform GST = %d, want 2124", b.PlatformGSTPaisa)
	}
	if b.TCSPaisa != 1180 || b.TDSPaisa != 118 {
		t.Fatalf("tcs/tds = %d/%d, want 1180/118", b.TCSPaisa, b.TDSPaisa)
	}
	if b.TotalChargedPaisa != 123000 {
		t.Fatalf("customer total = %d, want 123000 (gross + delivery)", b.TotalChargedPaisa)
	}
	if b.SellerNetPaisa != 118000-11800-1180-118 {
		t.Fatalf("seller net = %d, want %d", b.SellerNetPaisa, 118000-11800-1180-118)
	}
}

func TestComputeMixedRatesWeightsCommission(t *testing.T) {
	lines := []Line{
		{GrossPaisa: 10500, GSTRatePct: 5, PlatformFeePct: 10},  // 10000 + 500
		{GrossPaisa: 11200, GSTRatePct: 12, PlatformFeePct: 20}, // 10000 + 1200
	}
	b := Compute(lines, Rates{PlatformGSTPct: 18, TCSPct: 1, TDSPct: 0.1, DeliveryFeePaisa: 0})
	if b.GrossProductPaisa != 21700 || b.TaxableValuePaisa != 20000 || b.ProductTaxPaisa != 1700 {
		t.Fatalf("split = %d/%d/%d, want 21700/20000/1700", b.GrossProductPaisa, b.TaxableValuePaisa, b.ProductTaxPaisa)
	}
	if b.PlatformFeePaisa != 1050+2240 {
		t.Fatalf("commission = %d, want %d", b.PlatformFeePaisa, 1050+2240)
	}
	if b.TotalChargedPaisa != 21700 {
		t.Fatalf("total = %d, want 21700 (no delivery fee)", b.TotalChargedPaisa)
	}
}

func TestComputeClampsFees(t *testing.T) {
	b := Compute([]Line{{GrossPaisa: 1000, GSTRatePct: 5, PlatformFeePct: 150}}, Rates{
		PlatformGSTPct: 18, TCSPct: 1, TDSPct: 0.1, DeliveryFeePaisa: -1,
	})
	if b.PlatformFeePaisa != 1000 {
		t.Fatalf("fee must clamp to 100%% of gross: %d", b.PlatformFeePaisa)
	}
	if b.DeliveryFeePaisa != 0 {
		t.Fatalf("negative delivery fee must clamp: %d", b.DeliveryFeePaisa)
	}
	if b.SellerNetPaisa < 0 {
		t.Fatalf("seller net must never go negative: %d", b.SellerNetPaisa)
	}
}

func TestNewInvoiceTotals(t *testing.T) {
	b := Compute([]Line{{GrossPaisa: 100000, GSTRatePct: 5, PlatformFeePct: 10}}, DefaultRates())
	inv := NewInvoice("ORD-1", "#ORD-1", "user-1", "sel-1", "Shop", "29ABCDE1234F1Z5", b, 2000)
	if inv.TotalPaisa != b.TotalChargedPaisa-2000 {
		t.Fatalf("invoice total = %d, want %d", inv.TotalPaisa, b.TotalChargedPaisa-2000)
	}
	if inv.InvoiceID[:4] != "inv-" || len(inv.InvoiceID) != 16 {
		t.Fatalf("unexpected invoice id %q", inv.InvoiceID)
	}
}
