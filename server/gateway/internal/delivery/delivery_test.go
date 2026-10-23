package delivery

import (
	"errors"
	"fmt"
	"math"
	"testing"
)

func TestNormalizePhone(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"9876543210", "+919876543210", true},
		{"+91 98765 43210", "+919876543210", true},
		{"919876543210", "+919876543210", true},
		{"12345", "", false},
		{"5123456789", "", false},
		{"", "", false},
	}
	for _, c := range cases {
		got, ok := NormalizePhone(c.in)
		if ok != c.ok || got != c.want {
			t.Fatalf("NormalizePhone(%q) = (%q,%v), want (%q,%v)", c.in, got, ok, c.want, c.ok)
		}
	}
}

func TestCapacityForVehicle(t *testing.T) {
	want := map[string]int{VehicleBicycle: 1, VehicleTwoWheeler: 2, VehicleFourWheeler: 5}
	for vehicle, capacity := range want {
		got, ok := CapacityForVehicle(vehicle)
		if !ok || got != capacity {
			t.Fatalf("CapacityForVehicle(%q) = (%d,%v), want (%d,true)", vehicle, got, ok, capacity)
		}
	}
	if _, ok := CapacityForVehicle("TRUCK"); ok {
		t.Fatal("unknown vehicle must be rejected")
	}
}

func TestValidStopTransition(t *testing.T) {
	allowed := []struct{ stopType, from, to string }{
		{"PICKUP", StopPending, StopAtPickup},
		{"PICKUP", StopAtPickup, StopPickedUp},
		{"PICKUP", StopPending, StopFailed},
		{"PICKUP", StopAtPickup, StopFailed},
		{"DROP", StopPending, StopAtCustomer},
		{"DROP", StopAtCustomer, StopDelivered},
		{"DROP", StopPending, StopFailed},
		{"DROP", StopAtCustomer, StopFailed},
		{"DROP", StopAtCustomer, StopAtCustomer},
	}
	for _, c := range allowed {
		if err := validStopTransition(c.stopType, c.from, c.to); err != nil {
			t.Fatalf("expected %s %s -> %s to be allowed: %v", c.stopType, c.from, c.to, err)
		}
	}
	denied := []struct{ stopType, from, to string }{
		{"PICKUP", StopPending, StopPickedUp},
		{"PICKUP", StopPickedUp, StopAtPickup},
		{"PICKUP", StopAtPickup, StopDelivered},
		{"DROP", StopPending, StopDelivered},
		{"DROP", StopPending, StopPickedUp},
		{"DROP", StopAtCustomer, StopAtPickup},
		{"DROP", StopDelivered, StopAtCustomer},
		{"DROP", StopFailed, StopDelivered},
	}
	for _, c := range denied {
		if err := validStopTransition(c.stopType, c.from, c.to); !errors.Is(err, ErrConflict) {
			t.Fatalf("expected %s %s -> %s to conflict, got %v", c.stopType, c.from, c.to, err)
		}
	}
}

func TestValidateApplicationRequiresVehicleDocuments(t *testing.T) {
	base := ApplyRequest{
		FullName:         "Ravi Kumar",
		StateCode:        "ts",
		HubZone:          "Madhapur",
		Address:          "12-34, Hitec City Road",
		City:             "Hyderabad",
		Pincode:          "500081",
		EmergencyContact: "9876500000",
		Bank: BankInput{
			AccountName:   "Ravi Kumar",
			AccountNumber: "123456789012",
			IFSC:          "HDFC0001234",
		},
	}
	bike := base
	bike.VehicleType = VehicleBicycle
	bike.MaxCapacity = 1
	bike.Documents = []DocumentInput{
		{DocType: "aadhaar", FileKey: " kyc/a "},
		{DocType: "PAN", FileKey: "kyc/p"},
		{DocType: "SELFIE", FileKey: "kyc/s"},
	}
	if msg, ok := validateApplication(&bike); !ok {
		t.Fatalf("bicycle application rejected: %s", msg)
	}
	if bike.StateCode != "TS" {
		t.Fatalf("state code not normalized: %q", bike.StateCode)
	}
	if bike.Documents[0].DocType != "AADHAAR" || bike.Documents[0].FileKey != "kyc/a" {
		t.Fatalf("document fields not normalized: %+v", bike.Documents[0])
	}
	if bike.EmergencyContact != "9876500000" {
		t.Fatalf("emergency contact not normalized: %q", bike.EmergencyContact)
	}

	car := base
	car.VehicleType = VehicleFourWheeler
	car.MaxCapacity = 6 // over the four-wheeler cap
	car.Documents = bike.Documents
	if _, ok := validateApplication(&car); ok {
		t.Fatal("capacity above the vehicle cap must be rejected")
	}

	car.MaxCapacity = 5
	if _, ok := validateApplication(&car); ok {
		t.Fatal("motorized vehicle without DL/RC/insurance must be rejected")
	}
}

