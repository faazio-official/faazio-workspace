package delivery

import (
	"fmt"
	"math/rand"
	"testing"
)

// TestOptimizeGlobalRouteMatchesBruteForce cross-checks the Held-Karp solver against an exhaustive
// permutation oracle for small pending-only routes.
func TestOptimizeGlobalRouteMatchesBruteForce(t *testing.T) {
	rng := rand.New(rand.NewSource(7))
	matrix := unitMatrix{}
	for trial := 0; trial < 200; trial++ {
		orders := 1 + rng.Intn(3)
		stops := make([]Stop, 0, orders*2)
		for o := 0; o < orders; o++ {
			id := fmt.Sprintf("O%d", o)
			stops = append(stops,
				makeStop(id+"-p", id, "PICKUP", StopPending, float64(rng.Intn(20)), float64(rng.Intn(20))),
				makeStop(id+"-d", id, "DROP", StopPending, float64(rng.Intn(20)), float64(rng.Intn(20))))
		}
		got, err := OptimizeGlobalRoute(stops, 0, 0, matrix)
		if err != nil {
			t.Fatalf("solver error: %v", err)
		}
		gotCost := routeCost(got, 0, 0, matrix)
		wantCost, ok := bruteForceCost(stops, 0, 0, matrix)
		if !ok {
			t.Fatalf("brute force found no valid route for %v", routeIDs(stops))
		}
		if gotCost != wantCost {
			t.Fatalf("trial %d: solver %ds != brute force %ds (order %v)", trial, gotCost, wantCost, routeIDs(got))
		}
	}
}

func routeCost(stops []Stop, lat, lng float64, matrix RoadMatrix) int64 {
	var total int64
	for _, s := range stops {
		leg, _ := matrix.Travel(lat, lng, *s.Latitude, *s.Longitude)
		total += leg
		lat, lng = *s.Latitude, *s.Longitude
	}
	return total
}

func bruteForceCost(stops []Stop, lat, lng float64, matrix RoadMatrix) (int64, bool) {
	perm := make([]Stop, len(stops))
	copy(perm, stops)
	best := int64(1 << 62)
	valid := false
	var walk func(int)
	walk = func(i int) {
		if i == len(perm) {
			seen := map[string]bool{}
			for _, s := range perm {
				if s.StopType == "DROP" && !seen[s.DeliveryOrderID] {
					return
				}
				if s.StopType == "PICKUP" {
					seen[s.DeliveryOrderID] = true
				}
			}
			valid = true
			if c := routeCost(perm, lat, lng, matrix); c < best {
				best = c
			}
			return
		}
		for j := i; j < len(perm); j++ {
			perm[i], perm[j] = perm[j], perm[i]
			walk(i + 1)
			perm[i], perm[j] = perm[j], perm[i]
		}
	}
	walk(0)
	return best, valid
}
