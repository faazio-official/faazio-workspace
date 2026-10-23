// Package taxmath owns the GST/deduction math for the marketplace. It is deliberately dependency-free
// integer math so checkout, settlement and the invoice projector all agree to the paisa.
//
// Model (single source of truth):
//   - Catalog prices are GST-inclusive. For a line at rate r, taxable = gross * 100 / (100+r).
//   - Platform commission is removed: sellers keep their full GST-inclusive gross. Only the
//     statutory TCS (1%) and TDS (0.1%) are withheld from the seller. GST on the (now zero)
//     commission is therefore zero too — there is no platform cut in any settlement.
//   - TCS (1%) and TDS (0.1%) are withheld from the seller's gross, never charged to the customer.
//   - The customer pays product gross + the delivery fee, less platform-funded discounts. Product
//     GST is already inside the gross (pass-through), and the delivery fee is dynamic per order
//     (tax.delivery_fee_settings; PICKUP waives it).
package taxmath

import (
	"crypto/rand"
	"encoding/hex"
	"math"
	"strings"
)

// Default rate-card values. The live values come from tax.platform_settings / tax.tax_rates.
const (
	DefaultPlatformGSTPct   = 18.0
	DefaultTCSPct           = 1.0
	DefaultTDSPct           = 0.1
	DefaultDeliveryFeePaisa = 5000
	DefaultProductGSTRate   = 5
)

// Rates is the configurable rate card loaded from tax.platform_settings.
type Rates struct {
	PlatformGSTPct   float64
	TCSPct           float64
	TDSPct           float64
	DeliveryFeePaisa int64
}

// DefaultRates returns the statutory defaults (18% platform GST, 1% TCS, 0.1% TDS, ₹50 delivery).
func DefaultRates() Rates {
	return Rates{
		PlatformGSTPct:   DefaultPlatformGSTPct,
		TCSPct:           DefaultTCSPct,
		TDSPct:           DefaultTDSPct,
		DeliveryFeePaisa: DefaultDeliveryFeePaisa,
	}
}

// Line is one priced order line. GrossPaisa is GST-inclusive.
type Line struct {
	GrossPaisa int64
	GSTRatePct int
	// PlatformFeePct is retained for structural compatibility (callers still pass it) but is
	// deliberately IGNORED by Compute: platform commission is removed, so a fee here never changes
	// the breakdown or the seller's payout.
	PlatformFeePct int
}

// Breakdown is the immutable money split for one order. All fields are paisa.
type Breakdown struct {
	GrossProductPaisa int64 `json:"grossProductPaisa"`
	TaxableValuePaisa int64 `json:"taxableValuePaisa"`
	ProductTaxPaisa   int64 `json:"productTaxPaisa"`
	PlatformFeePaisa  int64 `json:"platformFeePaisa"`
	PlatformGSTPaisa  int64 `json:"platformGstPaisa"`
	DeliveryFeePaisa  int64 `json:"deliveryFeePaisa"`
	TCSPaisa          int64 `json:"tcsPaisa"`
	TDSPaisa          int64 `json:"tdsPaisa"`
	TotalChargedPaisa int64 `json:"totalChargedPaisa"`
	SellerNetPaisa    int64 `json:"sellerNetPaisa"`
	EffectiveGSTRate  int   `json:"taxRatePct"`
}

// Compute splits the order's GST-inclusive gross into taxable value, product GST, statutory TCS/TDS
// and the customer/seller totals. Platform commission/GST are always zero — sellers keep the gross.
func Compute(lines []Line, rates Rates) Breakdown {
	if rates.PlatformGSTPct < 0 {
		rates.PlatformGSTPct = 0
	}
	if rates.TCSPct < 0 {
		rates.TCSPct = 0
	}
	if rates.TDSPct < 0 {
		rates.TDSPct = 0
	}
	if rates.DeliveryFeePaisa < 0 {
		rates.DeliveryFeePaisa = 0
	}

	var b Breakdown
	for _, l := range lines {
		gross := l.GrossPaisa
		if gross < 0 {
			gross = 0
		}
		rate := l.GSTRatePct
		if rate < 0 {
			rate = 0
		}
		taxable := inclusiveTaxable(gross, rate)
		b.GrossProductPaisa += gross
		b.TaxableValuePaisa += taxable
		b.ProductTaxPaisa += gross - taxable
	}
	// Platform commission removed (seller keeps full gross): both the fee and its GST are zero.
	b.PlatformFeePaisa = 0
	b.PlatformGSTPaisa = 0
	b.DeliveryFeePaisa = rates.DeliveryFeePaisa
	b.TCSPaisa = percentOf(b.GrossProductPaisa, rates.TCSPct)
	b.TDSPaisa = percentOf(b.GrossProductPaisa, rates.TDSPct)
	b.TotalChargedPaisa = b.GrossProductPaisa + b.DeliveryFeePaisa
	b.SellerNetPaisa = b.GrossProductPaisa - b.TCSPaisa - b.TDSPaisa
	if b.SellerNetPaisa < 0 {
		b.SellerNetPaisa = 0
	}
	if b.TaxableValuePaisa > 0 {
		b.EffectiveGSTRate = int(math.Round(float64(b.ProductTaxPaisa) * 100 / float64(b.TaxableValuePaisa)))
	}
	return b
}

