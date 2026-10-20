// Audit-log retention purger. admins.audit_logs stays read-only in the portal (no RLS UPDATE/DELETE
// policy), but rows are no longer kept forever: a nightly 00:00 IST pass deletes everything older
// than the retention window (7 days) so the table stays bounded. The scheduler is deliberately NOT
// pg_cron (superadmin decision, 2026-10): it is this gateway worker on Render, so the renderer keeps
// a single scheduling authority. Valkey is never used for scheduling (a cache has no clock) — this
// is a plain time.Timer to the next IST midnight.
//
// The worker is a pure time loop + one repo call, so it is unit-tested (scheduling math) and
// integration-tested (PurgeOnce) with the real pool. Reference: docs/architecture/db-schema.md
// §12.9/§12.20, monolith-breakdown.md §1.
package admins

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
)

const (
	// AuditRetention is how long an audit row survives before the daily midnight-IST pass deletes it.
	AuditRetention = 7 * 24 * time.Hour
	// auditPurgeAction is the audit action recorded after every pass. The fresh row is written after
	// the cutoff, so it survives the very purge it reports.
	auditPurgeAction = "AUDIT_PURGE"
	// purgeBatch is the SQL batch size (the 0037 function deletes in ctid chunks; kept here only for
	// observability/log prose — the DB owns the batching).
	purgeBatch = 2000
	// istOffset is India Standard Time (UTC+5:30). India has had no DST since 1970, so a fixed zone
	// is exact and avoids depending on host tzdata.
	istOffset = 5*time.Hour + 30*time.Minute
)

// ErrPurgeUnavailable is returned by PurgeOnce when the purger has no repo configured.
var ErrPurgeUnavailable = errors.New("admins: audit purge not configured")

// purgeStore is the slice of Repo the purger needs.
type purgeStore interface {
	PurgeBefore(ctx context.Context, before time.Time) (int, error)
	Audit(ctx context.Context, e contracts.AuditEntry) error
}

// Purger deletes audit rows older than AuditRetention, on a daily midnight-IST pass and on the
// SUPER_ADMIN manual trigger (POST /audit-logs/purge).
type Purger struct {
	repo   purgeStore
	logger *slog.Logger
	now    func() time.Time
}

// NewPurger builds the retention purger. repo may be nil (PurgeOnce returns ErrPurgeUnavailable).
func NewPurger(repo purgeStore, logger *slog.Logger) *Purger {
	if logger == nil {
		logger = slog.Default()
	}
	return &Purger{repo: repo, logger: logger, now: time.Now}
}

// Enabled reports whether the purger has a store.
func (p *Purger) Enabled() bool {
	return p != nil && p.repo != nil
}

// PurgeOnce deletes every audit row older than the retention window, then records one surviving
// AUDIT_PURGE row carrying the deleted count + cutoff. actorID is the JWT subject for the manual
// trigger or "system" for the nightly pass; actorRole must be a valid audit actor_role.
func (p *Purger) PurgeOnce(ctx context.Context, actorID, actorRole string) (int, error) {
	if !p.Enabled() {
		return 0, ErrPurgeUnavailable
	}
	cutoff := p.now().Add(-AuditRetention)
	n, err := p.repo.PurgeBefore(ctx, cutoff)
	if err != nil {
		return 0, err
	}
	after, _ := json.Marshal(map[string]any{
		"deleted": n,
		"cutoff":  cutoff.UTC().Format(time.RFC3339),
	})
	if err := p.repo.Audit(ctx, contracts.AuditEntry{
		ActorID: actorID, ActorRole: actorRole,
		Action: auditPurgeAction, Entity: "admins.audit_logs", After: after,
	}); err != nil {
		p.logger.Warn("audit purge: could not record AUDIT_PURGE row", "err", err)
	}
	return n, nil
}

// Run blocks until ctx is cancelled, running PurgeOnce once per day at 00:00 IST. The first pass
// always waits for the next midnight rather than firing on startup, so a mid-day deploy never
// spuriously purges early. Safe in a goroutine. A missed midnight (Render free-tier sleep, deploys)
// just means the next day's pass purges a slightly wider window in the same batched delete.
func (p *Purger) Run(ctx context.Context) {
	if !p.Enabled() {
		p.logger.Info("audit purge disabled (database not configured)")
		return
	}
	p.logger.Info("audit purge started",
		"retention_days", int(AuditRetention.Hours()/24),
		"schedule", "00:00 IST daily",
		"batch", purgeBatch)
	for {
		wait := time.Until(nextMidnightIST(p.now()))
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
		n, err := p.PurgeOnce(ctx, "system", auth.RoleSuperAdmin)
		if err != nil {
			p.logger.Warn("audit purge pass failed", "err", err)
			continue
		}
		p.logger.Info("audit purge pass complete", "deleted", n)
	}
}

// nextMidnightIST returns the instant of the next 00:00 IST, strictly after now. Pure function so
// the schedule is unit-testable without a clock.
func nextMidnightIST(now time.Time) time.Time {
	zone := istZone()
	ist := now.In(zone)
	midnight := time.Date(ist.Year(), ist.Month(), ist.Day(), 0, 0, 0, 0, zone)
	if !midnight.After(ist) {
		midnight = midnight.AddDate(0, 0, 1)
	}
	return midnight
}

func istZone() *time.Location {
	return time.FixedZone("IST", int(istOffset/time.Second))
}
