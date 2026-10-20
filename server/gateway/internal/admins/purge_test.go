package admins

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// TestPurgeBeforeRetention seeds one stale (8 days) and one fresh (1 day) audit row, runs the
// retention purge, and asserts only the stale row is removed. Other pre-existing rows older than the
// window may also be purged on a shared dev DB, so the assertion is `>= 1` plus the two per-row
// checks — never an exact total.
func TestPurgeBeforeRetention(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	oldID := "log-old-" + shortID()
	freshID := "log-fresh-" + shortID()
	for _, r := range []struct {
		id        string
		createdAt string
	}{
		{oldID, "now() - interval '8 days'"},
		{freshID, "now() - interval '1 day'"},
	} {
		if _, err := pool.Exec(ctx, `
			insert into admins.audit_logs (log_id, actor_id, actor_role, action, entity, created_at)
			values ($1, 'u', 'SUPER_ADMIN', 'TEST_RETENTION', 'admins.audit_logs', `+r.createdAt+`)`, r.id); err != nil {
			t.Fatalf("seed %s: %v", r.id, err)
		}
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from admins.audit_logs where log_id in ($1,$2)`, oldID, freshID) })

	n, err := repo.PurgeBefore(ctx, time.Now().Add(-7*24*time.Hour))
	if err != nil {
		t.Fatalf("PurgeBefore: %v", err)
	}
	if n < 1 {
		t.Fatalf("expected at least 1 purged row, got %d", n)
	}

	var stale, fresh int
	if err := pool.QueryRow(ctx, `select count(*) from admins.audit_logs where log_id=$1`, oldID).Scan(&stale); err != nil {
		t.Fatalf("count stale: %v", err)
	}
	if err := pool.QueryRow(ctx, `select count(*) from admins.audit_logs where log_id=$1`, freshID).Scan(&fresh); err != nil {
		t.Fatalf("count fresh: %v", err)
	}
	if stale != 0 {
		t.Fatalf("stale row must be purged, found %d", stale)
	}
	if fresh != 1 {
		t.Fatalf("fresh row must survive the purge, got %d", fresh)
	}
}

// TestPurgerPurgeOnceRecordsAudit exercises the full Purger pass: it purges a stale row AND leaves a
// fresh AUDIT_PURGE row behind (created after the cutoff, so the purge is never invisible).
func TestPurgerPurgeOnceRecordsAudit(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewPurger(New(pool), nil)
	ctx := context.Background()

	oldID := "log-purged-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into admins.audit_logs (log_id, actor_id, actor_role, action, entity, created_at)
		values ($1, 'u', 'SELLER', 'TEST_PURGE', 'sellers.sellers', now() - interval '8 days')`, oldID); err != nil {
		t.Fatalf("seed stale row: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from admins.audit_logs where log_id=$1`, oldID) })

	n, err := p.PurgeOnce(ctx, "test-actor", "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("PurgeOnce: %v", err)
	}
	if n < 1 {
		t.Fatalf("expected at least 1 purged row, got %d", n)
	}

	var auditRows int
	if err := pool.QueryRow(ctx, `
		select count(*) from admins.audit_logs
		 where action='AUDIT_PURGE' and created_at > now() - interval '1 minute'`).Scan(&auditRows); err != nil {
		t.Fatalf("count AUDIT_PURGE: %v", err)
	}
	if auditRows < 1 {
		t.Fatal("PurgeOnce must leave a surviving AUDIT_PURGE row")
	}
}

// TestNextMidnightIST pins the schedule math: next 00:00 IST strictly after now.
func TestNextMidnightIST(t *testing.T) {
	cases := []struct {
		name string
		now  time.Time
		want time.Time
	}{
		{
			name: "mid-afternoon IST still same IST day",
			// 12:00 UTC == 17:30 IST on 2026-10-20 → next midnight is 2026-10-21 00:00 IST.
			now:  time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC),
			want: time.Date(2026, 10, 20, 18, 30, 0, 0, time.UTC),
		},
		{
			name: "late night IST rolls to the following day",
			// 23:00 UTC == 04:30 IST on 2026-10-21 → next midnight is 2026-10-22 00:00 IST.
			now:  time.Date(2026, 10, 20, 23, 0, 0, 0, time.UTC),
			want: time.Date(2026, 10, 21, 18, 30, 0, 0, time.UTC),
		},
		{
			name: "exactly midnight IST is strictly the next day",
			// 18:30 UTC == 00:00 IST on 2026-10-21 → next midnight is 2026-10-22 00:00 IST.
			now:  time.Date(2026, 10, 20, 18, 30, 0, 0, time.UTC),
			want: time.Date(2026, 10, 21, 18, 30, 0, 0, time.UTC),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nextMidnightIST(tc.now); !got.Equal(tc.want) {
				t.Fatalf("nextMidnightIST(%v) = %v, want %v", tc.now.Format(time.RFC3339), got.Format(time.RFC3339), tc.want.Format(time.RFC3339))
			}
		})
	}
}

type fakePurger struct {
	n   int
	err error
}

func (f fakePurger) PurgeOnce(context.Context, string, string) (int, error) { return f.n, f.err }

// TestPurgeAuditLogsUnconfigured asserts the manual trigger 503s when no purger is wired (parity
// with media GC).
func TestPurgeAuditLogsUnconfigured(t *testing.T) {
	h := NewHandler(New(nil), nil, nil)
	rec := httptest.NewRecorder()
	h.purgeAuditLogs(rec, httptest.NewRequest(http.MethodPost, "/audit-logs/purge", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d with body %s", rec.Code, rec.Body.String())
	}
}

// TestPurgeAuditLogsOK asserts the manual trigger reports the deleted count.
func TestPurgeAuditLogsOK(t *testing.T) {
	h := NewHandler(New(nil), nil, fakePurger{n: 5})
	rec := httptest.NewRecorder()
	h.purgeAuditLogs(rec, httptest.NewRequest(http.MethodPost, "/audit-logs/purge", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d with body %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Deleted int `json:"deleted"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Deleted != 5 {
		t.Fatalf("expected deleted=5, got %+v", body)
	}
}

// TestPurgeAuditLogsErr reports purge_failed when the pass itself errors.
func TestPurgeAuditLogsErr(t *testing.T) {
	h := NewHandler(New(nil), nil, fakePurger{err: context.DeadlineExceeded})
	rec := httptest.NewRecorder()
	h.purgeAuditLogs(rec, httptest.NewRequest(http.MethodPost, "/audit-logs/purge", nil))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d with body %s", rec.Code, rec.Body.String())
	}
}
