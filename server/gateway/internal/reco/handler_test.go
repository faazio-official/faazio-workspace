package reco

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
	NewHandler(New(nil), NewService(New(nil), nil, nil)).Register(r) // nil Mongo: valid input reaches the repo and fails 500
	return r
}

func TestTrackValidatesInput(t *testing.T) {
	cases := []struct {
		name string
		body string
		want int
	}{
		{"missing productId", `{"event":"view"}`, http.StatusBadRequest},
		{"overlong productId", `{"productId":"` + strings.Repeat("x", 65) + `","event":"view"}`, http.StatusBadRequest},
		{"unsupported event", `{"productId":"md-1","event":"hack"}`, http.StatusBadRequest},
		{"valid input hits repo", `{"productId":"md-1","event":"cart_add"}`, http.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/events", strings.NewReader(tc.body))
			newTestRouter().ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.want, rec.Body.String())
			}
		})
	}
}