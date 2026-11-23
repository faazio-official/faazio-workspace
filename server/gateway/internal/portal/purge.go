// Credential trash purger. A deleted portal credential stays restorable for CredentialTrashWindow
// (7 days, 0128); after that it is removed for good. The sweep is an hourly gateway worker rather than
// pg_cron so the gateway stays the single scheduling authority (same decision as the audit purger and
// the catalogue product trash). The console also sweeps on every list, so a long-idle deploy still
// never shows an expired row as restorable — this worker keeps the table bounded when nobody looks.
package portal

import (
	"context"
	"log/slog"
	"time"
)

// purgeInterval is how often the trash sweep runs. Hourly is plenty for a 7-day window and keeps the
// delete batch small.
const purgeInterval = time.Hour

// Purger removes trashed credentials past the undo window on a fixed interval.
type Purger struct {
	repo   *Repo
	logger *slog.Logger
}

// NewPurger builds the credential trash purger. A nil repo disables it.
func NewPurger(repo *Repo, logger *slog.Logger) *Purger {
	if logger == nil {
		logger = slog.Default()
	}
	return &Purger{repo: repo, logger: logger}
}

// Enabled reports whether the purger has a repo.
func (p *Purger) Enabled() bool { return p != nil && p.repo != nil }

// PurgeOnce removes every credential deleted more than CredentialTrashWindow ago and returns the count.
func (p *Purger) PurgeOnce(ctx context.Context) (int64, error) {
	if !p.Enabled() {
		return 0, nil
	}
	return p.repo.PurgeDeleted(ctx, CredentialTrashWindow)
}

// Run blocks until ctx is cancelled, sweeping once per purgeInterval. Safe in a goroutine.
func (p *Purger) Run(ctx context.Context) {
	if !p.Enabled() {
		return
	}
	p.logger.Info("credential trash purge started", "interval", purgeInterval.String(),
		"window_days", int(CredentialTrashWindow.Hours()/24))
	ticker := time.NewTicker(purgeInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := p.PurgeOnce(ctx)
			if err != nil {
				p.logger.Warn("credential trash purge failed", "err", err)
			} else if n > 0 {
				p.logger.Info("credential trash purged", "count", n)
			}
		}
	}
}
