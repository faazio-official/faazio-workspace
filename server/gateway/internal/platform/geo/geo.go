// Package geo is the gateway's authoritative district master for the production coverage area
// (Tamil Nadu + Puducherry). It mirrors admins.district_master (migration 0046) and the portal /
// mobile fixtures. Platform code only — every context may import it.
package geo

import "strings"

// District is one admins.district_master row.
type District struct {
	Code      string
	Name      string
	StateCode string
}

// Districts is the ordered district master (TN then PY, sorted by name within each state).
var Districts = []District{
	{Code: "TNA", Name: "Ariyalur", StateCode: "TN"},
	{Code: "TNC", Name: "Chengalpattu", StateCode: "TN"},
	{Code: "TCH", Name: "Chennai", StateCode: "TN"},
	{Code: "TCO", Name: "Coimbatore", StateCode: "TN"},
	{Code: "TCD", Name: "Cuddalore", StateCode: "TN"},
	{Code: "TDP", Name: "Dharmapuri", StateCode: "TN"},
	{Code: "TDG", Name: "Dindigul", StateCode: "TN"},
	{Code: "TER", Name: "Erode", StateCode: "TN"},
	{Code: "TKL", Name: "Kallakurichi", StateCode: "TN"},
	{Code: "TKP", Name: "Kanchipuram", StateCode: "TN"},
	{Code: "TKK", Name: "Kanyakumari", StateCode: "TN"},
	{Code: "TKR", Name: "Karur", StateCode: "TN"},
	{Code: "TKG", Name: "Krishnagiri", StateCode: "TN"},
	{Code: "TMD", Name: "Madurai", StateCode: "TN"},
	{Code: "TMY", Name: "Mayiladuthurai", StateCode: "TN"},
	{Code: "TNP", Name: "Nagapattinam", StateCode: "TN"},
	{Code: "TNK", Name: "Namakkal", StateCode: "TN"},
	{Code: "TNG", Name: "Nilgiris", StateCode: "TN"},
	{Code: "TPE", Name: "Perambalur", StateCode: "TN"},
	{Code: "TPK", Name: "Pudukkottai", StateCode: "TN"},
	{Code: "TRT", Name: "Ramanathapuram", StateCode: "TN"},
	{Code: "TRN", Name: "Ranipet", StateCode: "TN"},
	{Code: "TSL", Name: "Salem", StateCode: "TN"},
	{Code: "TSK", Name: "Sivaganga", StateCode: "TN"},
	{Code: "TTK", Name: "Tenkasi", StateCode: "TN"},
	{Code: "TTH", Name: "Thanjavur", StateCode: "TN"},
	{Code: "TTE", Name: "Theni", StateCode: "TN"},
	{Code: "TTT", Name: "Thoothukudi", StateCode: "TN"},
	{Code: "TTC", Name: "Tiruchirappalli", StateCode: "TN"},
	{Code: "TTL", Name: "Tirunelveli", StateCode: "TN"},
	{Code: "TTP", Name: "Tirupathur", StateCode: "TN"},
	{Code: "TPP", Name: "Tiruppur", StateCode: "TN"},
	{Code: "TLV", Name: "Tiruvallur", StateCode: "TN"},
	{Code: "TVA", Name: "Tiruvannamalai", StateCode: "TN"},
	{Code: "TVR", Name: "Tiruvarur", StateCode: "TN"},
	{Code: "VEL", Name: "Vellore", StateCode: "TN"},
	{Code: "VLP", Name: "Villupuram", StateCode: "TN"},
	{Code: "VIR", Name: "Virudhunagar", StateCode: "TN"},
	{Code: "PY0", Name: "Puducherry", StateCode: "PY"},
	{Code: "PY1", Name: "Karaikal", StateCode: "PY"},
	{Code: "PY2", Name: "Mahé", StateCode: "PY"},
	{Code: "PY3", Name: "Yanam", StateCode: "PY"},
}

var (
	byCode = make(map[string]District, len(Districts))
	states = make(map[string]bool)
)

func init() {
	for _, d := range Districts {
		byCode[d.Code] = d
		states[d.StateCode] = true
	}
}

// Normalise upper-cases and trims a client-supplied district code.
func Normalise(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// IsValid reports whether code is a known district code (exact, uppercase).
func IsValid(code string) bool {
	_, ok := byCode[code]
	return ok
}

// StateForDistrict returns the parent ISO state/UT code for a district, or "".
func StateForDistrict(code string) string {
	return byCode[Normalise(code)].StateCode
}

// Name returns the display name for a district code, or "".
func Name(code string) string {
	return byCode[Normalise(code)].Name
}

// InCoverageState reports whether a state has district coverage in production.
func InCoverageState(stateCode string) bool {
	return states[Normalise(stateCode)]
}

// ForState returns the districts of one state (empty when the state has no coverage).
func ForState(stateCode string) []District {
	stateCode = Normalise(stateCode)
	out := []District{}
	for _, d := range Districts {
		if d.StateCode == stateCode {
			out = append(out, d)
		}
	}
	return out
}
