package checkout

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
)

type fakeSurge struct {
	rates contracts.SurgeRates
	err   error
}

func (f fakeSurge) SurgeSettings(context.Context) (contracts.SurgeRates, error) {
	return f.rates, f.err
}

type fakeWeather struct {
	raining bool
	err     error
}

func (f fakeWeather) IsRaining(context.Context, string) (bool, error) {
	return f.raining, f.err
}

type fakeFestival struct {
	festival contracts.Festival
	active   bool
	err      error
}

func (f fakeFestival) ActiveFestival(context.Context, time.Time) (contracts.Festival, bool, error) {
	return f.festival, f.active, f.err
}

func TestPriceDeliveryStacksNightWeatherFestival(t *testing.T) {
	at := time.Date(2026, 1, 5, 23, 30, 0, 0, time.FixedZone("IST", 5*3600+1800))
	s := &Service{
		surge:     fakeSurge{rates: contracts.SurgeRates{NightPaisa: 2000, WeatherPaisa: 2500, FestivalPaisa: 1500}},
		weather:   fakeWeather{raining: true},
		festivals: fakeFestival{festival: contracts.Festival{ID: "fest-1", SurgePaisa: 1500}, active: true},
	}
	b := s.priceDelivery(context.Background(), 5.2, DefaultDeliveryFeeSettings(), at, "10:20")

	if b.DistanceKm != 5.2 || b.ExtraKmPaisa != 1540 {
		t.Fatalf("distance/extra = %v/%d, want 5.2/1540", b.DistanceKm, b.ExtraKmPaisa)
	}
	if b.NightSurgePaisa != 2000 || b.WeatherSurgePaisa != 2500 || b.FestivalSurgePaisa != 1500 {
		t.Fatalf("surges = %d/%d/%d, want 2000/2500/1500",
			b.NightSurgePaisa, b.WeatherSurgePaisa, b.FestivalSurgePaisa)
	}
	if b.TotalPaisa != 3500+1540+2000+2500+1500 {
		t.Fatalf("total = %d, want %d", b.TotalPaisa, 3500+1540+2000+2500+1500)
	}
	if b.ZoneID != "10:20" {
		t.Fatalf("zone = %q, want 10:20", b.ZoneID)
	}
}

func TestPriceDeliveryDegradesSurgeFailures(t *testing.T) {
	at := time.Date(2026, 1, 5, 12, 0, 0, 0, time.FixedZone("IST", 5*3600+1800))
	s := &Service{
		surge:     fakeSurge{err: errors.New("db down")},
		weather:   fakeWeather{err: errors.New("provider down")},
		festivals: fakeFestival{err: errors.New("db down")},
	}
	b := s.priceDelivery(context.Background(), 5, DefaultDeliveryFeeSettings(), at, "10:20")
	if b.TotalPaisa != 3500+1400 {
		t.Fatalf("degraded total = %d, want %d (base + extra only)", b.TotalPaisa, 3500+1400)
	}
	if len(b.SurgeReasons) != 0 {
		t.Fatalf("reasons = %v, want none", b.SurgeReasons)
	}
}

func TestPriceDeliveryFestivalOverridesCardAmount(t *testing.T) {
	at := time.Date(2026, 1, 5, 12, 0, 0, 0, time.FixedZone("IST", 5*3600+1800))
	s := &Service{
		surge:     fakeSurge{rates: contracts.SurgeRates{FestivalPaisa: 900}},
		weather:   fakeWeather{raining: false},
		festivals: fakeFestival{festival: contracts.Festival{ID: "fest-2", SurgePaisa: 1500}, active: true},
	}
	b := s.priceDelivery(context.Background(), 3, DefaultDeliveryFeeSettings(), at, "1:2")
	if b.FestivalSurgePaisa != 1500 {
		t.Fatalf("festival = %d, want the calendar row's 1500", b.FestivalSurgePaisa)
	}
}
