package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLimitParam(t *testing.T) {
	cases := []struct {
		name       string
		query      string
		def, max   int
		want       int
	}{
		{"absent uses default", "", 40, 100, 40},
		{"valid passthrough", "limit=25", 40, 100, 25},
		{"zero falls back", "limit=0", 40, 100, 40},
		{"negative falls back", "limit=-3", 40, 100, 40},
		{"garbage falls back", "limit=abc", 40, 100, 40},
		{"over max clamps", "limit=9999", 40, 100, 100},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			if got := LimitParam(r, tc.def, tc.max); got != tc.want {
				t.Fatalf("LimitParam = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestCursorRoundTrip(t *testing.T) {
	token := EncodeCursor("4.5", "store-m3")
	parts, ok := DecodeCursor(token, 2)
	if !ok {
		t.Fatalf("DecodeCursor(%q) not ok", token)
	}
	if parts[0] != "4.5" || parts[1] != "store-m3" {
		t.Fatalf("parts = %v", parts)
	}
}

func TestDecodeCursorMalformed(t *testing.T) {
	cases := []string{"", "!!!not-base64!!!", EncodeCursor("only-one")}
	for _, tok := range cases {
		if _, ok := DecodeCursor(tok, 2); ok {
			t.Fatalf("DecodeCursor(%q) = ok, want false", tok)
		}
	}
}

func TestMaxBytesRejectsOversizedBody(t *testing.T) {
	h := MaxBytes(8)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var dst map[string]any
		if err := Decode(r, &dst); err != nil {
			Fail(w, http.StatusRequestEntityTooLarge, "too_large", "body too large")
			return
		}
		JSON(w, http.StatusOK, dst)
	}))

	body := strings.NewReader(`{"padding":"way more than eight bytes"}`)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/x", body))

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", rec.Code)
	}
}

func TestJSONAndFailEnvelope(t *testing.T) {
	rec := httptest.NewRecorder()
	Fail(rec, http.StatusBadRequest, "bad_request", "nope")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	got := strings.TrimSpace(rec.Body.String())
	if got != `{"error":"nope","code":"bad_request"}` {
		t.Fatalf("body = %s", got)
	}
}