package errorsink

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/go-chi/chi/v5"
)

func newTestRouter() http.Handler {
	r := chi.NewRouter()
	r.Use(auth.Middleware(auth.Config{Disabled: true, DevUserID: "user-1"}))
	New(nil).Register(r) // nil pool: valid reports pass validation + log only
	return r
}

func TestReportValidatesInput(t *testing.T) {
	cases := []struct {
		name string
		body string
		want int
	}{
		{"empty body", "", http.StatusBadRequest},
		{"missing message", `{"appVariant":"customer"}`, http.StatusBadRequest},
		{"blank message", `{"message":"   "}`, http.StatusBadRequest},
		{"valid report", `{"appVariant":"customer","message":"boom","stack":"at X (file.js:1)"}`, http.StatusAccepted},
		{"unknown variant normalized", `{"appVariant":"hacker","message":"boom"}`, http.StatusAccepted},
		{"overlong message truncated", `{"message":"` + strings.Repeat("x", maxMessageLen+50) + `"}`, http.StatusAccepted},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/errors", strings.NewReader(tc.body))
			if tc.body == "" {
				req.Body = http.NoBody
			}
			newTestRouter().ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.want, rec.Body.String())
			}
		})
	}
}