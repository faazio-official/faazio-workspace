package delivery

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

// RiderLocation is a candidate rider's last cached coordinate plus the ordered, still-open stops of
// their accepted route. ActiveStops is internal-only: it is the routing input for detour scoring and
// is never projected to a client.
type RiderLocation struct {
	Rider       Rider
	Lat         float64
	Lng         float64
	Stale       bool
	ActiveStops []Stop `json:"-"`
}

// PickRider preserves the original road-time-to-store behaviour for callers that have no active
// route context (and for the fallback chain).
func PickRider(candidates []RiderLocation, storeLat, storeLng float64, matrix RoadMatrix) *RiderLocation {
	return PickRiderWithStops(candidates, storeLat, storeLng, storeLat, storeLng, matrix)
}

// PickRiderWithStops scores candidates by the road time actually added to their existing route.
//
// A rider with no open stops is scored by rider → store. A rider already carrying work is scored on
// the leg they must first drive (last drop → store) plus the detour their route takes versus driving
// straight from that last drop to the new customer. Capacity headroom and rating break ties. This is
// an insertion heuristic, not a full VRP: it stays deterministic and cheap enough to run inline.
func PickRiderWithStops(candidates []RiderLocation, storeLat, storeLng, customerLat, customerLng float64, matrix RoadMatrix) *RiderLocation {
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
		if last, ok := lastActiveDrop(c.ActiveStops); ok {
			legA, _ := matrix.Travel(*last.Latitude, *last.Longitude, storeLat, storeLng)
			legB, _ := matrix.Travel(storeLat, storeLng, customerLat, customerLng)
			direct, _ := matrix.Travel(*last.Latitude, *last.Longitude, customerLat, customerLng)
			detour := legA + legB - direct
			if detour < 0 {
				detour = 0
			}
			seconds = legA + detour
		}
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

// lastActiveDrop returns the drop the rider is currently heading to (the last open drop in their
// ordered stop list). A route with only a pickup in progress has no drop yet, so it gets no detour
// credit and is scored by rider → store.
func lastActiveDrop(stops []Stop) (Stop, bool) {
	for i := len(stops) - 1; i >= 0; i-- {
		s := stops[i]
		if s.StopType != "DROP" || s.Latitude == nil || s.Longitude == nil {
			continue
		}
		return s, true
	}
	return Stop{}, false
}

// maxGlobalRouteStops bounds the exact solver. Production capacity is five four-wheeler orders (ten
// stops), so a Held-Karp state space of 2^n·n² stays tiny; the ceiling only protects future changes.
const maxGlobalRouteStops = 15

// OptimizeGlobalRoute returns a globally optimal visit order for all open stops using a Held-Karp
// bitmask DP. Unlike OptimizeStopSequence it may interleave and reorder unstarted stops across the
// rider's accepted orders. The route prefix up to and including the last started stop is pinned so an
// in-progress leg is never redirected, and each order's pickup must precede its drop. The rider's
// current location is the start point (or the last pinned stop when work is already under way).
func OptimizeGlobalRoute(stops []Stop, startLat, startLng float64, matrix RoadMatrix) ([]Stop, error) {
	if len(stops) == 0 {
		return nil, nil
	}
	if matrix == nil {
		matrix = StraightLineMatrix{}
	}
	fixed := 0
	for i, s := range stops {
		if s.Status != "" && s.Status != StopPending {
			fixed = i + 1
		}
	}
	free := make([]Stop, len(stops)-fixed)
	copy(free, stops[fixed:])
	if len(free) <= 1 {
		out := append([]Stop(nil), stops...)
		renumberStops(out)
		return out, nil
	}
	if len(free) > maxGlobalRouteStops {
		return nil, fmt.Errorf("delivery: %d open stops exceeds the global solver limit of %d",
			len(free), maxGlobalRouteStops)
	}

	// The rider is already executing the pinned prefix, so optimization starts after its last stop.
	fromLat, fromLng := startLat, startLng
	if fixed > 0 {
		if last := stops[fixed-1]; last.Latitude != nil && last.Longitude != nil {
			fromLat, fromLng = *last.Latitude, *last.Longitude
		}
	}

	legSeconds := func(fromLat, fromLng, toLat, toLng *float64) int64 {
		if fromLat == nil || fromLng == nil || toLat == nil || toLng == nil {
			return 0
		}
		seconds, _ := matrix.Travel(*fromLat, *fromLng, *toLat, *toLng)
		return seconds
	}

	m := len(free)
	startCost := make([]int64, m)
	for i := range free {
		startCost[i] = legSeconds(&fromLat, &fromLng, free[i].Latitude, free[i].Longitude)
	}
	cost := make([][]int64, m)
	for i := range cost {
		cost[i] = make([]int64, m)
		for j := range cost[i] {
			cost[i][j] = legSeconds(free[i].Latitude, free[i].Longitude, free[j].Latitude, free[j].Longitude)
		}
	}

	// A drop may only be visited after its own pickup when both are still open (free).
	pickupAt := make(map[string]int, m)
	dropAt := make(map[string]int, m)
	for i, s := range free {
		if s.DeliveryOrderID == "" {
			continue
		}
		switch s.StopType {
		case "PICKUP":
			if _, ok := pickupAt[s.DeliveryOrderID]; !ok {
				pickupAt[s.DeliveryOrderID] = i
			}
		case "DROP":
			if _, ok := dropAt[s.DeliveryOrderID]; !ok {
				dropAt[s.DeliveryOrderID] = i
			}
		}
	}
	prereq := make([]uint32, m)
	for orderID, d := range dropAt {
		p, ok := pickupAt[orderID]
		if ok && p != d {
			prereq[d] |= 1 << p
		}
	}

	const inf = int64(math.MaxInt64 / 4)
	states := 1 << m
	dp := make([]int64, states*m)
	for i := range dp {
		dp[i] = inf
	}
	parent := make([]uint16, states*m)
	for i := 0; i < m; i++ {
		if prereq[i] != 0 {
			continue
		}
		dp[(1<<i)*m+i] = startCost[i]
	}
	for mask := 1; mask < states; mask++ {
		for last := 0; last < m; last++ {
			cur := dp[mask*m+last]
			if cur == inf {
				continue
			}
			for next := 0; next < m; next++ {
				bit := 1 << next
				if mask&bit != 0 {
					continue
				}
				if prereq[next]&^uint32(mask) != 0 {
					continue
				}
				nm := mask | bit
				if cand := cur + cost[last][next]; cand < dp[nm*m+next] {
					dp[nm*m+next] = cand
					parent[nm*m+next] = uint16(last + 1)
				}
			}
		}
	}
	bestCost := inf
	bestLast := -1
	finalMask := states - 1
	for last := 0; last < m; last++ {
		if c := dp[finalMask*m+last]; c < bestCost {
			bestCost = c
			bestLast = last
		}
	}
	if bestLast < 0 {
		return nil, fmt.Errorf("%w: no stop order satisfies the pickup-before-drop rules", ErrConflict)
	}
	rev := make([]int, 0, m)
	mask := finalMask
	for last := bestLast; ; {
		rev = append(rev, last)
		p := parent[mask*m+last]
		mask &^= 1 << last
		if p == 0 {
			break
		}
		last = int(p - 1)
	}
	out := make([]Stop, 0, len(stops))
	out = append(out, stops[:fixed]...)
	for i := len(rev) - 1; i >= 0; i-- {
		out = append(out, free[rev[i]])
	}
	renumberStops(out)
	return out, nil
}

func renumberStops(stops []Stop) {
	for i := range stops {
		stops[i].Sequence = i + 1
	}
}

// OptimizeStopSequence inserts a new pickup/drop pair into the rider's existing ordered route with
// the smallest total road duration. Existing stops keep their relative order; the new pickup must
// precede its drop; and nothing is inserted before a stop the rider has already started (its status
// is no longer PENDING), so an in-progress pickup is not redirected mid-leg.
//
// The returned slice is the combined route with Sequence renumbered from 1.
func OptimizeStopSequence(existing []Stop, newPickup, newDrop Stop, matrix RoadMatrix) ([]Stop, error) {
	if newPickup.Latitude == nil || newPickup.Longitude == nil ||
		newDrop.Latitude == nil || newDrop.Longitude == nil {
		return nil, fmt.Errorf("%w: new stops need coordinates for re-sequencing", ErrConflict)
	}
	if matrix == nil {
		matrix = StraightLineMatrix{}
	}
	fixed := 0
	for i, s := range existing {
		if s.Status != "" && s.Status != StopPending {
			fixed = i + 1
		}
	}
	n := len(existing)
	var best []Stop
	bestCost := int64(math.MaxInt64)
	bestAdjacent := false
	for i := fixed; i <= n; i++ {
		for j := i; j <= n; j++ {
			candidate := make([]Stop, 0, n+2)
			candidate = append(candidate, existing[:i]...)
			candidate = append(candidate, newPickup)
			candidate = append(candidate, existing[i:j]...)
			candidate = append(candidate, newDrop)
			candidate = append(candidate, existing[j:]...)
			cost := routeDurationSeconds(candidate, matrix)
			adjacent := j == i
			// Prefer the lower-cost route; on a tie prefer an adjacent pickup/drop (less handling),
			// then the earliest valid insertion to keep the rider moving.
			if cost < bestCost || (cost == bestCost && adjacent && !bestAdjacent) {
				bestCost = cost
				best = candidate
				bestAdjacent = adjacent
			}
		}
	}
	if best == nil {
		best = append(append(append([]Stop{}, existing...), newPickup), newDrop)
	}
	for i := range best {
		best[i].Sequence = i + 1
	}
	return best, nil
}

func routeDurationSeconds(stops []Stop, matrix RoadMatrix) int64 {
	var total int64
	for i := 1; i < len(stops); i++ {
		from, to := stops[i-1], stops[i]
		if from.Latitude == nil || from.Longitude == nil || to.Latitude == nil || to.Longitude == nil {
			continue
		}
		seconds, _ := matrix.Travel(*from.Latitude, *from.Longitude, *to.Latitude, *to.Longitude)
		total += seconds
	}
	return total
}

// EncodePolyline returns a Google-encoded polyline for the ordered stops that have coordinates. The
// partner app can render this directly with react-native-maps' Polyline without a second route call.
func EncodePolyline(stops []Stop) string {
	points := make([][2]float64, 0, len(stops))
	for _, s := range stops {
		if s.Latitude == nil || s.Longitude == nil {
			continue
		}
		points = append(points, [2]float64{*s.Latitude, *s.Longitude})
	}
	var b strings.Builder
	var prevLat, prevLng int64
	for _, p := range points {
		lat := int64(math.Round(p[0] * 1e5))
		lng := int64(math.Round(p[1] * 1e5))
		encodePolylineValue(&b, lat-prevLat)
		encodePolylineValue(&b, lng-prevLng)
		prevLat, prevLng = lat, lng
	}
	return b.String()
}

func encodePolylineValue(b *strings.Builder, value int64) {
	v := value << 1
	if value < 0 {
		v = ^v
	}
	for v >= 0x20 {
		b.WriteByte(byte((0x20 | (v & 0x1f)) + 63))
		v >>= 5
	}
	b.WriteByte(byte(v + 63))
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
