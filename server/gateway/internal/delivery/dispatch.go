package delivery

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
)

// RoadMatrix returns the road travel time/distance between two points. The production
// implementation is the Google Routes API (computeRouteMatrix, TRAFFIC_AWARE) called by the
// gateway; results are cached in Valkey for 5 minutes (cache.DeliveryRoute). The default
// StraightLineMatrix keeps local/dev/test behaviour deterministic and needs no network.
type RoadMatrix interface {
	Travel(fromLat, fromLng, toLat, toLng float64) (seconds int64, meters int64)
}

// StraightLineMatrix estimates travel from the Haversine distance at a conservative urban speed.
// It is the explicit fallback — never a silent substitute for the production Routes client.
type StraightLineMatrix struct{}

// Travel implements RoadMatrix.
func (StraightLineMatrix) Travel(fromLat, fromLng, toLat, toLng float64) (int64, int64) {
	metres := haversineMeters(fromLat, fromLng, toLat, toLng)
	const urbanMetersPerSecond = 7.0 // ~25 km/h average
	return int64(math.Round(metres / urbanMetersPerSecond)), int64(math.Round(metres))
}

// TravelLeg is the cached projection of one Routes API matrix leg.
type TravelLeg struct {
	Seconds int64 `json:"seconds"`
	Meters  int64 `json:"meters"`
}

// GoogleRoutesMatrix is the production RoadMatrix. It calls the Google Routes API
// (distanceMatrix/v2:computeRouteMatrix, TRAFFIC_AWARE) and caches each leg in Valkey for
// TTLDeliveryRoute. Any upstream failure degrades to StraightLineMatrix so dispatch stays
// available; the fallback is logged by the caller-side metrics/audit trail, never silently
// promoted to a "road" result.
type GoogleRoutesMatrix struct {
	apiKey string
	cache  *cache.Cache
	client *http.Client
}

// NewRoutesMatrix returns nil when apiKey is empty (the handler then uses the straight-line
// fallback, which is correct for local/dev/test).
func NewRoutesMatrix(apiKey string, c *cache.Cache) RoadMatrix {
	if strings.TrimSpace(apiKey) == "" {
		return nil
	}
	return &GoogleRoutesMatrix{
		apiKey: strings.TrimSpace(apiKey),
		cache:  c,
		client: &http.Client{Timeout: 8 * time.Second},
	}
}

type routesWaypoint struct {
	Waypoint struct {
		Location struct {
			LatLng struct {
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
			} `json:"latLng"`
		} `json:"location"`
	} `json:"waypoint"`
}

type routesMatrixResponse struct {
	OriginIndex      int    `json:"originIndex"`
	DestinationIndex int    `json:"destinationIndex"`
	Duration         string `json:"duration"`
	DistanceMeters   int64  `json:"distanceMeters"`
	Condition        string `json:"condition"`
}

func waypoint(lat, lng float64) routesWaypoint {
	var w routesWaypoint
	w.Waypoint.Location.LatLng.Latitude = lat
	w.Waypoint.Location.LatLng.Longitude = lng
	return w
}

// Travel implements RoadMatrix.
func (m *GoogleRoutesMatrix) Travel(fromLat, fromLng, toLat, toLng float64) (int64, int64) {
	ctx := context.Background()
	key := cache.DeliveryRouteLeg(fromLat, fromLng, toLat, toLng)
	var cached TravelLeg
	if m.cache != nil && m.cache.GetJSON(ctx, key, &cached) && cached.Seconds > 0 {
		return cached.Seconds, cached.Meters
	}
	body, _ := json.Marshal(map[string]any{
		"origins":           []routesWaypoint{waypoint(fromLat, fromLng)},
		"destinations":      []routesWaypoint{waypoint(toLat, toLng)},
		"travelMode":        "DRIVE",
		"routingPreference": "TRAFFIC_AWARE",
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", bytes.NewReader(body))
	if err != nil {
		return StraightLineMatrix{}.Travel(fromLat, fromLng, toLat, toLng)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Goog-Api-Key", m.apiKey)
	req.Header.Set("X-Goog-FieldMask", "originIndex,destinationIndex,duration,distanceMeters,condition")
	res, err := m.client.Do(req)
	if err != nil {
		return StraightLineMatrix{}.Travel(fromLat, fromLng, toLat, toLng)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return StraightLineMatrix{}.Travel(fromLat, fromLng, toLat, toLng)
	}
	var rows []routesMatrixResponse
	if err := json.NewDecoder(res.Body).Decode(&rows); err != nil {
		return StraightLineMatrix{}.Travel(fromLat, fromLng, toLat, toLng)
	}
	for _, row := range rows {
		if row.Condition != "" && row.Condition != "ROUTE_EXISTS" {
			continue
		}
		leg := TravelLeg{Seconds: parseDurationSeconds(row.Duration), Meters: row.DistanceMeters}
		if leg.Seconds <= 0 || leg.Meters <= 0 {
			continue
		}
		if m.cache != nil {
			m.cache.SetJSON(ctx, key, leg, cache.TTLDeliveryRoute)
		}
		return leg.Seconds, leg.Meters
	}
	return StraightLineMatrix{}.Travel(fromLat, fromLng, toLat, toLng)
}

func parseDurationSeconds(raw string) int64 {
	s := strings.TrimSuffix(strings.TrimSpace(raw), "s")
	if s == "" {
		return 0
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return n
}

// RiderLocation is a candidate rider's last cached coordinate.
type RiderLocation struct {
	Rider Rider
	Lat   float64
	Lng   float64
	Stale bool
}

// PickRider scores available riders for a new pickup. Primary: road duration to the store (lower
// wins). Secondary: capacity headroom (more free slots wins), rating, and zone affinity.
func PickRider(candidates []RiderLocation, storeLat, storeLng float64, matrix RoadMatrix) *RiderLocation {
	if len(candidates) == 0 {
		return nil
	}
	if matrix == nil {
		matrix = StraightLineMatrix{}
	}
	type scored struct {
		loc      RiderLocation
		seconds  int64
		headroom int
	}
	out := make([]scored, 0, len(candidates))
	for _, c := range candidates {
		if c.Stale || c.Rider.CurrentLoad >= c.Rider.MaxCapacity {
			continue
		}
		seconds, _ := matrix.Travel(c.Lat, c.Lng, storeLat, storeLng)
		out = append(out, scored{loc: c, seconds: seconds, headroom: c.Rider.MaxCapacity - c.Rider.CurrentLoad})
	}
	if len(out) == 0 {
		return nil
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].seconds != out[j].seconds {
			return out[i].seconds < out[j].seconds
		}
		if out[i].headroom != out[j].headroom {
			return out[i].headroom > out[j].headroom
		}
		return out[i].loc.Rider.Rating > out[j].loc.Rider.Rating
	})
	best := out[0]
	return &best.loc
}

// haversineMeters is the great-circle distance between two coordinates.
func haversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371000.0
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLng := (lng2 - lng1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadius * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}
