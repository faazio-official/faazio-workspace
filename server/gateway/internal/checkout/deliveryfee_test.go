package checkout

import "testing"

func TestFeeForDistanceKmRateCard(t *testing.T) {
	s := DefaultDeliveryFeeSettings()
	if s.BaseDistanceKm != 3 || s.BaseFeePaisa != 3500 || s.PerExtraKmPaisa != 900 {
		t.Fatalf("default card = %+v, want 3km/3500/900", s)
	}
	cases := []struct {
		km   float64
		want int64
	}{
		{0, 3500},
		{2.9, 3500},
		{3, 3500},
		{3.1, 3500}, // floor(0.1 extra km) = 0 → base fee
		{4, 4400},   // floor(1) → base + ₹9
		{5, 5300},   // floor(2) → base + 2×₹9
		{7, 7100},   // floor(4) → ₹35 + 4×₹9 = ₹71 (plan check)
		{10, 9800},  // floor(7) → base + 7×₹9
	}
	for _, c := range cases {
		if got := feeForDistanceKm(c.km, s); got != c.want {
			t.Errorf("feeForDistanceKm(%v) = %d, want %d", c.km, got, c.want)
		}
	}
}

func TestFeeForDistanceKmNeverNegative(t *testing.T) {
	s := DeliveryFeeSettings{BaseDistanceKm: 0, BaseFeePaisa: 0, PerExtraKmPaisa: 0}
	if got := feeForDistanceKm(-1, s); got != 0 {
		t.Fatalf("negative distance must clamp to 0: %d", got)
	}
}

func TestHaversineKmIsReasonable(t *testing.T) {
	// Hyderabad → Chennai ~525 km great-circle; assert within a sane band.
	km := haversineKm(17.385, 78.4867, 13.0827, 80.2707)
	if km < 450 || km > 600 {
		t.Fatalf("Haversine Hyderabad→Chennai = %v km, want ~525", km)
	}
	// Same point is 0 km (dispatch_test already covers the validators).
	if d := haversineKm(12.5, 77.5, 12.5, 77.5); d != 0 {
		t.Fatalf("same point must be 0 km: %v", d)
	}
}
