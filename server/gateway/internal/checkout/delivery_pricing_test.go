package checkout

import (
	"context"
	"errors"
	"fmt"
	"strings"
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
	b, err := s.priceDelivery(context.Background(), 5.2, DefaultDeliveryFeeSettings(), at, "10:20")
	if err != nil {
		t.Fatalf("priceDelivery = %v, want nil", err)
	}

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

func TestPriceDeliveryDegradesSurgeAndFestivalFailures(t *testing.T) {
	at := time.Date(2026, 1, 5, 12, 0, 0, 0, time.FixedZone("IST", 5*3600+1800))
	s := &Service{
		surge:     fakeSurge{err: errors.New("db down")},
		weather:   fakeWeather{raining: false},
		festivals: fakeFestival{err: errors.New("db down")},
	}
	b, err := s.priceDelivery(context.Background(), 5, DefaultDeliveryFeeSettings(), at, "10:20")
	if err != nil {
		t.Fatalf("priceDelivery = %v, want nil (surge/festival degrade)", err)
	}
	if b.TotalPaisa != 3500+1400 {
		t.Fatalf("degraded total = %d, want %d (base + extra only)", b.TotalPaisa, 3500+1400)
	}
	if len(b.SurgeReasons) != 0 {
		t.Fatalf("reasons = %v, want none", b.SurgeReasons)
	}
}

func TestPriceDeliveryFailsClosedOnWeatherError(t *testing.T) {
	at := time.Date(2026, 1, 5, 12, 0, 0, 0, time.FixedZone("IST", 5*3600+1800))
	s := &Service{
		weather: fakeWeather{err: errors.New("provider down")},
	}
	if _, err := s.priceDelivery(context.Background(), 5, DefaultDeliveryFeeSettings(), at, "10:20"); err == nil {
		t.Fatal("priceDelivery must fail when the weather provider errors with a non-degraded error (no fake 'not raining')")
	}
}

func TestPriceDeliveryFailsClosedOnWeatherHardErrors(t *testing.T) {
	at := time.Date(2026, 1, 5, 12, 0, 0, 0, time.FixedZone("IST", 5*3600+1800))
	for name, err := range map[string]error{
		"not configured": contracts.ErrWeatherProviderNotConfigured,
		"budget":         contracts.ErrWeatherBudgetExhausted,
	} {
		t.Run(name, func(t *testing.T) {
			s := &Service{
				weather: fakeWeather{err: err},
			}
			if _, err := s.priceDelivery(context.Background(), 5, DefaultDeliveryFeeSettings(), at, "10:20"); err == nil {
				t.Fatal("priceDelivery must fail closed on a hard weather error")
			}
		})
	}
}

func TestPriceDeliveryDegradesOnProviderUnavailable(t *testing.T) {
	at := time.Date(2026, 1, 5, 23, 30, 0, 0, time.FixedZone("IST", 5*3600+1800))
	// Night surge still applies; the weather surge (₹25) is waived because the provider is degraded.
	s := &Service{
		surge:     fakeSurge{rates: contracts.SurgeRates{NightPaisa: 2000, WeatherPaisa: 2500, FestivalPaisa: 1500}},
		weather:   fakeWeather{err: fmt.Errorf("upstream: %w", contracts.ErrWeatherProviderUnavailable)},
		festivals: fakeFestival{festival: contracts.Festival{ID: "fest-3", SurgePaisa: 1500}, active: true},
	}
	b, err := s.priceDelivery(context.Background(), 5.2, DefaultDeliveryFeeSettings(), at, "10:20")
	if err != nil {
		t.Fatalf("priceDelivery must fail OPEN on a degraded weather error, got %v", err)
	}
	if !b.Degraded {
		t.Fatal("degraded bill must carry Degraded=true")
	}
	if b.WeatherSurgePaisa != 0 {
		t.Fatalf("degraded weather surge = %d, want 0 (waived)", b.WeatherSurgePaisa)
	}
	if b.NightSurgePaisa != 2000 || b.FestivalSurgePaisa != 1500 {
		t.Fatalf("night/festival must survive degradation = %d/%d", b.NightSurgePaisa, b.FestivalSurgePaisa)
	}
	if b.TotalPaisa != 3500+1540+2000+1500 {
		t.Fatalf("degraded total = %d, want %d", b.TotalPaisa, 3500+1540+2000+1500)
	}
	var hasReason bool
	for _, r := range b.SurgeReasons {
		if r == "weather_degraded" {
			hasReason = true
		}
	}
	if !hasReason {
		t.Fatalf("degraded bill must carry the weather_degraded reason, got %v", b.SurgeReasons)
	}
	if strings.Contains(strings.Join(b.SurgeReasons, ","), "weather,") {
		t.Fatalf("a waived weather surge must not be reported as a charged weather reason: %v", b.SurgeReasons)
	}
}

func TestPriceDeliveryFestivalOverridesCardAmount(t *testing.T) {
	at := time.Date(2026, 1, 5, 12, 0, 0, 0, time.FixedZone("IST", 5*3600+1800))
	s := &Service{
		surge:     fakeSurge{rates: contracts.SurgeRates{FestivalPaisa: 900}},
		weather:   fakeWeather{raining: false},
		festivals: fakeFestival{festival: contracts.Festival{ID: "fest-2", SurgePaisa: 1500}, active: true},
	}
	b, err := s.priceDelivery(context.Background(), 3, DefaultDeliveryFeeSettings(), at, "1:2")
	if err != nil {
		t.Fatalf("priceDelivery = %v, want nil", err)
	}
	if b.FestivalSurgePaisa != 1500 {
		t.Fatalf("festival = %d, want the calendar row's 1500", b.FestivalSurgePaisa)
	}
}

func TestCustomerDeliveryFeePaisaHonoursFreeDeliveryCoupon(t *testing.T) {
	if got := customerDeliveryFeePaisa(9540, true); got != 0 {
		t.Fatalf("free delivery fee = %d, want 0", got)
	}
	if got := customerDeliveryFeePaisa(9540, false); got != 9540 {
		t.Fatalf("paid delivery fee = %d, want 9540", got)
	}
	if got := customerDeliveryFeePaisa(-1, false); got != 0 {
		t.Fatalf("negative fee = %d, want 0", got)
	}
}