func TestPickRiderPrefersNearbyAndSkipsFullOrStale(t *testing.T) {
	candidates := []RiderLocation{
		{Rider: Rider{RiderID: "far", MaxCapacity: 2, Rating: 5}, Lat: 17.5, Lng: 78.5},
		{Rider: Rider{RiderID: "near", MaxCapacity: 2, Rating: 4}, Lat: 17.41, Lng: 78.41},
		{Rider: Rider{RiderID: "full", MaxCapacity: 1, CurrentLoad: 1}, Lat: 17.40, Lng: 78.40},
		{Rider: Rider{RiderID: "stale", MaxCapacity: 2}, Lat: 17.40, Lng: 78.40, Stale: true},
	}
	best := PickRider(candidates, 17.40, 78.40, StraightLineMatrix{})
	if best == nil || best.Rider.RiderID != "near" {
		t.Fatalf("expected nearest eligible rider, got %+v", best)
	}
	if got := PickRider(nil, 0, 0, nil); got != nil {
		t.Fatal("no candidates must return nil")
	}
	if got := PickRider(candidates[2:], 17.4, 78.4, nil); got != nil {
		t.Fatal("full/stale riders must not be selected")
	}
}

func TestOTPAndMasking(t *testing.T) {
	otp := newOTP()
	if len(otp) != 4 {
		t.Fatalf("OTP must be 4 digits, got %q", otp)
	}
	if hashOTP(otp, "stop-1") == hashOTP(otp, "stop-2") {
		t.Fatal("OTP hash must bind to the stop id")
	}
	if got := maskAccount("1234 5678 9012"); got != "••••••••9012" {
		t.Fatalf("unexpected mask: %q", got)
	}
	if got := digitsOnly("12-34 56"); got != "123456" {
		t.Fatalf("unexpected digits: %q", got)
	}
}

func TestDispatchLegsRequiresBothCoordinates(t *testing.T) {
	lat, lng := 17.4, 78.4
	order := Order{Stops: []Stop{
		{StopType: "PICKUP", Latitude: &lat, Longitude: &lng},
		{StopType: "DROP", Latitude: &lat, Longitude: &lng},
	}}
	if _, _, ok := dispatchLegs(order); !ok {
		t.Fatal("pickup and drop coordinates must be dispatchable")
	}
	order.Stops[1].Latitude = nil
	if _, _, ok := dispatchLegs(order); ok {
		t.Fatal("a drop without coordinates must not be reassigned")
	}
}

func TestParseDurationSeconds(t *testing.T) {
	if got := parseDurationSeconds("123s"); got != 123 {
		t.Fatalf("duration parse = %d", got)
	}
	if got := parseDurationSeconds(""); got != 0 {
		t.Fatalf("empty duration = %d", got)
	}
}

func TestValidateApplicationRequiresContactAndLocation(t *testing.T) {
	base := ApplyRequest{
		FullName:         "Ravi Kumar",
		StateCode:        "TS",
		HubZone:          "Madhapur",
		Address:          "12-34, Hitec City Road",
		City:             "Hyderabad",
		Pincode:          "500081",
		EmergencyContact: "9876500000",
		VehicleType:      VehicleBicycle,
		MaxCapacity:      1,
		Bank: BankInput{
			AccountName: "Ravi Kumar", AccountNumber: "123456789012", IFSC: "HDFC0001234",
		},
		Documents: []DocumentInput{
			{DocType: "AADHAAR", FileKey: "kyc/a"},
			{DocType: "PAN", FileKey: "kyc/p"},
			{DocType: "SELFIE", FileKey: "kyc/s"},
		},
	}
	cases := []struct {
		name string
		edit func(*ApplyRequest)
	}{
		{"missing hub", func(r *ApplyRequest) { r.HubZone = " " }},
		{"missing address", func(r *ApplyRequest) { r.Address = "" }},
		{"missing city", func(r *ApplyRequest) { r.City = "" }},
		{"non-digit pincode", func(r *ApplyRequest) { r.Pincode = "50008x" }},
		{"invalid emergency", func(r *ApplyRequest) { r.EmergencyContact = "123" }},
	}
	for _, c := range cases {
		req := base
		c.edit(&req)
		if _, ok := validateApplication(&req); ok {
			t.Fatalf("%s must be rejected", c.name)
		}
	}
}

