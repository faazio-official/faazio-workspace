package sellers

import (
	"strings"
	"testing"
)

// TestIsStorageKey covers the private-R2-key gate: URLs, inline data and oversized keys are rejected.
func TestIsStorageKey(t *testing.T) {
	for _, k := range []string{"kyc/x/y.jpg", "a/b", "passbook.jpg"} {
		if !isStorageKey(k) {
			t.Errorf("isStorageKey(%q) = false, want true", k)
		}
	}
	invalid := []string{
		"", "   ", "http://x/y", "https://x/y", "data:image/png;base64,AA", "mock://x/y",
		strings.Repeat("a", 513),
	}
	for _, k := range invalid {
		if isStorageKey(k) {
			t.Errorf("isStorageKey(%q) = true, want false", k)
		}
	}
}

// TestValidLatLng covers the coordinate pair rule: absent is fine, a half-pair or out-of-range is not.
func TestValidLatLng(t *testing.T) {
	f := func(v float64) *float64 { return &v }
	if !validLatLng(nil, nil) {
		t.Fatal("absent pair must be valid")
	}
	if validLatLng(f(1), nil) || validLatLng(nil, f(1)) {
		t.Fatal("half pair must be invalid")
	}
	if !validLatLng(f(-90), f(180)) || !validLatLng(f(90), f(-180)) {
		t.Fatal("boundary pair must be valid")
	}
	if validLatLng(f(91), f(0)) || validLatLng(f(0), f(181)) {
		t.Fatal("out-of-range pair must be invalid")
	}
}

// TestValidSellerStatus covers the moderation status allowlist.
func TestValidSellerStatus(t *testing.T) {
	for _, s := range []string{"PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"} {
		if !validSellerStatus(s) {
			t.Errorf("validSellerStatus(%q) = false, want true", s)
		}
	}
	for _, s := range []string{"", "pending", "DELETED"} {
		if validSellerStatus(s) {
			t.Errorf("validSellerStatus(%q) = true, want false", s)
		}
	}
}

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

// TestRedactSellerAndHistory proves the audit projection drops PII (contact phone/email) while
// keeping non-PII fields and never mutating its input.
func TestRedactSellerAndHistory(t *testing.T) {
	s := redactSeller(Seller{ContactPhone: "+919000000001", ContactEmail: "a@b.com", BusinessName: "X"})
	if s.ContactPhone != "" || s.ContactEmail != "" {
		t.Fatalf("redactSeller left PII: %+v", s)
	}
	if s.BusinessName != "X" {
		t.Fatalf("redactSeller dropped a non-PII field: %+v", s)
	}

	in := []RequestHistoryEntry{
		{FieldName: "contactPhone", OldValue: "+91", NewValue: "+92"},
		{FieldName: "contactEmail", OldValue: "a", NewValue: "b"},
		{FieldName: "ownerName", OldValue: "p", NewValue: "q"},
	}
	out := redactHistory(in)
	if out[0].OldValue != "" || out[0].NewValue != "" || out[1].OldValue != "" || out[1].NewValue != "" {
		t.Fatalf("redactHistory left PII: %+v", out)
	}
	if out[2].OldValue != "p" || out[2].NewValue != "q" {
		t.Fatalf("redactHistory dropped a non-PII field: %+v", out[2])
	}
	if in[0].OldValue != "+91" {
		t.Fatal("redactHistory must not mutate its input slice")
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
