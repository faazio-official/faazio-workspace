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
	surgePaisa := int64(0)
	reasons := ""
	at := surge.At
	if at.IsZero() {
		at = time.Now()
	}
	if h := at.UTC().Add(5*time.Hour + 30*time.Minute).Hour(); h >= 23 || h < 3 {
		surgePaisa += max64(s.NightSurgePaisa, 0)
		reasons = "night"
	}
	if surge.Weather {
		surgePaisa += max64(s.WeatherSurgePaisa, 0)
		reasons = joinReason(reasons, "weather")
	}
	if surge.Festival {
		surgePaisa += max64(s.FestivalSurgePaisa, 0)
		reasons = joinReason(reasons, "festival")
	}
	return riderPayoutFrom(orderID, riderID, distanceMeters, s, surgePaisa, reasons)
}

// ComputeRiderPayoutWithSurge reuses the customer-paid surge stored at placement. This is the
// 1:1 pass-through path: the rider gets exactly what the customer was billed for surges.
func ComputeRiderPayoutWithSurge(orderID, riderID string, distanceMeters int64, s PayoutSettings, surgePaisa int64, surgeReason string) RiderPayout {
	if surgePaisa < 0 {
		surgePaisa = 0
	}
	return riderPayoutFrom(orderID, riderID, distanceMeters, s, surgePaisa, surgeReason)
}

func riderPayoutFrom(orderID, riderID string, distanceMeters int64, s PayoutSettings, surgePaisa int64, surgeReason string) RiderPayout {
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

	return RiderPayout{
		OrderID: orderID, RiderID: riderID, DistanceKm: km,
		BaseRatePaisa: s.BaseRatePaisa, ExtraKmChargePaisa: extraCharge,
		SurgePaisa: surgePaisa, SurgeReason: surgeReason,
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

func max64(v, floor int64) int64 {
	if v < floor {
		return floor
	}
	return v
}
