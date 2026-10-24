// Package pricing is the pure delivery-price calculator shared by the customer quote, order
// settlement and (via the stored basis) rider payout. It has no DB/network dependencies so the
// money rules stay testable.
package pricing

import (
	"math"
	"time"
)

// SurgeRates is the admin-editable surcharge card in paisa. A zero amount means the reason is free;
// callers must zero out reasons that are not active (e.g. Weather when it is not raining).
type SurgeRates struct {
	NightPaisa    int64
	WeatherPaisa  int64
	FestivalPaisa int64
}

// PriceBreakdown is the customer-facing delivery bill. FeePaisa is the legacy alias for TotalPaisa
// kept so older clients that read `feePaisa` keep working.
type PriceBreakdown struct {
	DistanceKm         float64  `json:"distanceKm"`
	ZoneID             string   `json:"zoneId,omitempty"`
	BaseDistanceKm     float64  `json:"baseDistanceKm"`
	BaseFeePaisa       int64    `json:"baseFeePaisa"`
	ExtraKmPaisa       int64    `json:"extraKmPaisa"`
	NightSurgePaisa    int64    `json:"nightSurgePaisa"`
	WeatherSurgePaisa  int64    `json:"weatherSurgePaisa"`
	FestivalSurgePaisa int64    `json:"festivalSurgePaisa"`
	TotalPaisa         int64    `json:"totalPaisa"`
	FeePaisa           int64    `json:"feePaisa"`
	SurgeReasons       []string `json:"surgeReasons,omitempty"`
}

// IsNightSurge reports whether at falls inside the 23:00–03:00 IST night window.
func IsNightSurge(at time.Time) bool {
	ist := at.UTC().Add(5*time.Hour + 30*time.Minute)
	h := ist.Hour()
	return h >= 23 || h < 3
}

// ComputeDeliveryPrice applies the base + per-extra-km card (fractional km, rounded to the nearest
// paisa so customer and rider see the same 1:1 amount) plus the active surges.
func ComputeDeliveryPrice(distanceKm, baseDistanceKm float64, baseFeePaisa, perExtraKmPaisa int64, rates SurgeRates, at time.Time) PriceBreakdown {
	if baseDistanceKm < 0 {
		baseDistanceKm = 0
	}
	if baseFeePaisa < 0 {
		baseFeePaisa = 0
	}
	if perExtraKmPaisa < 0 {
		perExtraKmPaisa = 0
	}
	km := math.Round(math.Max(0, distanceKm)*100) / 100
	extraKm := km - baseDistanceKm
	if extraKm < 0 {
		extraKm = 0
	}
	extraPaisa := int64(math.Round(extraKm * float64(perExtraKmPaisa)))

	nightPaisa := int64(0)
	if IsNightSurge(at) {
		nightPaisa = max64(rates.NightPaisa, 0)
	}
	weatherPaisa := max64(rates.WeatherPaisa, 0)
	festivalPaisa := max64(rates.FestivalPaisa, 0)

	reasons := make([]string, 0, 3)
	if nightPaisa > 0 {
		reasons = append(reasons, "night")
	}
	if weatherPaisa > 0 {
		reasons = append(reasons, "weather")
	}
	if festivalPaisa > 0 {
		reasons = append(reasons, "festival")
	}

	total := baseFeePaisa + extraPaisa + nightPaisa + weatherPaisa + festivalPaisa
	return PriceBreakdown{
		DistanceKm:         km,
		BaseDistanceKm:     baseDistanceKm,
		BaseFeePaisa:       baseFeePaisa,
		ExtraKmPaisa:       extraPaisa,
		NightSurgePaisa:    nightPaisa,
		WeatherSurgePaisa:  weatherPaisa,
		FestivalSurgePaisa: festivalPaisa,
		TotalPaisa:         total,
		FeePaisa:           total,
		SurgeReasons:       reasons,
	}
}

func max64(v, floor int64) int64 {
	if v < floor {
		return floor
	}
	return v
}
