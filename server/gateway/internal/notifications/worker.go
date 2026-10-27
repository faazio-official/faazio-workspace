// Outbox drain worker (W24 follow-up). The outbox is durable; this worker is the single mover of
// PENDING → SENT. It is provider-agnostic: a Sender delivers one push message (FCM), so the
// transport can be swapped without touching the outbox contract. When no Sender is configured the
// worker is not started at all — the app still reads the in-app inbox (polling).
package notifications

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"
)

// DefaultDrainInterval is the polling SLA: a PENDING row is delivered within ~30s of enqueue.
const DefaultDrainInterval = 30 * time.Second

// ErrNoSender is returned by DrainOnce when the worker has no provider configured.
var ErrNoSender = errors.New("notifications: no push sender configured")

// Sender delivers one push message to a device token. Implementations must be safe for concurrent
// use. It must never log the token (device credential).
type Sender interface {
	Send(ctx context.Context, token, title, body string, data []byte) error
}

// Worker drains PENDING outbox rows to a Sender on a fixed interval. DrainOnce is serialized with
// the background tick (single-process monolith) so two movers can never claim the same PENDING row.
type Worker struct {
	repo     *Repo
	sender   Sender
	interval time.Duration
	batch    int
	logger   *slog.Logger
	mu       sync.Mutex
}

// NewWorker builds a drain worker. A nil sender yields a no-op worker (see Enabled).
func NewWorker(repo *Repo, sender Sender, logger *slog.Logger) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	return &Worker{repo: repo, sender: sender, interval: DefaultDrainInterval, batch: 100, logger: logger}
}

// Enabled reports whether the worker has both a repo and a sender to run.
func (w *Worker) Enabled() bool { return w != nil && w.repo != nil && w.sender != nil }

// DrainOnce runs a single synchronous drain batch — the manual trigger for deployments without a
// background worker. Returns ErrNoSender when no provider is configured (the app still polls the inbox).
func (w *Worker) DrainOnce(ctx context.Context) error {
	if !w.Enabled() {
		return ErrNoSender
	}
	return w.drainOnce(ctx)
}

// Run blocks until ctx is cancelled, draining each tick. Safe to call in a goroutine.
func (w *Worker) Run(ctx context.Context) {
	if !w.Enabled() {
		w.logger.Info("notifications worker disabled (no sender configured)")
		return
	}
	w.logger.Info("notifications worker started", "interval", w.interval.String())
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := w.drainOnce(ctx); err != nil {
				w.logger.Warn("notifications drain failed", "err", err)
			}
		}
	}
}

// drainOnce delivers one batch. A per-row delivery error marks that row FAILED and schedules a
// retry (capped exponential backoff, see repo.MarkFailed) without stopping the batch. Returns only
// context/DB errors. Serialized so the background loop and the admin drain trigger never deliver
// the same row twice within this process.
func (w *Worker) drainOnce(ctx context.Context) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	msgs, err := w.repo.Pending(ctx, w.batch)
	if err != nil {
		return err
	}
	for _, m := range msgs {
		if err := w.sender.Send(ctx, m.Token, m.Title, m.Body, m.Data); err != nil {
			if rerr := w.repo.MarkFailed(ctx, m.ID); rerr != nil {
				w.logger.Warn("notification mark-failed", "id", m.ID, "err", rerr)
			}
			continue
		}
		if err := w.repo.MarkSent(ctx, m.ID); err != nil {
			w.logger.Warn("notification mark-sent", "id", m.ID, "err", err)
		}
	}
	return nil
}
