package delivery

import (
	"testing"
	"time"
)

// Shift day boundaries are IST calendar days (the business timezone), matching the admin board
// filters. A date-only value from Postgres scans as UTC midnight, so the comparison must use the
// calendar fields, not an instant comparison.
func TestSameISTDayUsesCalendarDay(t *testing.T) {
	a := time.Date(2026, 11, 15, 0, 30, 0, 0, ist) // 2026-11-14 19:00 UTC — IST 15th
	b := time.Date(2026, 11, 14, 19, 0, 0, 0, time.UTC)
	if !sameISTDay(a, b) {
		t.Fatalf("expected same IST day for %s and %s", a, b)
	}
	dateOnly := time.Date(2026, 11, 15, 0, 0, 0, 0, time.UTC) // how `date` scans
	if !sameISTDay(dateOnly, a) {
		t.Fatalf("a date-only value must match the IST calendar day")
	}
	if sameISTDay(dateOnly, a.AddDate(0, 0, 1)) {
		t.Fatalf("the next IST day must not match")
	}
}

func TestISTDayKeyUsesISTCalendar(t *testing.T) {
	// 2026-11-14 20:00 UTC == 2026-11-15 01:30 IST → key 20261115.
	got := istDay(time.Date(2026, 11, 14, 20, 0, 0, 0, time.UTC))
	if got != "20261115" {
		t.Fatalf("istDay = %q, want 20261115", got)
	}
}
