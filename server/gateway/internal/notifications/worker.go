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

// adminDrainBatch bounds a single manual POST /notifications/drain to a small batch so a large
// backlog cannot keep the admin endpoint past the router's request timeout (10s) and return a
// misleading 500 mid-batch. The background loop keeps the full batch — its context is not
// request-bounded.
const adminDrainBatch = 10

// ErrNoSender is returned by DrainOnce when the worker has no provider configured.
var ErrNoSender = errors.New("notifications: no push sender configured")

// Sender delivers one push message to a device token. Implementations must be safe for concurrent
// use. It must never log the token (device credential).
type Sender interface {
	Send(ctx context.Context, token, title, body string, data []byte) error
}

// Worker drains PENDING outbox rows to a SenderRouter on a fixed interval. DrainOnce is serialized
// with the background tick (single-process monolith) so two movers can never claim the same PENDING
// row.
type Worker struct {
	repo     *Repo
	router   SenderRouter
	interval time.Duration
	batch    int
	logger   *slog.Logger
	mu       sync.Mutex
	// nudge wakes Run early. A ring has a 45s TTL but the default tick is 30s, so a call push that
	// lands just after a tick would ring too late to answer. Non-blocking: a caller never waits.
	nudge chan struct{}
}

// NewWorker builds a drain worker. A nil router yields a no-op worker (see Enabled).
func NewWorker(repo *Repo, router SenderRouter, logger *slog.Logger) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	return &Worker{
		repo: repo, router: router, interval: DefaultDrainInterval, batch: 100, logger: logger,
		nudge: make(chan struct{}, 1),
	}
}

// Nudge asks the running worker to drain now instead of waiting for the next tick. It is safe to
// call from any goroutine and never blocks; calls coalesce while a drain is already pending.
func (w *Worker) Nudge() {
	if w == nil || w.nudge == nil {
		return
	}
	select {
	case w.nudge <- struct{}{}:
	default:
	}
}

// Enabled reports whether the worker has both a repo and a router to run.
func (w *Worker) Enabled() bool { return w != nil && w.repo != nil && w.router != nil }

// DrainOnce runs a single synchronous drain batch — the manual trigger for deployments without a
// background worker. The batch is capped at adminDrainBatch and stops cleanly if the request context
// expires mid-batch. Returns ErrNoSender when no provider is configured (the app still polls the inbox).
func (w *Worker) DrainOnce(ctx context.Context) error {
	if !w.Enabled() {
		return ErrNoSender
	}
	return w.drainOnce(ctx, adminDrainBatch)
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
			if err := w.drainOnce(ctx, w.batch); err != nil {
				w.logger.Warn("notifications drain failed", "err", err)
			}
		case <-w.nudge:
			// A low-latency push (incoming call) is waiting; deliver it now rather than on the next
			// 30s tick, which would outlive the ring.
			if err := w.drainOnce(ctx, w.batch); err != nil {
				w.logger.Warn("notifications drain failed", "err", err)
			}
		}
	}
}

// drainOnce delivers one batch of up to limit rows. A per-row delivery error marks that row FAILED
// and schedules a retry (capped exponential backoff, see repo.MarkFailed) without stopping the
// batch. A permanently-dead token (ErrTokenUnregistered) instead expires the row and prunes the
// token atomically (repo.ExpireToken) — no retry budget is spent on a token that can never accept a
// push again. If the context expires mid-batch (the manual drain hits the router timeout) the
// remaining rows are left untouched and the context error is returned — never a fabricated success.
// Serialized so the background loop and the admin drain trigger never deliver the same row twice
// within this process.
func (w *Worker) drainOnce(ctx context.Context, limit int) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	// The router decides which token kind is deliverable: a `voip` token is only selectable when an
	// APNs transport exists, otherwise the drain would repeatedly pull a PushKit token it cannot send.
	msgs, err := w.repo.Pending(ctx, limit, SupportsVoIP(w.router))
	if err != nil {
		return err
	}
	for _, m := range msgs {
		if err := ctx.Err(); err != nil {
			return err
		}
		// The router picks the transport from the row's token (iOS VoIP → APNs, everything else →
		// FCM). A row is marked SENT only after the chosen transport accepted it.
		msg := RoutedMessage{
			Platform:  m.Platform,
			TokenKind: m.TokenKind,
			Token:     m.Token,
			Title:     m.Title,
			Body:      m.Body,
			Data:      m.Data,
		}
		if err := w.router.Send(ctx, msg); err != nil {
			if errors.Is(err, ErrTokenUnregistered) {
				if rerr := w.repo.ExpireToken(ctx, m.ID, m.Token); rerr != nil {
					w.logger.Warn("notification expire-token", "id", m.ID, "err", rerr)
				}
				continue
			}
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
