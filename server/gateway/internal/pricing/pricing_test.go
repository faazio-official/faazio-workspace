package pricing

import (
	"testing"
	"time"
)

func TestComputeDeliveryPriceMatchesPlanExample(t *testing.T) {
	// 5.2 km at 23:30 IST while raining: 35 + 2.2×7 = 50.40; +20 night +25 rain = 95.40.
	at := timeAtIST(t, 23, 30)
	b := ComputeDeliveryPrice(5.2, 3, 3500, 700, SurgeRates{NightPaisa: 2000, WeatherPaisa: 2500}, at)

	if b.ExtraKmPaisa != 1540 {
		t.Fatalf("extra = %d, want 1540", b.ExtraKmPaisa)
	}
	if b.NightSurgePaisa != 2000 || b.WeatherSurgePaisa != 2500 {
		t.Fatalf("night/weather = %d/%d, want 2000/2500", b.NightSurgePaisa, b.WeatherSurgePaisa)
	}
	if b.TotalPaisa != 9540 || b.FeePaisa != 9540 {
		t.Fatalf("total/fee = %d/%d, want 9540/9540", b.TotalPaisa, b.FeePaisa)
	}
	if len(b.SurgeReasons) != 2 || b.SurgeReasons[0] != "night" || b.SurgeReasons[1] != "weather" {
		t.Fatalf("reasons = %v", b.SurgeReasons)
	}
}

func TestComputeDeliveryPriceBaseAndFractionalKm(t *testing.T) {
	at := timeAtIST(t, 12, 0)
	cases := []struct {
		km   float64
		want int64
	}{
		{0, 3500},
		{2.9, 3500},
		{3, 3500},
		{3.1, 3570},
		{4, 4200},
		{5, 4900},
		{5.2, 5040},
		{7, 6300},
	}
	for _, c := range cases {
		if got := ComputeDeliveryPrice(c.km, 3, 3500, 700, SurgeRates{}, at).TotalPaisa; got != c.want {
			t.Errorf("5km-card fee(%v) = %d, want %d", c.km, got, c.want)
		}
	}
}

func TestNightWindow(t *testing.T) {
	cases := []struct {
		hour, min int
		want      bool
	}{
		{22, 59, false},
		{23, 0, true},
		{0, 30, true},
		{2, 59, true},
		{3, 0, false},
		{12, 0, false},
	}
	for _, c := range cases {
		if got := IsNightSurge(timeAtIST(t, c.hour, c.min)); got != c.want {
			t.Errorf("IsNightSurge(%02d:%02d) = %v, want %v", c.hour, c.min, got, c.want)
		}
	}
}

func TestComputeDeliveryPriceNeverNegative(t *testing.T) {
	b := ComputeDeliveryPrice(-4, 3, 3500, 700, SurgeRates{NightPaisa: -500}, timeAtIST(t, 12, 0))
	if b.TotalPaisa != 3500 {
		t.Fatalf("negative inputs must clamp to base: got %d", b.TotalPaisa)
	}
}

// timeAtIST builds an absolute time whose IST wall clock is hour:min on a fixed date.
func timeAtIST(t *testing.T, hour, min int) time.Time {
	t.Helper()
	return time.Date(2026, 1, 5, hour, min, 0, 0, time.FixedZone("IST", 5*3600+1800))
}
