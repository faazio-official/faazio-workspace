package checkout

import (
	"github.com/faazio/server/gateway/internal/geo"
)

// DeliveryFeeSettings is the singleton dynamic delivery-fee rate card (tax.delivery_fee_settings).
// Road distance is server-authoritative; the fee formula mirrors the client's estimate helper
// (features/cart/utils computeDeliveryFeePaisa) so settlement and the displayed quote agree.
type DeliveryFeeSettings struct {
	BaseDistanceKm  float64
	BaseFeePaisa    int64
	PerExtraKmPaisa int64
}

// DefaultDeliveryFeeSettings is the fallback card (3 km / ₹35 / ₹7 per extra km) when the settings
// row is absent — mirrors the migration seed and the rider card's ₹7/km (1:1 pass-through).
func DefaultDeliveryFeeSettings() DeliveryFeeSettings {
	return DeliveryFeeSettings{BaseDistanceKm: 3, BaseFeePaisa: 3500, PerExtraKmPaisa: 700}
}

// haversineKm is the great-circle distance (km) between two coordinates. It is the same
// straight-line fallback the delivery dispatch uses (delivery.haversineMeters); road distance is
// the future Routes-API upgrade and stays server-authoritative.
func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	return geo.DistanceKm(lat1, lng1, lat2, lng2)
}
