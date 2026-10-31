// Razorpay Route hold releaser. A seller's share is transferred with on_hold until the 7-day
// buyer-protection window elapses; this worker releases every due transfer and marks the payout PAID.
// The manual SUPER_ADMIN endpoint (POST /payouts/{id}/release) stays available for ops overrides.
package settlement

import (
	"context"
	"log/slog"
	"time"

	"github.com/faazio/server/gateway/internal/platform/razorpayroute"
)

// holdReleaseBatch bounds one sweep so a backlog never holds a long lock.
const holdReleaseBatch = 100

// Releaser periodically settles held Route transfers once their release_after has passed.
type Releaser struct {
	repo  *Repo
	route razorpayroute.Gateway
	log   *slog.Logger
	now   func() time.Time
}

// NewReleaser builds the hold releaser. A nil logger uses slog.Default(); a nil route disables it.
func NewReleaser(repo *Repo, route razorpayroute.Gateway, logger *slog.Logger) *Releaser {
	if logger == nil {
		logger = slog.Default()
	}
	return &Releaser{repo: repo, route: route, log: logger, now: time.Now}
}

// Enabled reports whether real Razorpay Route credentials are configured. The worker never marks a
// hold PAID in mock mode, so a deploy without Route keys cannot silently skip a real payout.
func (r *Releaser) Enabled() bool {
	return r != nil && r.repo != nil && r.route != nil && r.route.Enabled()
}

// ReleaseDue releases one batch of due holds. Exported so the schedule can also be triggered on
// demand in tests/ops without waiting for the loop.
func (r *Releaser) ReleaseDue(ctx context.Context) (int, error) {
	if !r.Enabled() {
		return 0, nil
	}
	due, err := r.repo.DueHolds(ctx, r.now().UTC(), holdReleaseBatch)
	if err != nil {
		return 0, err
	}
	released := 0
	for _, p := range due {
		if p.RazorpayTransferID == "" {
			continue
		}
		if err := r.route.ReleaseTransfer(ctx, p.RazorpayTransferID); err != nil {
			r.log.Warn("settlement: release transfer failed", "payout_id", p.PayoutID, "err", err)
			continue
		}
		if _, ok, err := r.repo.ReleasePayout(ctx, p.PayoutID); err != nil || !ok {
			r.log.Warn("settlement: release recorded but payout not marked PAID", "payout_id", p.PayoutID, "err", err)
			continue
		}
		released++
	}
	return released, nil
}

// Run blocks until ctx is cancelled, sweeping every 15 minutes. Safe in a goroutine.
func (r *Releaser) Run(ctx context.Context) {
	if !r.Enabled() {
		r.log.Info("settlement hold releaser disabled (Razorpay Route credentials not configured)")
		return
	}
	r.log.Info("settlement hold releaser started", "interval", "15m", "batch", holdReleaseBatch)
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := r.ReleaseDue(ctx)
			if err != nil {
				r.log.Warn("settlement: hold sweep failed", "err", err)
				continue
			}
			if n > 0 {
				r.log.Info("settlement: holds released", "count", n)
			}
		}
	}
}