func TestValidRiderStatus(t *testing.T) {
	for _, status := range []string{
		StatusApplied, StatusPendingReview, StatusVerified, StatusActive,
		StatusSuspended, StatusBlacklisted, StatusRejected,
	} {
		if !validRiderStatus(status) {
			t.Fatalf("%s must be valid", status)
		}
	}
	if validRiderStatus("DELETED") {
		t.Fatal("unknown status must be invalid")
	}
}

// scriptedMatrix returns canned road seconds per leg and falls back to a linear distance so a
// missing leg still has deterministic, finite cost.
type scriptedMatrix struct {
	legs map[string]int64
}

func (m scriptedMatrix) Travel(fromLat, fromLng, toLat, toLng float64) (int64, int64) {
	key := fmt.Sprintf("%.2f,%.2f->%.2f,%.2f", fromLat, fromLng, toLat, toLng)
	if v, ok := m.legs[key]; ok {
		return v, v * 10
	}
	metres := math.Abs(toLat-fromLat)*111_000 + math.Abs(toLng-fromLng)*111_000
	return int64(math.Round(metres / 7)), int64(math.Round(metres))
}

func point(lat, lng float64) *float64 { return &lat }

// unitMatrix prices a leg as the sum of absolute coordinate deltas (one "second" per unit), which
// makes the route-optimality assertions below independent of the production Haversine fallback.
type unitMatrix struct{}

func (unitMatrix) Travel(fromLat, fromLng, toLat, toLng float64) (int64, int64) {
	seconds := int64(math.Abs(toLat-fromLat) + math.Abs(toLng-fromLng))
	return seconds, seconds
}

func TestPickRiderWithStopsPricesDetour(t *testing.T) {
	matrix := scriptedMatrix{legs: map[string]int64{
		"1.00,1.00->0.00,0.00": 10,
		"0.00,0.00->3.00,3.00": 10,
		"1.00,1.00->3.00,3.00": 5,
		"2.00,2.00->0.00,0.00": 20,
	}}
	candidates := []RiderLocation{
		{Rider: Rider{RiderID: "busy-close", MaxCapacity: 2, CurrentLoad: 1},
			ActiveStops: []Stop{{StopType: "DROP", Latitude: point(1, 1), Longitude: point(1, 1)}}},
		{Rider: Rider{RiderID: "idle-farther", MaxCapacity: 2}, Lat: 2, Lng: 2},
	}
	best := PickRiderWithStops(candidates, 0, 0, 3, 3, matrix)
	if best == nil || best.Rider.RiderID != "idle-farther" {
		t.Fatalf("expected the rider with no detour to win, got %+v", best)
	}
}

func TestOptimizeStopSequenceInsertsPickupBeforeDrop(t *testing.T) {
	matrix := scriptedMatrix{}
	existing := []Stop{
		{StopID: "a", Sequence: 1, StopType: "PICKUP", Status: StopPending, Latitude: point(0, 0), Longitude: point(0, 0)},
		{StopID: "b", Sequence: 2, StopType: "DROP", Status: StopPending, Latitude: point(10, 0), Longitude: point(10, 0)},
	}
	pickup := Stop{StopID: "p", StopType: "PICKUP", Status: StopPending, Latitude: point(4, 0), Longitude: point(4, 0)}
	drop := Stop{StopID: "d", StopType: "DROP", Status: StopPending, Latitude: point(6, 0), Longitude: point(6, 0)}
	got, err := OptimizeStopSequence(existing, pickup, drop, matrix)
	if err != nil {
		t.Fatalf("optimize failed: %v", err)
	}
	order := make([]string, len(got))
	for i, s := range got {
		order[i] = s.StopID
		if s.Sequence != i+1 {
			t.Fatalf("sequence not renumbered: %+v", got)
		}
	}
	if fmt.Sprint(order) != "[a p d b]" {
		t.Fatalf("expected pickup/drop inserted into the shortest leg, got %v", order)
	}
}

