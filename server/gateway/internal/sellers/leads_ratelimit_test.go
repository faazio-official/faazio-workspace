package sellers

import (
	"context"
	"net/http"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
)

// The public lead route is unauthenticated, so the per-IP daily cap is the only thing standing
// between it and a trivial flood. This covers the boundary: the first maxLeadsPerIPPerDay enquiries
// from one address get past the limiter (and reach the repo — the nil pool is what fails them here),
// and the next one is refused with 429 before any insert.
//
// Skips without a real Valkey: a nil cache is fail-open by design, so there is nothing to assert.
func TestCreateLeadRateLimit(t *testing.T) {
	c := testenv.Cache(t)
	testenv.RequireCache(t, c)

	r := chi.NewRouter()
	NewHandler(New(nil), c, nil, nil).Register(r)

	// Clear any counter a previous run (or a manual simulation) left for today.
	c.DelPrefix(context.Background(), "faazio:v1:sellers:lead:")
	t.Cleanup(func() { c.DelPrefix(context.Background(), "faazio:v1:sellers:lead:") })

	// Every request in this test shares one RemoteAddr, so they share one counter.
	body := `{"businessName":"Rate Shop","ownerName":"Owner","category":"MART",` +
		`"contactPhone":"9876543210","contactEmail":"rate@example.com",` +
		`"businessAddress":"12 Bharathiar Street","districtName":"Karaikal"}`

	for i := 1; i <= maxLeadsPerIPPerDay; i++ {
		rec := do(t, r, http.MethodPost, "/seller-leads", body, nil)
		if rec.Code == http.StatusTooManyRequests {
			t.Fatalf("enquiry %d of %d was rate-limited early: %s", i, maxLeadsPerIPPerDay, rec.Body.String())
		}
	}

	rec := do(t, r, http.MethodPost, "/seller-leads", body, nil)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("enquiry %d: status = %d, want %d (body %s)",
			maxLeadsPerIPPerDay+1, rec.Code, http.StatusTooManyRequests, rec.Body.String())
	}
	if !contains(rec.Body.String(), `"code":"rate_limited"`) {
		t.Fatalf("body %s missing code %q", rec.Body.String(), "rate_limited")
	}

	// The honeypot is checked before the counter, so a bot still learns nothing even at the cap.
	honeypot := `{"businessName":"Bot","ownerName":"Bot","category":"MART",` +
		`"contactPhone":"9876543210","contactEmail":"bot@example.com",` +
		`"businessAddress":"12 Bharathiar Street","districtName":"Karaikal","website":"http://spam"}`
	if rec := do(t, r, http.MethodPost, "/seller-leads", honeypot, nil); rec.Code != http.StatusCreated {
		t.Fatalf("honeypot at the cap: status = %d, want %d", rec.Code, http.StatusCreated)
	}
}
