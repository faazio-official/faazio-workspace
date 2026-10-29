package admins

import "strings"

// Input helpers for the unified district-admin creator. They mirror the portal auth rules
// (internal/portal) so the boundary rule (monolith-breakdown.md §2 — admins never imports a
// sibling context) is kept: the two copies are tiny and stable.

const (
	maxEmailLen       = 254
	maxPasswordLen    = 128
	minNewPasswordLen = 12
	minPhoneDigits    = 10
)

// validEmail reports whether an address is plausibly well-formed (same rule as portal.validEmail).
func validEmail(email string) bool {
	if len(email) < 3 || len(email) > maxEmailLen || strings.ContainsAny(email, " \t\r\n") {
		return false
	}
	at := strings.LastIndexByte(email, '@')
	if at <= 0 || at == len(email)-1 {
		return false
	}
	domain := email[at+1:]
	return strings.Contains(domain, ".") && !strings.HasPrefix(domain, ".") && !strings.HasSuffix(domain, ".")
}

var commonPasswords = map[string]struct{}{
	"password":      {},
	"password123":   {},
	"qwertyuiop":    {},
	"123456789012":  {},
	"administrator": {},
	"letmein12345":  {},
}

// weakPassword rejects the shared initial password and obvious dictionary values.
func weakPassword(newPassword string) bool {
	_, bad := commonPasswords[strings.ToLower(newPassword)]
	return bad
}

// NormalisePhone reduces a client-supplied phone to its bare 10 Indian digits and reports whether it
// is strict: '091-90000 00000', '+91 9000000000', '9000000000' all collapse to '9000000000', and any
// other shape (missing digits, landline, extra prefix) is rejected. The creator stores the digits.
func NormalisePhone(raw string) (string, bool) {
	digits := ""
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			digits += string(r)
		}
	}
	switch {
	case len(digits) == 13 && strings.HasPrefix(digits, "091"):
		digits = digits[3:] // 0 + 91 + 10 local digits
	case len(digits) == 12 && strings.HasPrefix(digits, "91"):
		digits = digits[2:] // +91 + 10 local digits
	case len(digits) == 11 && strings.HasPrefix(digits, "0"):
		digits = digits[1:] // leading national 0 + 10 local digits
	}
	if len(digits) != minPhoneDigits {
		return "", false
	}
	return digits, true
}