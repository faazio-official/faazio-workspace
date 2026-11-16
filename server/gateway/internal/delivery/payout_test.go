package delivery

import (
	"testing"
	"time"
)

// noonPST is an explicit out-of-night-window time (14:00 UTC → 19:30 IST) so the surge tests are
// deterministic and never pick up the ambient 23:00–03:00 IST night surge from `time.Now()`.
func noonPST() time.Time {
	return time.Date(2026, 1, 5, 14, 0, 0, 0, time.UTC)
}

func TestComputeRiderPayoutBaseAndExtraKm(t *testing.T) {
	s := DefaultPayoutSettings() // ₹30 base for 3 km, ₹7/km after
	p := ComputeRiderPayout("dlv-1", "rider-1", 7500, s, SurgeInput{At: noonPST()})
	if p.DistanceKm != 7.5 {
		t.Fatalf("distance = %v, want 7.5", p.DistanceKm)
	}
	if p.BaseRatePaisa != 3000 || p.ExtraKmChargePaisa != 3150 {
		t.Fatalf("base/extra = %d/%d, want 3000/3150", p.BaseRatePaisa, p.ExtraKmChargePaisa)
	}
	if p.SurgePaisa != 0 || p.TotalPaisa != 6150 {
		t.Fatalf("surge/total = %d/%d, want 0/6150", p.SurgePaisa, p.TotalPaisa)
	}
}

func TestComputeRiderPayoutSurges(t *testing.T) {
	s := DefaultPayoutSettings()
	p := ComputeRiderPayout("dlv-2", "rider-1", 2000, s, SurgeInput{At: noonPST(), Weather: true, Festival: true})
	if p.ExtraKmChargePaisa != 0 {
		t.Fatalf("inside base distance must not charge extra km: %d", p.ExtraKmChargePaisa)
	}
	if p.SurgePaisa != 2500+1500 {
		t.Fatalf("surge = %d, want 4000", p.SurgePaisa)
	}
	if p.SurgeReason != "weather,festival" {
		t.Fatalf("reason = %q", p.SurgeReason)
	}
	if p.TotalPaisa != 3000+4000 {
		t.Fatalf("total = %d, want 7000", p.TotalPaisa)
	}
}

func TestComputeRiderPayoutReusesStoredSurge(t *testing.T) {
	s := DefaultPayoutSettings()
	p := ComputeRiderPayoutWithSurge("dlv-3", "rider-1", 5200, s, 4500, "night,weather")
	if p.DistanceKm != 5.2 || p.ExtraKmChargePaisa != 1540 {
		t.Fatalf("distance/extra = %v/%d, want 5.2/1540", p.DistanceKm, p.ExtraKmChargePaisa)
	}
	if p.SurgePaisa != 4500 || p.SurgeReason != "night,weather" {
		t.Fatalf("surge = %d/%q, want 4500/night,weather", p.SurgePaisa, p.SurgeReason)
	}
	if p.TotalPaisa != 3000+1540+4500 {
		t.Fatalf("total = %d, want %d", p.TotalPaisa, 3000+1540+4500)
	}
}

func TestPayoutModeHelpers(t *testing.T) {
	if got := payoutModeOrDefault(" manual "); got != PayoutManual {
		t.Fatalf("payoutModeOrDefault(manual) = %q, want %q", got, PayoutManual)
	}
	if got := payoutModeOrDefault("something-else"); got != PayoutAutomated {
		t.Fatalf("payoutModeOrDefault(invalid) = %q, want %q", got, PayoutAutomated)
	}
	if !validPayoutMode("automated") || !validPayoutMode("MANUAL") {
		t.Fatal("valid payout modes must be accepted case-insensitively")
	}
	if validPayoutMode("") || validPayoutMode("CASH") {
		t.Fatal("invalid payout modes must be rejected")
	}
}

