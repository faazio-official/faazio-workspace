// Package httpx holds small HTTP/JSON helpers. Errors never leak system paths or
// internals — only a stable code + safe message (AGENTS.md security).
package httpx

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

// Error is the JSON error envelope.
type Error struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

// JSON writes v as JSON with the given status.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(v)
}

// Fail writes a JSON error with a safe message.
func Fail(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, Error{Error: message, Code: code})
}

// Decode reads a JSON request body into dst (bounded by the server's MaxBytesReader).
func Decode(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

// DefaultMaxBodyBytes bounds every request body (body-DoS guard). The largest legitimate
// body is POST /products/batch (≤200 ids) so 1 MiB is generous.
const DefaultMaxBodyBytes int64 = 1 << 20

// MaxBytes wraps r.Body with http.MaxBytesReader so oversized bodies fail fast with
// 413 instead of being buffered. Applied globally in the composition root.
func MaxBytes(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// LimitParam reads a bounded `limit` query param. Falls back to def and never exceeds max
// (protects the origin from full-table scans as the seed grows).
func LimitParam(r *http.Request, def, max int) int {
	raw := strings.TrimSpace(r.URL.Query().Get("limit"))
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

// EncodeCursor packs a keyset sort key into an opaque URL-safe string.
func EncodeCursor(parts ...string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strings.Join(parts, "\x1f")))
}

// DecodeCursor unpacks an opaque cursor into exactly n parts. ok=false on any malformation.
func DecodeCursor(token string, n int) ([]string, bool) {
	if token == "" {
		return nil, false
	}
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, false
	}
	parts := strings.Split(string(raw), "\x1f")
	if len(parts) != n {
		return nil, false
	}
	return parts, true
}

// SetNextCursor advertises the cursor for the next page (header keeps the array body shape).
func SetNextCursor(w http.ResponseWriter, cursor string) {
	if cursor != "" {
		w.Header().Set("X-Next-Cursor", cursor)
	}
}