func TestOptimizeStopSequenceKeepsStartedStopsPinned(t *testing.T) {
	matrix := scriptedMatrix{}
	existing := []Stop{
		{StopID: "a", Sequence: 1, StopType: "PICKUP", Status: StopAtPickup, Latitude: point(0, 0), Longitude: point(0, 0)},
		{StopID: "b", Sequence: 2, StopType: "DROP", Status: StopPending, Latitude: point(10, 0), Longitude: point(10, 0)},
	}
	// Both new stops would be cheaper before `a`, but the rider has already arrived there.
	pickup := Stop{StopID: "p", StopType: "PICKUP", Status: StopPending, Latitude: point(-5, 0), Longitude: point(-5, 0)}
	drop := Stop{StopID: "d", StopType: "DROP", Status: StopPending, Latitude: point(-4, 0), Longitude: point(-4, 0)}
	got, err := OptimizeStopSequence(existing, pickup, drop, matrix)
	if err != nil {
		t.Fatalf("optimize failed: %v", err)
	}
	if got[0].StopID != "a" {
		t.Fatalf("started stop must stay first, got %v", got[0].StopID)
	}
	p, d := -1, -1
	for i, s := range got {
		if s.StopID == "p" {
			p = i
		}
		if s.StopID == "d" {
			d = i
		}
	}
	if p < 0 || d < 0 || p > d {
		t.Fatalf("pickup must precede drop, got pickup=%d drop=%d", p, d)
	}
}

func makeStop(id, orderID, stopType, status string, lat, lng float64) Stop {
	la, ln := lat, lng
	return Stop{
		StopID: id, DeliveryOrderID: orderID, StopType: stopType, Status: status,
		Latitude: &la, Longitude: &ln,
	}
}

func routeIDs(stops []Stop) []string {
	out := make([]string, len(stops))
	for i, s := range stops {
		out[i] = s.StopID
		if s.Sequence != i+1 {
			panic("sequences must be renumbered")
		}
	}
	return out
}

func TestOptimizeGlobalRouteReordersUnstartedAcrossOrders(t *testing.T) {
	// The current sequence visits order A first, but order B is much closer to the rider.
	existing := []Stop{
		makeStop("a-pick", "A", "PICKUP", StopPending, 40, 0),
		makeStop("a-drop", "A", "DROP", StopPending, 50, 0),
		makeStop("b-pick", "B", "PICKUP", StopPending, 5, 0),
		makeStop("b-drop", "B", "DROP", StopPending, 10, 0),
	}
	newPickup := makeStop("c-pick", "C", "PICKUP", StopPending, 20, 0)
	newDrop := makeStop("c-drop", "C", "DROP", StopPending, 25, 0)
	all := append(append(append([]Stop{}, existing...), newPickup), newDrop)

	got, err := OptimizeGlobalRoute(all, 0, 0, unitMatrix{})
	if err != nil {
		t.Fatalf("global optimize failed: %v", err)
	}
	want := []string{"b-pick", "b-drop", "c-pick", "c-drop", "a-pick", "a-drop"}
	if fmt.Sprint(routeIDs(got)) != fmt.Sprint(want) {
		t.Fatalf("global route = %v, want %v", routeIDs(got), want)
	}
	cost := int64(0)
	prevLat, prevLng := 0.0, 0.0
	for _, s := range got {
		leg, _ := unitMatrix{}.Travel(prevLat, prevLng, *s.Latitude, *s.Longitude)
		cost += leg
		prevLat, prevLng = *s.Latitude, *s.Longitude
	}
	if cost != 50 {
		t.Fatalf("expected the minimum 50s route, got %ds", cost)
	}
}

func TestOptimizeGlobalRouteKeepsStartedPrefixPinned(t *testing.T) {
	existing := []Stop{
		makeStop("a-pick", "A", "PICKUP", StopAtPickup, 5, 0),
		makeStop("a-drop", "A", "DROP", StopPending, 20, 0),
		makeStop("b-pick", "B", "PICKUP", StopPending, 10, 0),
		makeStop("b-drop", "B", "DROP", StopPending, 30, 0),
	}
	newPickup := makeStop("c-pick", "C", "PICKUP", StopPending, 1, 0)
	newDrop := makeStop("c-drop", "C", "DROP", StopPending, 2, 0)
	all := append(append(append([]Stop{}, existing...), newPickup), newDrop)

	got, err := OptimizeGlobalRoute(all, 0, 0, unitMatrix{})
	if err != nil {
		t.Fatalf("global optimize failed: %v", err)
	}
	if got[0].StopID != "a-pick" {
		t.Fatalf("started stop must stay pinned first, got %v", routeIDs(got))
	}
	want := []string{"a-pick", "c-pick", "c-drop", "b-pick", "a-drop", "b-drop"}
	if fmt.Sprint(routeIDs(got)) != fmt.Sprint(want) {
		t.Fatalf("global route = %v, want %v", routeIDs(got), want)
	}
}

