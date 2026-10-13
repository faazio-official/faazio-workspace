// Package httpx holds small HTTP/JSON helpers. Errors never leak system paths or
// internals — only a stable code + safe message (AGENTS.md security).
package httpx

import (
	"encoding/json"
	"net/http"
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
