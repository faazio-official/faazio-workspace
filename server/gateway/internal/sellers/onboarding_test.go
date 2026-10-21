package sellers

import "testing"

func TestValidPlatformFee(t *testing.T) {
	cases := []struct {
		category string
		pct      int
		want     bool
	}{
		{"MART", 1, true}, {"MART", 100, true}, {"MART", 0, false}, {"MART", 101, false},
		{"PHARMA", 3, true}, {"FOOD", 4, false}, {"FOOD", 5, true}, {"FOOD", 100, true},
	}
	for _, tc := range cases {
		if got := validPlatformFee(tc.category, tc.pct); got != tc.want {
			t.Errorf("validPlatformFee(%s, %d) = %v, want %v", tc.category, tc.pct, got, tc.want)
		}
	}
}

func TestMaskAccount(t *testing.T) {
	got, ok := maskAccount("1234 5678 9012")
	if !ok || got != "******9012" {
		t.Fatalf("maskAccount = %q ok=%v", got, ok)
	}
	if _, ok := maskAccount("12345"); ok {
		t.Fatal("too-short account must be rejected")
	}
	if _, ok := maskAccount("123456789012345678901"); ok {
		t.Fatal("too-long account must be rejected")
	}
}