func TestOptimizeGlobalRouteHonoursPickupBeforeDrop(t *testing.T) {
	stops := []Stop{
		makeStop("a-pick", "A", "PICKUP", StopPending, 30, 0),
		makeStop("a-drop", "A", "DROP", StopPending, 5, 0),
		makeStop("b-pick", "B", "PICKUP", StopPending, 10, 0),
		makeStop("b-drop", "B", "DROP", StopPending, 20, 0),
	}
	got, err := OptimizeGlobalRoute(stops, 0, 0, unitMatrix{})
	if err != nil {
		t.Fatalf("global optimize failed: %v", err)
	}
	pos := map[string]int{}
	for i, s := range got {
		pos[s.StopID] = i
	}
	for _, orderID := range []string{"A", "B"} {
		if pos[orderID+"-pick"] > pos[orderID+"-drop"] {
			t.Fatalf("order %s drop visited before pickup: %v", orderID, routeIDs(got))
		}
	}
}

func TestOptimizeGlobalRouteTrivialAndOversize(t *testing.T) {
	if got, err := OptimizeGlobalRoute(nil, 0, 0, nil); err != nil || got != nil {
		t.Fatalf("empty route = (%v, %v)", got, err)
	}
	one := []Stop{makeStop("only", "A", "PICKUP", StopPending, 1, 1)}
	got, err := OptimizeGlobalRoute(one, 0, 0, nil)
	if err != nil || len(got) != 1 || got[0].Sequence != 1 {
		t.Fatalf("single stop route = (%v, %v)", got, err)
	}
	many := make([]Stop, maxGlobalRouteStops+1)
	for i := range many {
		many[i] = makeStop(fmt.Sprintf("s%d", i), fmt.Sprintf("O%d", i), "PICKUP", StopPending,
			float64(i+1), 0)
	}
	if _, err := OptimizeGlobalRoute(many, 0, 0, nil); err == nil {
		t.Fatal("oversize route must request the insertion fallback")
	}
}

func TestOptimizeGlobalRouteHandlesCapacityLoad(t *testing.T) {
	// Six orders (12 stops): above the five-order four-wheeler cap but still under the solver
	// guard, exercising the largest route an MVP rider could accumulate. Every drop must follow
	// its pickup and the sequence must be dense.
	stops := make([]Stop, 0, 24)
	for order := 0; order < 6; order++ {
		id := fmt.Sprintf("O%d", order)
		base := float64(order * 2)
		stops = append(stops,
			makeStop(id+"-pick", id, "PICKUP", StopPending, base, 0),
			makeStop(id+"-drop", id, "DROP", StopPending, base+1, 0))
	}
	got, err := OptimizeGlobalRoute(stops, 0, 0, unitMatrix{})
	if err != nil {
		t.Fatalf("12-stop route failed: %v", err)
	}
	if len(got) != len(stops) {
		t.Fatalf("route lost stops: got %d want %d", len(got), len(stops))
	}
	pos := make(map[string]int, len(got))
	for i, s := range got {
		if s.Sequence != i+1 {
			t.Fatalf("sequence not dense: %+v", got)
		}
		pos[s.StopID] = i
	}
	for order := 0; order < 6; order++ {
		id := fmt.Sprintf("O%d", order)
		if pos[id+"-pick"] > pos[id+"-drop"] {
			t.Fatalf("order %s drop before pickup: %v", id, routeIDs(got))
		}
	}
}

func TestEncodePolyline(t *testing.T) {
	stops := []Stop{
		{Latitude: point(38.5, 0), Longitude: point(-120.2, 0)},
		{Latitude: point(40.7, 0), Longitude: point(-120.95, 0)},
		{Latitude: point(43.252, 0), Longitude: point(-126.453, 0)},
	}
	if got, want := EncodePolyline(stops), "_p~iF~ps|U_ulLnnqC_mqNvxq`@"; got != want {
		t.Fatalf("polyline = %q, want %q", got, want)
	}
}
