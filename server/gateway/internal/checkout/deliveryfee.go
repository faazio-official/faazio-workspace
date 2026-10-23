package checkout

import "math"

// DeliveryFeeSettings is the singleton dynamic delivery-fee rate card (tax.delivery_fee_settings).
// Road distance is server-authoritative; the fee formula mirrors the client's estimate helper
// (features/cart/utils computeDeliveryFeePaisa) so settlement and the displayed quote agree.
type DeliveryFeeSettings struct {
	BaseDistanceKm  float64
	BaseFeePaisa    int64
	PerExtraKmPaisa int64
}

// DefaultDeliveryFeeSettings is the fallback card (3 km / ₹35 / ₹9 per extra km) when the settings
// row is absent — mirrors the migration seed.
func DefaultDeliveryFeeSettings() DeliveryFeeSettings {
	return DeliveryFeeSettings{BaseDistanceKm: 3, BaseFeePaisa: 3500, PerExtraKmPaisa: 900}
}

// feeForDistanceKm applies the base + overage formula over a distance: ≤ base → base fee; beyond →
// base + floor(extra km) × per-extra-km. Whole-number paisa math (never negative).
func feeForDistanceKm(distanceKm float64, s DeliveryFeeSettings) int64 {
	extraKm := math.Floor(math.Max(0, distanceKm) - s.BaseDistanceKm)
	if extraKm <= 0 {
		return s.BaseFeePaisa
	}
	return s.BaseFeePaisa + int64(extraKm)*s.PerExtraKmPaisa
}

// haversineKm is the great-circle distance (km) between two coordinates. It is the same
// straight-line fallback the delivery dispatch uses (delivery.haversineMeters); road distance is
// the future Routes-API upgrade and stays server-authoritative.
func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371.0088
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLng := (lng2 - lng1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadius * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}
