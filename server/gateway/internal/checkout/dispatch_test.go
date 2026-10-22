package checkout

import (
	"math"
	"testing"
)

func TestDeliveryCoordinateValidation(t *testing.T) {
	if !validLatitude(17.385) || !validLongitude(78.4867) {
		t.Fatal("valid Hyderabad coordinates must pass")
	}
	if validLatitude(90.1) || validLatitude(-90.1) || validLatitude(math.NaN()) {
		t.Fatal("invalid latitude must be rejected")
	}
	if validLongitude(180.1) || validLongitude(-180.1) || validLongitude(math.Inf(1)) {
		t.Fatal("invalid longitude must be rejected")
	}
}
