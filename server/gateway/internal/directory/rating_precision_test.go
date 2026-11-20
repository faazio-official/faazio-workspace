package directory

import (
	"encoding/json"
	"math"
	"strconv"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
)

// `directory.stores.rating` is `real` (float4), so a 4.9 row scans as 4.900000095367432.
// Rounding that for display is correct, but the keyset cursor must keep the exact column value:
// a 1-dp cursor fails `rating = $3` in ByAppPage and silently drops rows that share the boundary
// rating. This pins both halves of that contract.
func TestStoreRatingRoundedButCursorExact(t *testing.T) {
	const stored = float64(float32(4.9)) // what pgx hands back for a `real` column
	if stored == 4.9 {
		t.Fatal("fixture is not float4-precision; test is meaningless")
	}

	raw := contracts.Store{Rating: math.Round(stored*10) / 10, RatingRaw: stored}

	if raw.Rating != 4.9 {
		t.Fatalf("display rating = %v, want 4.9", raw.Rating)
	}

	encoded := strconv.FormatFloat(raw.RatingRaw, 'f', -1, 64)
	decoded, err := strconv.ParseFloat(encoded, 64)
	if err != nil {
		t.Fatalf("decode cursor rating: %v", err)
	}
	if decoded != stored {
		t.Fatalf("cursor round-trip = %v, want exact %v (rounding here drops rows)", decoded, stored)
	}

	// A rounded cursor must NOT round-trip, otherwise a regression would pass silently.
	if rounded := strconv.FormatFloat(raw.Rating, 'f', -1, 64); rounded == encoded {
		t.Fatalf("rounded cursor %q is indistinguishable from exact cursor; guard is ineffective", rounded)
	}

	body, err := json.Marshal(raw)
	if err != nil {
		t.Fatalf("marshal store: %v", err)
	}
	var wire map[string]any
	if err := json.Unmarshal(body, &wire); err != nil {
		t.Fatalf("unmarshal store: %v", err)
	}
	if wire["rating"] != 4.9 {
		t.Fatalf("wire rating = %v, want 4.9", wire["rating"])
	}
	if _, leaked := wire["RatingRaw"]; leaked {
		t.Fatal("RatingRaw must never be serialized onto the wire")
	}
}
