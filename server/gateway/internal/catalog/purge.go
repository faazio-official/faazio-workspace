// Catalogue product-trash purger. A soft-deleted listing stays restorable for productTrashWindow
// (7 days, 0089); after that it (and its inventory.stock row) is removed for good. The sweep is an
// hourly gateway worker in addition to the pg_cron function and the on-read sweep, so the table stays
// bounded even when nobody opens the trash. Order history is preserved (historical records).
package catalog

import (
	"context"
	"log/slog"
	"time"
)

// purgeInterval is how often the trash sweep runs. Hourly is plenty for a 7-day window.
const purgeInterval = time.Hour

// Purger removes trashed listings past the undo window on a fixed interval.
type Purger struct {
	repo   *Repo
	logger *slog.Logger
}

// NewPurger builds the product trash purger. A nil repo disables it.
func NewPurger(repo *Repo, logger *slog.Logger) *Purger {
	if logger == nil {
		logger = slog.Default()
	}
	return &Purger{repo: repo, logger: logger}
}

// Enabled reports whether the purger has a repo.
func (p *Purger) Enabled() bool { return p != nil && p.repo != nil }

// PurgeOnce removes every listing deleted more than productTrashWindow ago and returns the count.
func (p *Purger) PurgeOnce(ctx context.Context) (int64, error) {
	if !p.Enabled() {
		return 0, nil
	}
	return p.repo.PurgeDeletedProducts(ctx, productTrashWindow)
}

// Run blocks until ctx is cancelled, sweeping once per purgeInterval. Safe in a goroutine.
func (p *Purger) Run(ctx context.Context) {
	if !p.Enabled() {
		return
	}
	p.logger.Info("product trash purge started", "interval", purgeInterval.String(),
		"window_days", int(productTrashWindow.Hours()/24))
	ticker := time.NewTicker(purgeInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := p.PurgeOnce(ctx)
			if err != nil {
				p.logger.Warn("product trash purge failed", "err", err)
			} else if n > 0 {
				p.logger.Info("product trash purged", "count", n)
			}
		}
	}
}
