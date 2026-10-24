package delivery

import (
	"testing"
	"time"
)

// Date-only board filters are IST calendar days: "2026-10-24" starts at 00:00 IST (18:30 UTC the
// previous day), so the first 5.5 hours of the operator's day are never silently dropped.
func TestParseDateParamUsesISTCalendarDays(t *testing.T) {
	from := parseDateParam("2026-10-24", false)
	if from == nil {
		t.Fatal("from = nil, want a parsed date")
	}
	if want := time.Date(2026, 10, 23, 18, 30, 0, 0, time.UTC); !from.Equal(want) {
		t.Fatalf("from = %s, want %s", from.UTC(), want)
	}

	to := parseDateParam("2026-10-24", true)
	if to == nil {
		t.Fatal("to = nil, want a parsed date")
	}
	if want := time.Date(2026, 10, 24, 18, 29, 59, int(time.Second-time.Nanosecond), time.UTC); !to.Equal(want) {
		t.Fatalf("to = %s, want %s", to.UTC(), want)
	}

	if got := parseDateParam("", false); got != nil {
		t.Fatalf("empty date = %s, want nil", got)
	}
	if got := parseDateParam("24-10-2026", false); got != nil {
		t.Fatalf("invalid date = %s, want nil", got)
	}
}
