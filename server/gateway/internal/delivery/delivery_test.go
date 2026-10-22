package delivery

import (
	"errors"
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
