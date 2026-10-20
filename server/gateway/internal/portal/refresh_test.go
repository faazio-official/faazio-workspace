package portal

import (
	"testing"
	"time"
)

func utcTime(y int, mo time.Month, d, h, mi int) time.Time {
	return time.Date(y, mo, d, h, mi, 0, 0, time.UTC)
}

func TestSessionLifetimeConstants(t *testing.T) {
	if AccessTTL != 15*time.Minute {
		t.Fatalf("AccessTTL = %v, want 15m", AccessTTL)
	}
	if RefreshIdleTTL != 30*24*time.Hour {
		t.Fatalf("RefreshIdleTTL = %v, want 30d (sliding)", RefreshIdleTTL)
	}
	if RefreshAbsoluteTTL != 180*24*time.Hour {
		t.Fatalf("RefreshAbsoluteTTL = %v, want 180d (hard cap)", RefreshAbsoluteTTL)
	}
	if ReuseGrace < 10*time.Second || ReuseGrace > 60*time.Second {
		t.Fatalf("ReuseGrace = %v, want the tunable 10-60s band", ReuseGrace)
	}
}

func TestRefreshVerdict(t *testing.T) {
	now := utcTime(2026, 10, 21, 12, 0)
	graceUntil := now.Add(20 * time.Second)
	live := Session{
		SessionID:         "ps-sibling",
		ExpiresAt:         now.Add(RefreshIdleTTL),
		AbsoluteExpiresAt: now.Add(RefreshAbsoluteTTL),
	}

	used := func(s Session) Session {
		u := now.Add(-1 * time.Second)
		s.UsedAt = &u
		return s
	}
	graced := func(s Session) Session {
		s.ReuseGraceUntil = &graceUntil
		s.RotatedToHash = "176c00c00c00c00c00c00c00c00c00c00c00c00c00c00c00c00c00c00c"
		return s
	}
	revoked := func(s Session) Session {
		r := now.Add(-2 * time.Second)
		s.RevokedAt = &r
		return s
	}

	cases := []struct {
		name string
		s    Session
		want refreshVerdict
	}{
		{"a live single-use token rotates normally", live, verdictOK},

		{"revoked is terminal with no side-cast", revoked(used(graced(live))), verdictRevoked},
		{"revoked beats an absolute cap", revoked(func() Session { s := live; s.AbsoluteExpiresAt = now.Add(-time.Minute); return s }()), verdictRevoked},

		{"absolute cap reached kills the family even for a live token", func() Session {
			s := live
			s.AbsoluteExpiresAt = now.Add(-time.Minute)
			return s
		}(), verdictAbsolute},
		{"absolute cap beats the grace window", func() Session {
			s := used(graced(live))
			s.AbsoluteExpiresAt = now.Add(-time.Minute)
			return s
		}(), verdictAbsolute},

		{"replayed token inside grace is an idempotent rotation", used(graced(live)), verdictGrace},
		{"legacy used row (0032, no rotated_to) inside grace still reads as theft", func() Session {
			s := used(live)
			s.ReuseGraceUntil = &graceUntil
			return s
		}(), verdictTheft},
		{"replay after grace lapses is theft", used(func() Session { s := graced(live); g := now.Add(-time.Second); s.ReuseGraceUntil = &g; return s }()), verdictTheft},
		{"replay with no grace window is theft", used(live), verdictTheft},

		{"idle lapsed revokes only this device", func() Session {
			s := live
			s.ExpiresAt = now.Add(-time.Minute)
			return s
		}(), verdictIdle},
		{"grace still wins over an idle lapse (checked first)", func() Session {
			s := used(graced(live))
			s.ExpiresAt = now.Add(-time.Minute)
			return s
		}(), verdictGrace},
	}

	for _, c := range cases {
		if got := refreshVerdictOf(c.s, now); got != c.want {
			t.Errorf("%s: refreshVerdictOf = %d, want %d", c.name, got, c.want)
		}
	}
}
