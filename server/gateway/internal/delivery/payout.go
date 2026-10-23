package delivery

import (
	"math"
	"time"
)

// PayoutSettings is the admin-editable rate card (delivery.payout_settings).
type PayoutSettings struct {
	BaseRatePaisa      int64   `json:"baseRatePaisa"`
	BaseDistanceKm     float64 `json:"baseDistanceKm"`
	PerExtraKmPaisa    int64   `json:"perExtraKmPaisa"`
	NightSurgePaisa    int64   `json:"nightSurgePaisa"`
	WeatherSurgePaisa  int64   `json:"weatherSurgePaisa"`
	FestivalSurgePaisa int64   `json:"festivalSurgePaisa"`
}

// DefaultPayoutSettings is the fallback rate card (₹30 for the first 3 km, ₹7/km after, +₹20 night).
func DefaultPayoutSettings() PayoutSettings {
	return PayoutSettings{
		BaseRatePaisa: 3000, BaseDistanceKm: 3, PerExtraKmPaisa: 700,
		NightSurgePaisa: 2000, WeatherSurgePaisa: 2500, FestivalSurgePaisa: 1500,
	}
}

// RiderPayout is one delivery.delivery_payouts row / calculation result (paisa on the wire).
type RiderPayout struct {
	PayoutID           string  `json:"payoutId,omitempty"`
	OrderID            string  `json:"orderId"`
	RiderID            string  `json:"riderId"`
	DistanceKm         float64 `json:"distanceKm"`
	BaseRatePaisa      int64   `json:"baseRatePaisa"`
	ExtraKmChargePaisa int64   `json:"extraKmChargePaisa"`
	SurgePaisa         int64   `json:"surgePaisa"`
	SurgeReason        string  `json:"surgeReason,omitempty"`
	TotalPaisa         int64   `json:"totalPaisa"`
	Status             string  `json:"status"`
	PaidAt             string  `json:"paidAt,omitempty"`
}

// SurgeInput selects the optional, server-verified surge reasons.
type SurgeInput struct {
	Weather  bool
	Festival bool
	At       time.Time
}

// ComputeRiderPayout derives a rider payout from the persisted route distance and the rate card.
// The night window is 23:00–03:00 IST; weather/festival surges must be asserted by ops.
func ComputeRiderPayout(orderID, riderID string, distanceMeters int64, s PayoutSettings, surge SurgeInput) RiderPayout {
	if s.BaseRatePaisa < 0 {
		s.BaseRatePaisa = 0
	}
	if s.BaseDistanceKm <= 0 {
		s.BaseDistanceKm = 3
	}
	if s.PerExtraKmPaisa < 0 {
		s.PerExtraKmPaisa = 0
	}
	km := math.Round(float64(distanceMeters)/1000*100) / 100
	if km < 0 {
		km = 0
	}
	extraKm := km - s.BaseDistanceKm
	if extraKm < 0 {
		extraKm = 0
	}
	extraCharge := int64(math.Round(extraKm * float64(s.PerExtraKmPaisa)))

	surgePaisa := int64(0)
	reasons := ""
	at := surge.At
	if at.IsZero() {
		at = time.Now()
	}
	ist := at.UTC().Add(5*time.Hour + 30*time.Minute)
	if h := ist.Hour(); h >= 23 || h < 3 {
		surgePaisa += s.NightSurgePaisa
		reasons = "night"
	}
	if surge.Weather {
		surgePaisa += s.WeatherSurgePaisa
		reasons = joinReason(reasons, "weather")
	}
	if surge.Festival {
		surgePaisa += s.FestivalSurgePaisa
		reasons = joinReason(reasons, "festival")
	}
	return RiderPayout{
		OrderID: orderID, RiderID: riderID, DistanceKm: km,
		BaseRatePaisa: s.BaseRatePaisa, ExtraKmChargePaisa: extraCharge,
		SurgePaisa: surgePaisa, SurgeReason: reasons,
		TotalPaisa: s.BaseRatePaisa + extraCharge + surgePaisa,
		Status:     "PENDING",
	}
}

func joinReason(current, next string) string {
	if current == "" {
		return next
	}
	return current + "," + next
}
