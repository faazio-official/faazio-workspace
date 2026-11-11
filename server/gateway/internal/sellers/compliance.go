package sellers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net"
	"net/http"
	"regexp"
	"strings"
)

// Compliance status values persisted on sellers.sellers.compliance_status (migration 0100).
const (
	CompliancePending   = "PENDING"
	ComplianceValidated = "VALIDATED"
	ComplianceFailed    = "FAILED"
)

// ComplianceCheck is one append-only validation attempt recorded in
// sellers.compliance_validations. The full identifier is never stored: SubjectMasked keeps the tail.
type ComplianceCheck struct {
	CheckType     string `json:"checkType"`
	SubjectMasked string `json:"subjectMasked"`
	Status        string `json:"status"`
	Source        string `json:"source"`
	Reason        string `json:"reason"`
}

// ComplianceReport is the aggregate result written to sellers.sellers alongside the checks.
type ComplianceReport struct {
	Status string            `json:"status"`
	Note   string            `json:"note"`
	Checks []ComplianceCheck `json:"checks"`
}

// ComplianceInput is everything an adapter needs to validate one application.
type ComplianceInput struct {
	Seller  Seller
	Bank    *BankAccount
	Vendors []VendorSeed
}

// ComplianceValidator is the swappable server-side integration point for government/third-party
// verification (GSTIN, PAN, FSSAI, bank). The default adapter runs format/checksum checks only and
// leaves the account PENDING; wire a real provider with Handler.WithCompliance.
type ComplianceValidator interface {
	Validate(ctx context.Context, in ComplianceInput) ComplianceReport
}

// FormatComplianceValidator validates shape and the GSTIN checksum locally. It never marks an
// account VALIDATED: passing format checks still needs a government/provider lookup, so those
// checks stay PENDING. A malformed identifier is FAILED (and blocks activation) because no provider
// lookup could succeed.
type FormatComplianceValidator struct{}

var (
	panPattern   = regexp.MustCompile(`^[A-Z]{5}[0-9]{4}[A-Z]$`)
	ifscPattern  = regexp.MustCompile(`^[A-Z]{4}0[A-Z0-9]{6}$`)
	fssaiPattern = regexp.MustCompile(`^[0-9]{14}$`)
)

const gstinAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

func (FormatComplianceValidator) Validate(_ context.Context, in ComplianceInput) ComplianceReport {
	checks := make([]ComplianceCheck, 0, 4)

	pan := strings.ToUpper(strings.TrimSpace(in.Seller.PAN))
	if pan == "" {
		checks = append(checks, ComplianceCheck{
			CheckType: "PAN", Status: ComplianceFailed, Source: "format",
			Reason: "PAN is required",
		})
	} else if panPattern.MatchString(pan) {
		checks = append(checks, pending("PAN", maskTail(pan, 2), "format checks passed; provider lookup not linked"))
	} else {
		checks = append(checks, ComplianceCheck{
			CheckType: "PAN", SubjectMasked: maskTail(pan, 2), Status: ComplianceFailed, Source: "format",
			Reason: "PAN does not match the 10-character format",
		})
	}

	gstin := strings.ToUpper(strings.TrimSpace(in.Seller.GSTIN))
	if gstin != "" {
		switch {
		case len(gstin) != 15 || !validGSTINChecksum(gstin):
			checks = append(checks, ComplianceCheck{
				CheckType: "GSTIN", SubjectMasked: maskTail(gstin, 3), Status: ComplianceFailed, Source: "format",
				Reason: "GSTIN length or checksum is invalid",
			})
		default:
			checks = append(checks, pending("GSTIN", maskTail(gstin, 3), "format checks passed; provider lookup not linked"))
		}
	}

	if in.Bank != nil {
		ifsc := strings.ToUpper(strings.TrimSpace(in.Bank.IFSC))
		if ifscPattern.MatchString(ifsc) {
			checks = append(checks, pending("BANK", in.Bank.AccountNumberMasked, "format checks passed; provider lookup not linked"))
		} else {
			checks = append(checks, ComplianceCheck{
				CheckType: "BANK", SubjectMasked: in.Bank.AccountNumberMasked, Status: ComplianceFailed, Source: "format",
				Reason: "IFSC format is invalid",
			})
		}
	}

	for _, v := range in.Vendors {
		if v.App != "FOOD" {
			continue
		}
		fssai := strings.TrimSpace(v.FSSAINumber)
		switch {
		case fssai == "":
			checks = append(checks, pending("FSSAI", "", "FSSAI not provided for a food shop"))
		case fssaiPattern.MatchString(fssai):
			checks = append(checks, pending("FSSAI", maskTail(fssai, 4), "format checks passed; provider lookup not linked"))
		default:
			checks = append(checks, ComplianceCheck{
				CheckType: "FSSAI", SubjectMasked: maskTail(fssai, 4), Status: ComplianceFailed, Source: "format",
				Reason: "FSSAI must be 14 digits",
			})
		}
	}

	status := CompliancePending
	note := "Format checks passed; government validation is not linked yet."
	for _, c := range checks {
		if c.Status == ComplianceFailed {
			status = ComplianceFailed
			note = c.CheckType + ": " + c.Reason
			break
		}
	}
	return ComplianceReport{Status: status, Note: note, Checks: checks}
}

func pending(check, subject, reason string) ComplianceCheck {
	return ComplianceCheck{
		CheckType: check, SubjectMasked: subject, Status: CompliancePending, Source: "format", Reason: reason,
	}
}

// maskTail keeps only the last n characters of an identifier for the validation log.
func maskTail(v string, n int) string {
	v = strings.TrimSpace(v)
	if len(v) <= n {
		return v
	}
	return strings.Repeat("•", len(v)-n) + v[len(v)-n:]
}

// validGSTINChecksum implements the GSTIN mod-36 check digit over the first 14 characters.
func validGSTINChecksum(g string) bool {
	if len(g) != 15 {
		return false
	}
	sum := 0
	for i := 0; i < 14; i++ {
		v := strings.IndexByte(gstinAlphabet, g[i])
		if v < 0 {
			return false
		}
		factor := 1
		if i%2 == 1 {
			factor = 2
		}
		product := v * factor
		sum += product/36 + product%36
	}
	check := (36 - sum%36) % 36
	return g[14] == gstinAlphabet[check]
}

// clientIP resolves the end-client address behind the Cloudflare/Render chain, mirroring
// internal/portal. Both headers are proxy-written at the edge; the raw RemoteAddr would otherwise
// record the proxy.
func clientIP(r *http.Request) string {
	if ip := firstIP(r.Header.Get("CF-Connecting-IP")); ip != "" {
		return ip
	}
	if ip := firstIP(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); ip != "" {
		return ip
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

// shortHash returns a stable 64-bit hex prefix for an IP address (never the plaintext address).
func shortHash(v string) string {
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:8])
}

func firstIP(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(value)
	if err == nil {
		value = host
	}
	if net.ParseIP(value) == nil {
		return ""
	}
	return value
}
