// Package locale holds the small input rules for the translated (non-English) copy the portal
// authors. Kept server-side so a direct API call cannot store Latin text in a Tamil column — the
// portal also validates, but the gateway is the authority.
package locale

import "strings"

// IsTamilText reports whether s contains only Tamil-script characters, whitespace, digits and
// light punctuation. An empty string is valid: "not translated yet" falls back to English on read.
// Latin letters (and every other script) are rejected.
func IsTamilText(s string) bool {
	for _, r := range s {
		switch {
		case r >= '\u0B80' && r <= '\u0BFF': // Tamil block
		case r == ' ' || r == '\t' || r == '\n' || r == '\r':
		case r >= '0' && r <= '9':
		case strings.ContainsRune(".,-–—/()&%!?'\"+:;", r):
		default:
			return false
		}
	}
	return true
}
