package admins

import (
	"strings"

	"github.com/faazio/server/gateway/internal/platform/geo"
)

// ValidStates is the gateway's authoritative allowlist of ISO 3166-2:IN state/UT codes
// (28 States + 8 Union Territories). It mirrors the frontend STATES master
// (client/web/platform/src/data/states.ts) and the future ops.states seed (0035 — Phase 2;
// no FK yet). Contested codes are rejected here, never aliased: CT not CG, OR not OD, TG not
// TS, UT not UK, DH not DN/DD. The district-admin creator is now district-mandatory (it never
// accepts state-only scope), so this allowlist is retained for state-scoped reads and tests.
var ValidStates = map[string]bool{
	"AN": true, "AP": true, "AR": true, "AS": true, "BR": true, "CH": true,
	"CT": true, "DH": true, "DL": true, "GA": true, "GJ": true, "HP": true,
	"HR": true, "JH": true, "JK": true, "KA": true, "KL": true, "LA": true,
	"LD": true, "MH": true, "ML": true, "MN": true, "MP": true, "MZ": true,
	"NL": true, "OR": true, "PB": true, "PY": true, "RJ": true, "SK": true,
	"TG": true, "TN": true, "TR": true, "UP": true, "UT": true, "WB": true,
}

// IsValidState reports whether code is a known ISO 3166-2:IN state/UT code (exact, uppercase).
func IsValidState(code string) bool {
	return ValidStates[code]
}

// NormaliseStateCode upper-cases and trims a client-supplied code before the allowlist check.
func NormaliseStateCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// IsValidDistrict reports whether code is a known production district code (exact, uppercase).
func IsValidDistrict(code string) bool { return geo.IsValid(code) }

// NormaliseDistrictCode upper-cases and trims a client-supplied district code.
func NormaliseDistrictCode(code string) string { return geo.Normalise(code) }

// StateForDistrict returns the parent state/UT code for a district, or "".
func StateForDistrict(code string) string { return geo.StateForDistrict(code) }

// DistrictName returns the display name for a district code, or "".
func DistrictName(code string) string { return geo.Name(code) }
