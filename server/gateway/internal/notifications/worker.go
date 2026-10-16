// Outbox drain worker (W24 follow-up). The outbox is durable; this worker is the single mover of
// PENDING → SENT. It is provider-agnostic: a Sender delivers one push message (FCM/webhook/APNs),
// so the transport can be swapped without touching the outbox contract. When no Sender is
// configured the worker is not started at all — the app still reads the in-app inbox (polling).
package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

// DefaultDrainInterval is the polling SLA: a PENDING row is delivered within ~30s of enqueue.
const DefaultDrainInterval = 30 * time.Second

// Sender delivers one push message to a device token. Implementations must be safe for concurrent
// use. It must never log the token (device credential).
type Sender interface {
	Send(ctx context.Context, token, title, body string, data []byte) error
}

// Worker drains PENDING outbox rows to a Sender on a fixed interval.
type Worker struct {
	repo     *Repo
	sender   Sender
	interval time.Duration
	batch    int
	logger   *slog.Logger
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

// drainOnce delivers one batch. A per-row delivery error marks that row FAILED and never stops the
// batch. Returns only context/DB errors.
func (w *Worker) drainOnce(ctx context.Context) error {
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

// WebhookSender POSTs each message to a configured HTTPS endpoint as JSON
// {token,title,body,data}. This is the provider-agnostic default so any push relay (or a thin FCM
// bridge) can be dropped in without a code change. The token travels in the request body only.
type WebhookSender struct {
	url    string
	client *http.Client
}

// NewWebhookSender builds a sender posting to url. An empty url returns a nil sender.
func NewWebhookSender(url string) *WebhookSender {
	if url == "" {
		return nil
	}
	return &WebhookSender{url: url, client: &http.Client{Timeout: 10 * time.Second}}
}

// Send delivers one message. A non-2xx response is an error (the row becomes FAILED).
func (s *WebhookSender) Send(ctx context.Context, token, title, body string, data []byte) error {
	if s == nil || s.url == "" {
		return errors.New("push webhook not configured")
	}
	payload := struct {
		Token string          `json:"token"`
		Title string          `json:"title"`
		Body  string          `json:"body"`
		Data  json.RawMessage `json:"data,omitempty"`
	}{Token: token, Title: title, Body: body}
	if len(data) > 0 {
		payload.Data = json.RawMessage(data)
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return errors.New("push webhook non-2xx")
	}
	return nil
}
