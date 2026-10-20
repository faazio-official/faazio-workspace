package admins

import "testing"

func TestValidStatesSet(t *testing.T) {
	if got := len(ValidStates); got != 36 {
		t.Fatalf("expected exactly 36 ISO state/UT codes, got %d", got)
	}
}

func TestIsValidState(t *testing.T) {
	valid := []string{
		"MH", "DL", "KA", "KL", "TN", "GJ", // original six
		"UP", "WB", "BR", "RJ", "TG", "PB", // high-population states
		"CT", "OR", "UT", // ISO contested codes (not CG/OD/UK)
		"LA", "DH", "AN", "CH", "LD", "PY", // union territories
	}
	for _, code := range valid {
		if !IsValidState(code) {
			t.Errorf("expected %q to be a valid state code", code)
		}
	}
	invalid := []string{
		"XX", "ZZ", "AB", "", "M",
		"CG", "TS", "UK", "OD", "DN", "DD", // popular aliases — rejected on purpose
		"mh", "MH ", " mh", // lowercase / whitespace need NormaliseStateCode first
	}
	for _, code := range invalid {
		if IsValidState(code) {
			t.Errorf("expected %q to be rejected by IsValidState", code)
		}
	}
}

func TestNormaliseStateCode(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"MH", "MH"},
		{" mh ", "MH"},
		{"up", "UP"},
		{" wb", "WB"},
		{"", ""},
	} {
		if got := NormaliseStateCode(tc.in); got != tc.want {
			t.Errorf("NormaliseStateCode(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
	if got := NormaliseStateCode(" la "); got != "LA" || !IsValidState(got) {
		t.Errorf("normalised lowercase ' la ' should be valid LA, got %q", got)
	}
}