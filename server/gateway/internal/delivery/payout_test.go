package delivery

import "testing"

func TestComputeRiderPayoutBaseAndExtraKm(t *testing.T) {
	s := DefaultPayoutSettings() // ₹30 base for 3 km, ₹7/km after
	p := ComputeRiderPayout("dlv-1", "rider-1", 7500, s, SurgeInput{})
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
	p := ComputeRiderPayout("dlv-2", "rider-1", 2000, s, SurgeInput{Weather: true, Festival: true})
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
