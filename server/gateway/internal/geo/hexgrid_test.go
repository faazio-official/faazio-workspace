package geo

import "testing"

func TestGeoCellIsStableAndLocal(t *testing.T) {
	// Hyderabad: same fix must always resolve to the same zone.
	a := GeoCell(17.3850, 78.4867)
	b := GeoCell(17.3850, 78.4867)
	if a != b {
		t.Fatalf("same coordinate produced %q then %q", a, b)
	}

	// A ~7 km move must cross a zone boundary.
	far := GeoCell(17.3850, 78.5500)
	if a == far {
		t.Fatalf("7 km apart resolved to the same cell %q", a)
	}
}

func TestGeoCellCenterRoundTrips(t *testing.T) {
	cases := [][2]float64{
		{17.3850, 78.4867},
		{12.9716, 77.5946},
		{28.6139, 77.2090},
		{19.0760, 72.8777},
	}
	for _, c := range cases {
		cell := GeoCell(c[0], c[1])
		lat, lng := GeoCellCenter(cell)
		if got := GeoCell(lat, lng); got != cell {
			t.Errorf("centre of %q resolved to %q", cell, got)
		}
	}
}

func TestGeoCellCenterRejectsGarbage(t *testing.T) {
	lat, lng := GeoCellCenter("not-a-cell")
	if lat != 0 || lng != 0 {
		t.Fatalf("garbage cell centre = %v,%v, want 0,0", lat, lng)
	}
}

func TestDistanceKm(t *testing.T) {
	// Hyderabad → Chennai ~525 km great-circle.
	if d := DistanceKm(17.385, 78.4867, 13.0827, 80.2707); d < 450 || d > 600 {
		t.Fatalf("Hyderabad→Chennai = %v km, want ~525", d)
	}
	if d := DistanceKm(12.5, 77.5, 12.5, 77.5); d != 0 {
		t.Fatalf("same point must be 0 km: %v", d)
	}
}
