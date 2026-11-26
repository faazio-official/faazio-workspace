// Category trash purger. A deleted category stays restorable for CategoryTrashWindow (7 days, 0136);
// after that it is removed for good once nothing references it. The sweep is an hourly gateway worker
// rather than pg_cron so the gateway stays the single scheduling authority (same decision as the
// credential, district, audit and catalogue-product purgers). The console also sweeps on every trash
// read, so a long-idle deploy still never shows an expired row as restorable.
package categories

import (
	"context"
	"log/slog"
	"time"
)

// purgeInterval is how often the trash sweep runs. Hourly is plenty for a 7-day window.
const purgeInterval = time.Hour

// Purger removes trashed categories past the undo window on a fixed interval.
type Purger struct {
	repo   *Repo
	logger *slog.Logger
}

// NewPurger builds the category trash purger. A nil repo disables it.
func NewPurger(repo *Repo, logger *slog.Logger) *Purger {
	if logger == nil {
		logger = slog.Default()
	}
	return &Purger{repo: repo, logger: logger}
}

// Enabled reports whether the purger has a repo.
func (p *Purger) Enabled() bool { return p != nil && p.repo != nil }

// PurgeOnce removes every category deleted more than CategoryTrashWindow ago and returns the count.
func (p *Purger) PurgeOnce(ctx context.Context) (int64, error) {
	if !p.Enabled() {
		return 0, nil
	}
	return p.repo.PurgeDeleted(ctx, CategoryTrashWindow)
}

// Run blocks until ctx is cancelled, sweeping once per purgeInterval. Safe in a goroutine.
func (p *Purger) Run(ctx context.Context) {
	if !p.Enabled() {
		return
	}
	p.logger.Info("category trash purge started", "interval", purgeInterval.String(),
		"window_days", int(CategoryTrashWindow.Hours()/24))
	ticker := time.NewTicker(purgeInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := p.PurgeOnce(ctx)
			if err != nil {
				p.logger.Warn("category trash purge failed", "err", err)
			} else if n > 0 {
				p.logger.Info("category trash purged", "count", n)
			}
		}
	}
}
