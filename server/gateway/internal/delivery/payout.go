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
	PayoutID            string   `json:"payoutId,omitempty"`
	OrderID             string   `json:"orderId"`
	RiderID             string   `json:"riderId"`
	DistanceKm          float64  `json:"distanceKm"`
	BaseRatePaisa       int64    `json:"baseRatePaisa"`
	ExtraKmChargePaisa  int64    `json:"extraKmChargePaisa"`
	SurgePaisa          int64    `json:"surgePaisa"`
	SurgeReason         string   `json:"surgeReason,omitempty"`
	TotalPaisa          int64    `json:"totalPaisa"`
	PayoutMode          string   `json:"payoutMode"`
	ManualDistanceKm    *float64 `json:"manualDistanceKm,omitempty"`
	ManualFarePaisa     *int64   `json:"manualFarePaisa,omitempty"`
	CalculatedFarePaisa *int64   `json:"calculatedFarePaisa,omitempty"`
	FareOverrideReason  string   `json:"fareOverrideReason,omitempty"`
	Status              string   `json:"status"`
	PaidAt              string   `json:"paidAt,omitempty"`
	// PaidAmountPaisa accumulates manual "Mark as Paid" entries so the unpaid balance
	// (TotalPaisa-PaidAmountPaisa) carries forward (migration 0077). PaidBy is the actor id.
	PaidAmountPaisa int64  `json:"paidAmountPaisa,omitempty"`
	PaidBy          string `json:"paidBy,omitempty"`
	BalancePaisa    int64  `json:"balancePaisa,omitempty"`
}

// SurgeInput selects the optional, server-verified surge reasons.
type SurgeInput struct {
	Weather  bool
	Festival bool
	At       time.Time
}

// CalculatePayoutDetails derives the payout for an order from the rate card and the customer-paid
// delivery basis. It is shared by the read-time calculation (calculatePayout) and the
// completion-time materialisation so the two paths can never diverge. weather/festival are the
// explicit admin test overrides; completion passes false for both.
func CalculatePayoutDetails(order Order, settings PayoutSettings, storedMeters, storedSurge int64, storedReason string, hasBasis, weather, festival bool) RiderPayout {
	at := time.Now()
	if order.AssignedAt != "" {
		if parsed, err := time.Parse(time.RFC3339, order.AssignedAt); err == nil {
			at = parsed
		}
	}

	// MANUAL orders are settled with the admin-recorded distance + fare. Until the admin records
	// them, show the rate-card preview so the rider still sees an expected amount.
	if order.PayoutMode == PayoutManual {
		meters := order.TotalDistanceMeters
		if hasBasis && !weather && !festival {
			meters = storedMeters
		}
		preview := ComputeRiderPayoutWithSurge(order.OrderID, order.RiderID, meters,
			settings, storedSurge, storedReason)
		if order.ManualDistanceKm != nil {
			preview = ComputeRiderPayoutWithSurge(order.OrderID, order.RiderID,
				int64(math.Round(*order.ManualDistanceKm*1000)), settings, storedSurge, storedReason)
		}
		total := preview.TotalPaisa
		if order.ManualFarePaisa != nil {
			total = *order.ManualFarePaisa
		}
		calculated := preview.TotalPaisa
		return RiderPayout{
			OrderID: order.OrderID, RiderID: order.RiderID, DistanceKm: preview.DistanceKm,
			BaseRatePaisa: preview.BaseRatePaisa, ExtraKmChargePaisa: preview.ExtraKmChargePaisa,
			SurgePaisa: preview.SurgePaisa, SurgeReason: preview.SurgeReason,
			TotalPaisa: total, PayoutMode: PayoutManual, ManualDistanceKm: order.ManualDistanceKm,
			ManualFarePaisa: order.ManualFarePaisa, CalculatedFarePaisa: &calculated,
			FareOverrideReason: order.FareOverrideReason, Status: "PENDING",
		}
	}

	var p RiderPayout
	if hasBasis && !weather && !festival {
		// Use exactly the distance the customer was billed on, so the ₹5 base margin and the per-km
		// pass-through hold (road-distance differences never create a divergence). A zero stored
		// distance is meaningful (e.g. a delivery placed without a live fix, billed at base only),
		// so never substitute the route distance for a stored basis.
		p = ComputeRiderPayoutWithSurge(order.OrderID, order.RiderID, storedMeters,
			settings, storedSurge, storedReason)
	} else {
		surge := SurgeInput{Weather: weather, Festival: festival, At: at}
		p = ComputeRiderPayout(order.OrderID, order.RiderID, order.TotalDistanceMeters, settings, surge)
	}
	if order.CalculatedFarePaisa != nil {
		p.CalculatedFarePaisa = order.CalculatedFarePaisa
	}
	return p
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
		PayoutMode: PayoutAutomated,
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
