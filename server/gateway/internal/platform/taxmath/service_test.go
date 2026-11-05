package taxmath

import "testing"

func TestComputeSingleLine(t *testing.T) {
	// ₹118000 at 18% inclusive → ₹100000 taxable + ₹18000 GST. Commission is 10% of gross =
	// ₹11800; GST on commission is the platform's liability = ₹2124 (not withheld from the seller).
	// TCS 1% = ₹1180; TDS 0.1% = ₹118; delivery ₹50.
	b := Compute([]Line{{GrossPaisa: 118000, GSTRatePct: 18, PlatformFeePct: 10}}, DefaultRates())

	if b.TaxableValuePaisa != 100000 || b.ProductTaxPaisa != 18000 {
		t.Fatalf("taxable/tax = %d/%d, want 100000/18000", b.TaxableValuePaisa, b.ProductTaxPaisa)
	}
	if b.PlatformFeePaisa != 11800 {
		t.Fatalf("platform fee = %d, want 11800 (10%% of gross)", b.PlatformFeePaisa)
	}
	if b.PlatformGSTPaisa != 2124 {
		t.Fatalf("platform GST = %d, want 2124 (18%% of commission)", b.PlatformGSTPaisa)
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

func TestComputeChargesCommission(t *testing.T) {
	// Different per-seller fees in the same order settle per line: store A's 10% only on its own
	// gross, store B's 20% only on its own.
	lines := []Line{
		{GrossPaisa: 10500, GSTRatePct: 5, PlatformFeePct: 10},  // 10000 + 500,  fee 1050
		{GrossPaisa: 11200, GSTRatePct: 12, PlatformFeePct: 20}, // 10000 + 1200, fee 2240
	}
	b := Compute(lines, Rates{PlatformGSTPct: 18, TCSPct: 1, TDSPct: 0.1, DeliveryFeePaisa: 0})
	if b.GrossProductPaisa != 21700 || b.TaxableValuePaisa != 20000 || b.ProductTaxPaisa != 1700 {
		t.Fatalf("split = %d/%d/%d, want 21700/20000/1700", b.GrossProductPaisa, b.TaxableValuePaisa, b.ProductTaxPaisa)
	}
	if b.PlatformFeePaisa != 1050+2240 {
		t.Fatalf("commission = %d, want %d (per-line fees summed)", b.PlatformFeePaisa, 1050+2240)
	}
	if b.PlatformGSTPaisa != 592 {
		t.Fatalf("platform GST = %d, want 592 (18%% of %d)", b.PlatformGSTPaisa, b.PlatformFeePaisa)
	}
	if b.TotalChargedPaisa != 21700 {
		t.Fatalf("total = %d, want 21700 (no delivery fee)", b.TotalChargedPaisa)
	}
	if b.SellerNetPaisa != 21700-(1050+2240)-217-22 {
		t.Fatalf("seller net = %d, want %d", b.SellerNetPaisa, 21700-(1050+2240)-217-22)
	}
}

func TestComputeMultiStoreDifferentFees(t *testing.T) {
	// Two stores, identical gross, different fees: the summed commission must equal the sum of each
	// line's own fee (proving fees attribute to their own store) and the seller net deducts the lot.
	lines := []Line{
		{GrossPaisa: 10000, GSTRatePct: 5, PlatformFeePct: 5},  // fee 500
		{GrossPaisa: 10000, GSTRatePct: 5, PlatformFeePct: 15}, // fee 1500
	}
	b := Compute(lines, Rates{PlatformGSTPct: 18, TCSPct: 1, TDSPct: 0.1, DeliveryFeePaisa: 0})
	if b.PlatformFeePaisa != 2000 {
		t.Fatalf("commission = %d, want 2000 (500 + 1500 per store)", b.PlatformFeePaisa)
	}
	if b.PlatformGSTPaisa != 360 {
		t.Fatalf("platform GST = %d, want 360 (18%% of 2000)", b.PlatformGSTPaisa)
	}
	if b.SellerNetPaisa != 20000-2000-200-20 {
		t.Fatalf("seller net = %d, want %d", b.SellerNetPaisa, 20000-2000-200-20)
	}
}

func TestComputeZeroFeeBackwardCompatible(t *testing.T) {
	// Commission-free sellers (platform_fee_pct = 0) behave exactly as before the fee was charged.
	b := Compute([]Line{{GrossPaisa: 10000, GSTRatePct: 5, PlatformFeePct: 0}}, Rates{
		PlatformGSTPct: 18, TCSPct: 1, TDSPct: 0.1, DeliveryFeePaisa: 0,
	})
	if b.PlatformFeePaisa != 0 || b.PlatformGSTPaisa != 0 {
		t.Fatalf("fee/GST = %d/%d, want 0/0 for a commission-free seller", b.PlatformFeePaisa, b.PlatformGSTPaisa)
	}
	if b.SellerNetPaisa != 10000-100-10 {
		t.Fatalf("seller net = %d, want %d (gross − tcs − tds)", b.SellerNetPaisa, 10000-100-10)
	}
}

func TestComputeClampsFees(t *testing.T) {
	b := Compute([]Line{{GrossPaisa: 1000, GSTRatePct: 5, PlatformFeePct: 150}}, Rates{
		PlatformGSTPct: 18, TCSPct: 1, TDSPct: 0.1, DeliveryFeePaisa: -1,
	})
	if b.PlatformFeePaisa != 1500 {
		t.Fatalf("commission = %d, want 1500 (150%% of gross)", b.PlatformFeePaisa)
	}
	if b.DeliveryFeePaisa != 0 {
		t.Fatalf("negative delivery fee must clamp: %d", b.DeliveryFeePaisa)
	}
	// Fees + TCS + TDS exceed the ₹10 gross — the seller net must clamp at 0, never go negative.
	if b.SellerNetPaisa != 0 {
		t.Fatalf("seller net = %d, want 0 (clamped)", b.SellerNetPaisa)
	}
}

func TestNewInvoiceTotals(t *testing.T) {
	b := Compute([]Line{{GrossPaisa: 100000, GSTRatePct: 5, PlatformFeePct: 10}}, DefaultRates())
	inv := NewInvoice("ORD-1", "#ORD-1", "user-1", "sel-1", "Shop", "29ABCDE1234F1Z5", b, 2000)
	if inv.TotalPaisa != b.TotalChargedPaisa-2000 {
		t.Fatalf("invoice total = %d, want %d", inv.TotalPaisa, b.TotalChargedPaisa-2000)
	}
	if inv.PlatformFeePaisa != 10000 {
		t.Fatalf("invoice platform fee = %d, want 10000", inv.PlatformFeePaisa)
	}
	if inv.PlatformGSTPaisa != 1800 {
		t.Fatalf("invoice platform GST = %d, want 1800", inv.PlatformGSTPaisa)
	}
	if inv.SellerNetPaisa != 100000-10000-1000-100 {
		t.Fatalf("invoice seller net = %d, want %d", inv.SellerNetPaisa, 100000-10000-1000-100)
	}
	if inv.InvoiceID[:4] != "inv-" || len(inv.InvoiceID) != 16 {
		t.Fatalf("unexpected invoice id %q", inv.InvoiceID)
	}
}