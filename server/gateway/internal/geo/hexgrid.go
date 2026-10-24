// Package geo resolves a server-trusted delivery zone from a drop-off coordinate.
//
// The zone is a deterministic hexagonal cell (~2–3 km across) derived with a dependency-free
// pointy-top axial grid over an equirectangular projection. The app never computes its own zone —
// checkout and the delivery-fee quote resolve it server-side from the customer fix.
//
// A production swap to uber/go-h3 only needs to change GeoCell/GeoCellCenter; call sites stay.
package geo

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// CellKm is the nominal centre-to-centre spacing of one zone (~2.5 km).
const CellKm = 2.5

const (
	kmPerDegLat = 110.574
	// India sits around 20°N; a fixed reference keeps the projection deterministic and stable.
	kmPerDegLng = 111.320 * 0.94 // cos(20°)
)

var hexSize = CellKm / math.Sqrt(3)

// GeoCell returns the stable "q:r" zone id for a coordinate.
func GeoCell(lat, lng float64) string {
	x, y := project(lat, lng)
	q := (math.Sqrt(3)/3*x - y/3) / hexSize
	r := (2.0 / 3.0 * y) / hexSize
	qi, ri := hexRound(q, r)
	return fmt.Sprintf("%d:%d", qi, ri)
}

// GeoCellCenter returns the centre coordinate of a zone id. An unparseable id yields (0, 0).
func GeoCellCenter(cellID string) (lat, lng float64) {
	q, r, ok := parseCell(cellID)
	if !ok {
		return 0, 0
	}
	x := hexSize * (math.Sqrt(3)*float64(q) + math.Sqrt(3)/2*float64(r))
	y := hexSize * (1.5 * float64(r))
	return unproject(x, y)
}

// DistanceKm is the great-circle distance between two coordinates (km).
func DistanceKm(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371.0088
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLng := (lng2 - lng1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadius * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func project(lat, lng float64) (x, y float64) {
	return lng * kmPerDegLng, lat * kmPerDegLat
}

func unproject(x, y float64) (lat, lng float64) {
	return y / kmPerDegLat, x / kmPerDegLng
}

func parseCell(cellID string) (q, r int64, ok bool) {
	parts := strings.Split(strings.TrimSpace(cellID), ":")
	if len(parts) != 2 {
		return 0, 0, false
	}
	q, errQ := strconv.ParseInt(parts[0], 10, 64)
	r, errR := strconv.ParseInt(parts[1], 10, 64)
	if errQ != nil || errR != nil {
		return 0, 0, false
	}
	return q, r, true
}

func hexRound(q, r float64) (int64, int64) {
	x, z := q, r
	y := -x - z
	rx, ry, rz := math.Round(x), math.Round(y), math.Round(z)
	dx, dy, dz := math.Abs(rx-x), math.Abs(ry-y), math.Abs(rz-z)
	switch {
	case dx > dy && dx > dz:
		rx = -ry - rz
	case dy > dz:
		ry = -rx - rz
	default:
		rz = -rx - ry
	}
	return int64(rx), int64(rz)
}
