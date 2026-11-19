package locale

import "testing"

func TestIsTamilText(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want bool
	}{
		{"empty is allowed", "", true},
		{"tamil word", "தமிழ்", true},
		{"tamil phrase with space", "பால் பொடி 500 கிராம்", true},
		{"tamil with digits and punctuation", "சோப்பு (100) - 5%", true},
		{"latin unit rejected in tamil text", "சோப்பு 100g", false},
		{"latin rejected", "Milk", false},
		{"mixed rejected", "பால் Milk", false},
		{"devanagari rejected", "हिंदी", false},
		{"whitespace only", "   ", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsTamilText(tc.in); got != tc.want {
				t.Fatalf("IsTamilText(%q) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}
