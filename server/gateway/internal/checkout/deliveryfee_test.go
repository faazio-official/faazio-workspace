package checkout

import "testing"

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