// TestCalculatePayoutDetailsUsesStoredBasis is the completion/read parity case: the shared helper
// must bill exactly the customer-paid distance and surge, not the route distance.
func TestCalculatePayoutDetailsUsesStoredBasis(t *testing.T) {
	o := Order{
		OrderID: "dlv-10", RiderID: "rider-1", TotalDistanceMeters: 9000,
		PayoutMode: PayoutAutomated, AssignedAt: "2026-01-05T14:00:00Z",
	}
	p := CalculatePayoutDetails(o, DefaultPayoutSettings(), 5200, 4500, "night,weather", true, false, false)
	if p.DistanceKm != 5.2 || p.ExtraKmChargePaisa != 1540 {
		t.Fatalf("distance/extra = %v/%d, want 5.2/1540", p.DistanceKm, p.ExtraKmChargePaisa)
	}
	if p.SurgePaisa != 4500 || p.SurgeReason != "night,weather" {
		t.Fatalf("surge = %d/%q, want 4500/night,weather", p.SurgePaisa, p.SurgeReason)
	}
	if p.TotalPaisa != 3000+1540+4500 {
		t.Fatalf("total = %d, want %d", p.TotalPaisa, 3000+1540+4500)
	}
	if p.Status != "PENDING" || p.PayoutMode != PayoutAutomated {
		t.Fatalf("status/mode = %q/%q", p.Status, p.PayoutMode)
	}
}

// TestCalculatePayoutDetailsWithoutBasisFallsBackToRouteDistance covers legacy orders: route
// distance plus the clock-derived surge (noon IST here, so no night surge).
func TestCalculatePayoutDetailsWithoutBasisFallsBackToRouteDistance(t *testing.T) {
	o := Order{
		OrderID: "dlv-11", RiderID: "rider-1", TotalDistanceMeters: 7500,
		PayoutMode: PayoutAutomated, AssignedAt: "2026-01-05T14:00:00Z",
	}
	p := CalculatePayoutDetails(o, DefaultPayoutSettings(), 0, 0, "", false, false, false)
	if p.TotalPaisa != 6150 || p.SurgePaisa != 0 {
		t.Fatalf("total/surge = %d/%d, want 6150/0", p.TotalPaisa, p.SurgePaisa)
	}
}

func TestCalculatePayoutDetailsManualUsesRecordedFare(t *testing.T) {
	km := 6.0
	fare := int64(5000)
	o := Order{
		OrderID: "dlv-12", RiderID: "rider-1", TotalDistanceMeters: 9000,
		PayoutMode: PayoutManual, ManualDistanceKm: &km, ManualFarePaisa: &fare,
		AssignedAt: "2026-01-05T14:00:00Z",
	}
	p := CalculatePayoutDetails(o, DefaultPayoutSettings(), 5200, 1000, "night", true, false, false)
	if p.PayoutMode != PayoutManual || p.TotalPaisa != fare {
		t.Fatalf("mode/total = %q/%d, want MANUAL/%d", p.PayoutMode, p.TotalPaisa, fare)
	}
	if p.DistanceKm != 6.0 {
		t.Fatalf("distance = %v, want 6", p.DistanceKm)
	}
	if p.CalculatedFarePaisa == nil || *p.CalculatedFarePaisa != 6100 {
		t.Fatalf("calculated fare = %v, want 6100", p.CalculatedFarePaisa)
	}
}

func TestCalculatePayoutDetailsKeepsCalculatedFareOverride(t *testing.T) {
	calc := int64(7000)
	o := Order{
		OrderID: "dlv-13", RiderID: "rider-1", TotalDistanceMeters: 7500,
		PayoutMode: PayoutAutomated, CalculatedFarePaisa: &calc,
		AssignedAt: "2026-01-05T14:00:00Z",
	}
	p := CalculatePayoutDetails(o, DefaultPayoutSettings(), 0, 0, "", false, false, false)
	if p.CalculatedFarePaisa == nil || *p.CalculatedFarePaisa != calc {
		t.Fatalf("calculated fare = %v, want %d", p.CalculatedFarePaisa, calc)
	}
	if p.TotalPaisa != 6150 {
		t.Fatalf("total = %d, want 6150", p.TotalPaisa)
	}
}
