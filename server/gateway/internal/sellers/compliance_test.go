package sellers

import (
	"context"
	"net/http/httptest"
	"testing"
)

func TestGSTINChecksum(t *testing.T) {
	tests := []struct {
		gstin string
		want  bool
	}{
		{"27AAPFU0939F1ZV", true},
		{"27AAPFU0939F1ZX", false},
		{"27AAPFU0939F1Z", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := validGSTINChecksum(tt.gstin); got != tt.want {
			t.Errorf("validGSTINChecksum(%q) = %v, want %v", tt.gstin, got, tt.want)
		}
	}
}

func TestFormatComplianceValidator(t *testing.T) {
	in := ComplianceInput{
		Seller: Seller{PAN: "ABCDE1234F", GSTIN: "27AAPFU0939F1ZV"},
		Bank:   &BankAccount{IFSC: "HDFC0001234", AccountNumberMasked: "••••1234"},
		Vendors: []VendorSeed{
			{App: "FOOD", FSSAINumber: "12345678901234"},
			{App: "MART"},
		},
	}
	report := FormatComplianceValidator{}.Validate(context.Background(), in)
	if report.Status != CompliancePending {
		t.Fatalf("status = %q, want PENDING", report.Status)
	}
	if len(report.Checks) != 4 { // PAN + GSTIN + BANK + one food FSSAI
		t.Fatalf("checks = %d, want 4", len(report.Checks))
	}
	for _, c := range report.Checks {
		if c.Status != CompliancePending {
			t.Errorf("%s status = %q, want PENDING", c.CheckType, c.Status)
		}
		if c.SubjectMasked == "" && c.CheckType != "FSSAI" {
			t.Errorf("%s subject was not masked", c.CheckType)
		}
	}
}

func TestFormatComplianceValidatorFailsBadIdentifiers(t *testing.T) {
	in := ComplianceInput{
		Seller: Seller{PAN: "bad-pan", GSTIN: "27AAPFU0939F1ZX"},
		Bank:   &BankAccount{IFSC: "HDFC123", AccountNumberMasked: "••••1234"},
		Vendors: []VendorSeed{
			{App: "FOOD", FSSAINumber: "123"},
		},
	}
	report := FormatComplianceValidator{}.Validate(context.Background(), in)
	if report.Status != ComplianceFailed {
		t.Fatalf("status = %q, want FAILED", report.Status)
	}
}

func TestClientIPPrefersCloudflare(t *testing.T) {
	r := httptest.NewRequest("POST", "/sellers", nil)
	r.Header.Set("CF-Connecting-IP", "203.0.113.9")
	r.Header.Set("X-Forwarded-For", "198.51.100.4")
	if got := clientIP(r); got != "203.0.113.9" {
		t.Errorf("clientIP = %q, want CF-Connecting-IP", got)
	}

	r2 := httptest.NewRequest("POST", "/sellers", nil)
	r2.Header.Set("X-Forwarded-For", "198.51.100.4, 10.0.0.1")
	if got := clientIP(r2); got != "198.51.100.4" {
		t.Errorf("clientIP = %q, want first X-Forwarded-For", got)
	}
}