// inclusiveTaxable returns the taxable value inside a GST-inclusive gross at ratePct.
func inclusiveTaxable(grossPaisa int64, ratePct int) int64 {
	if grossPaisa <= 0 {
		return 0
	}
	if ratePct <= 0 {
		return grossPaisa
	}
	return int64(math.Round(float64(grossPaisa) * 100 / float64(100+ratePct)))
}

// percentOf returns round(amount * pct / 100) using half-away-from-zero.
func percentOf(amountPaisa int64, pct float64) int64 {
	if amountPaisa <= 0 || pct <= 0 {
		return 0
	}
	return int64(math.Round(float64(amountPaisa) * pct / 100))
}

// Invoice is the immutable record persisted to tax.tax_invoices for one order.
type Invoice struct {
	InvoiceID           string
	InvoiceNumber       string
	OrderID             string
	OrderNumber         string
	CustomerID          string
	SellerID            string
	SellerName          string
	SellerGSTIN         string
	TaxRatePct          int
	TaxableValuePaisa   int64
	ProductTaxPaisa     int64
	PlatformFeePaisa    int64
	PlatformGSTPaisa    int64
	DeliveryFeePaisa    int64
	TCSPaisa            int64
	TDSPaisa            int64
	CouponDiscountPaisa int64
	TotalPaisa          int64
	SellerNetPaisa      int64
	PDFKey              string
}

// NewInvoice assembles the invoice record from a computed breakdown plus seller identity.
func NewInvoice(orderID, orderNumber, customerID, sellerID, sellerName, sellerGSTIN string, b Breakdown, couponDiscountPaisa int64) Invoice {
	invoiceID := NewInvoiceID()
	if couponDiscountPaisa < 0 {
		couponDiscountPaisa = 0
	}
	total := b.TotalChargedPaisa - couponDiscountPaisa
	if total < 0 {
		total = 0
	}
	return Invoice{
		InvoiceID:           invoiceID,
		InvoiceNumber:       NewInvoiceNumber(invoiceID),
		OrderID:             orderID,
		OrderNumber:         orderNumber,
		CustomerID:          customerID,
		SellerID:            sellerID,
		SellerName:          sellerName,
		SellerGSTIN:         sellerGSTIN,
		TaxRatePct:          b.EffectiveGSTRate,
		TaxableValuePaisa:   b.TaxableValuePaisa,
		ProductTaxPaisa:     b.ProductTaxPaisa,
		PlatformFeePaisa:    b.PlatformFeePaisa,
		PlatformGSTPaisa:    b.PlatformGSTPaisa,
		DeliveryFeePaisa:    b.DeliveryFeePaisa,
		TCSPaisa:            b.TCSPaisa,
		TDSPaisa:            b.TDSPaisa,
		CouponDiscountPaisa: couponDiscountPaisa,
		TotalPaisa:          total,
		SellerNetPaisa:      b.SellerNetPaisa,
	}
}

// NewInvoiceID returns a stable-prefixed random invoice id.
func NewInvoiceID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "inv-" + hex.EncodeToString(b)
}

// NewInvoiceNumber derives the human-facing number from the id (unique with the id, stable per row).
func NewInvoiceNumber(invoiceID string) string {
	return "INV-" + strings.ToUpper(strings.TrimPrefix(invoiceID, "inv-"))
}
