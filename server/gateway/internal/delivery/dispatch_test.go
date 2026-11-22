package delivery

import (
    "testing"
    "math"
)

// TestPickRiderNearest verifies that the rider selection algorithm chooses the rider
// with the smallest road travel time (approximated by straight‑line distance in tests).
func TestPickRiderNearest(t *testing.T) {
    // Store location (central point)
    storeLat, storeLng := 12.9716, 77.5946 // Bangalore approx

    // Define four riders with varying distances from the store.
    riders := []RiderLocation{
        {Rider: Rider{RiderID: "rider-near", MaxCapacity: 2, CurrentLoad: 0}, Lat: 12.9720, Lng: 77.5940}, // ~50m
        {Rider: Rider{RiderID: "rider-mid", MaxCapacity: 2, CurrentLoad: 0}, Lat: 12.9750, Lng: 77.6000}, // ~700m
        {Rider: Rider{RiderID: "rider-far"}, Lat: 13.0000, Lng: 77.6500}, // ~7km
        {Rider: Rider{RiderID: "rider-very-far"}, Lat: 13.2000, Lng: 77.8000}, // ~30km
    }

    // Use the StraightLineMatrix which estimates travel time from haversine distance.
    matrix := StraightLineMatrix{}

    selected, err := PickRider(riders, storeLat, storeLng, matrix)
    if err != nil {
        t.Fatalf("PickRider returned error: %v", err)
    }
    if selected == nil {
        t.Fatalf("PickRider returned nil rider")
    }
    // Expect the nearest rider to be selected.
    if selected.Rider.RiderID != "rider-near" {
        t.Fatalf("expected rider-near, got %s", selected.Rider.RiderID)
    }

    // Verify that the estimated travel time is reasonable (within 5 seconds of haversine).
    secs, _, err := matrix.Travel(riders[0].Lat, riders[0].Lng, storeLat, storeLng)
    if err != nil {
        t.Fatalf("matrix travel error: %v", err)
    }
    secsSel, _, err := matrix.Travel(selected.Lat, selected.Lng, storeLat, storeLng)
    if err != nil {
        t.Fatalf("matrix travel error for selected rider: %v", err)
    }
    if math.Abs(float64(secsSel)-float64(secs)) > 5 {
        t.Fatalf("selected rider travel time mismatch: got %d, expected approx %d", secsSel, secs)
    }
}
