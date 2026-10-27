// Package notifications owns the durable notification outbox + push-token registry (W24). Contexts
// that trigger a customer event (pharma Rx READY, order status) enqueue through contracts.Notifier;
// this package is the single writer of notifications.outbox/push_tokens. Future service: Go + a
// queue worker (monolith-breakdown.md §1). The outbox holds no PII beyond the target user_id; the
// push token is a device credential and is never logged.
package notifications

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/db"
)

// Delivery retry policy for the drain worker: a FAILED row is retried with capped exponential
// backoff (1s, 2s, 4s, … up to MaxRetryBackoff) until it hits MaxDeliveryAttempts, after which it
// stays FAILED permanently (drainable rows are `status='PENDING'` or `FAILED` with
// `next_attempt_at <= now()`).
const (
	MaxDeliveryAttempts = 6
	MaxRetryBackoff     = 3600 * time.Second
)

// Notification is one notifications.outbox row (user-facing copy only).
type Notification struct {
	ID        string          `json:"id"`
	UserID    string          `json:"userId,omitempty"`
	Kind      string          `json:"kind"`
	Title     string          `json:"title"`
	Body      string          `json:"body"`
	Data      json.RawMessage `json:"data,omitempty"`
	Status    string          `json:"status"`
	Attempts  int             `json:"attempts"`
	CreatedAt string          `json:"createdAt"`
	SentAt    string          `json:"sentAt,omitempty"`
}

// Repo reads/writes the notifications schema.
type Repo struct {
	pool  *db.Pool
	cache *cache.Cache
}

// New returns a notifications repo.
func New(pool *db.Pool, c *cache.Cache) *Repo { return &Repo{pool: pool, cache: c} }

// Enqueue inserts one PENDING outbox row (contracts.Notifier). data must be PII-free.
func (r *Repo) Enqueue(ctx context.Context, userID, kind, title, body string, data map[string]any) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	var raw []byte
	if len(data) > 0 {
		b, err := json.Marshal(data)
		if err != nil {
			return err
		}
		raw = b
	}
	_, err := r.pool.Exec(ctx, `
		insert into notifications.outbox (id, user_id, kind, title, body, data)
		values ($1,$2,$3,$4,$5,$6)`,
		"ntf-"+shortID(), userID, kind, title, body, nullJSON(raw))
	if err != nil {
		return err
	}
	// The user's cached inbox is now stale (TTLNotifications); invalidate on enqueue.
	if r.cache != nil {
		r.cache.Del(ctx, cache.Notifications(userID))
	}
	return nil
}

// EnqueueSeller fans a PENDING row out to every active SELLER portal user owning one of the
// stores. Store ids only — the outbox row never carries customer PII.
func (r *Repo) EnqueueSeller(ctx context.Context, storeIDs []string, kind, title, body string, data map[string]any) error {
	if r.pool == nil || len(storeIDs) == 0 {
		return nil
	}
	rows, err := r.pool.Query(ctx, `
		select distinct pu.user_id
		  from admins.portal_users pu
		  join directory.stores s on s.seller_id = pu.seller_id
		 where s.id = any($1) and pu.active and pu.role = 'SELLER'`, storeIDs)
	if err != nil {
		return err
	}
	userIDs := []string{}
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			rows.Close()
			return err
		}
		userIDs = append(userIDs, userID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	// Fan out to every seller. A single user's enqueue failure must not starve the rest of order
	// notifications — attempt all rows and return the joined errors (if any) to the caller.
	var errs []error
	for _, userID := range userIDs {
		if err := r.Enqueue(ctx, userID, kind, title, body, data); err != nil {
			errs = append(errs, fmt.Errorf("notify seller %s: %w", userID, err))
		}
	}
	return errors.Join(errs...)
}

// Inbox returns a user's notifications, newest first.
func (r *Repo) Inbox(ctx context.Context, userID string, limit int) ([]Notification, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("notifications: database not configured")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return r.scan(ctx, `
		select id, coalesce(user_id,''), kind, title, body, data, status, attempts, created_at, sent_at
		  from notifications.outbox
		 where user_id = $1
		 order by created_at desc limit $2`, userID, limit)
}

// Outbox lists notifications for the admin console, optionally filtered by status.
func (r *Repo) Outbox(ctx context.Context, status string, limit int) ([]Notification, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("notifications: database not configured")
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	return r.scan(ctx, `
		select id, coalesce(user_id,''), kind, title, body, data, status, attempts, created_at, sent_at
		  from notifications.outbox
		 where ($1 = '' or status = $1)
		 order by created_at desc limit $2`, status, limit)
}

// PendingMessage is one drainable outbox row joined to the target's registered push token (the
// token is never returned to a client or logged).
type PendingMessage struct {
	ID     string
	UserID string
	Token  string
	Title  string
	Body   string
	Data   []byte
}

// Pending returns up to limit drainable rows that have a registered push token, oldest first:
// status PENDING plus FAILED rows whose next_attempt_at has passed (retry window). Rows past
// MaxDeliveryAttempts (next_attempt_at NULL) and rows without a token stay out of the drain.
func (r *Repo) Pending(ctx context.Context, limit int) ([]PendingMessage, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("notifications: database not configured")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		select o.id, o.user_id, t.token, o.title, o.body, o.data
		  from notifications.outbox o
		  join notifications.push_tokens t on t.user_id = o.user_id
		 where o.status = 'PENDING'
		    or (o.status = 'FAILED' and o.next_attempt_at is not null and o.next_attempt_at <= now())
		 order by o.created_at asc
		 limit $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PendingMessage{}
	for rows.Next() {
		var (
			m    PendingMessage
			data []byte
		)
		if err := rows.Scan(&m.ID, &m.UserID, &m.Token, &m.Title, &m.Body, &data); err != nil {
			return nil, err
		}
		m.Data = data
		out = append(out, m)
	}
	return out, rows.Err()
}

// MarkSent flips a row to SENT and stamps sent_at.
func (r *Repo) MarkSent(ctx context.Context, id string) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	_, err := r.pool.Exec(ctx,
		`update notifications.outbox set status = 'SENT', sent_at = now() where id = $1`, id)
	return err
}

// MarkFailed flips a row to FAILED and schedules the next retry attempt: capped exponential backoff
// (1s, 2s, 4s, … ≤ MaxRetryBackoff). After MaxDeliveryAttempts attempts next_attempt_at is null and
// the row is terminal. A transient webhook 5xx no longer drops the notification for good.
func (r *Repo) MarkFailed(ctx context.Context, id string) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		update notifications.outbox
		   set status = 'FAILED',
		       attempts = attempts + 1,
		       next_attempt_at = case
		         when attempts + 1 >= $2 then null -- terminal: retry budget exhausted
		         else now() + make_interval(secs => least($3::double precision, power(2::float8, attempts::float8)))
		       end,
		       updated_at = now()
		 where id = $1`, id, MaxDeliveryAttempts, MaxRetryBackoff.Seconds())
	return err
}

// Register upserts a device push token for the user.
func (r *Repo) Register(ctx context.Context, userID, token, platform string) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	var plat any
	if platform == "ios" || platform == "android" || platform == "web" {
		plat = platform
	}
	// A device can only belong to one portal login at a time: drop any previous owner of this
	// token before the per-user upsert (shared phones must not receive the old seller's orders).
	if _, err := r.pool.Exec(ctx,
		`delete from notifications.push_tokens where token = $1 and user_id <> $2`, token, userID); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		insert into notifications.push_tokens (user_id, token, platform)
		values ($1,$2,$3)
		on conflict (user_id) do update
		  set token = excluded.token, platform = excluded.platform, updated_at = now()`,
		userID, token, plat)
	return err
}

// Unregister removes the caller's device token (portal sign-out).
func (r *Repo) Unregister(ctx context.Context, userID string) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	_, err := r.pool.Exec(ctx, `delete from notifications.push_tokens where user_id = $1`, userID)
	return err
}

func (r *Repo) scan(ctx context.Context, query string, args ...any) ([]Notification, error) {
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Notification{}
	for rows.Next() {
		var (
			n         Notification
			data      []byte
			createdAt time.Time
			sentAt    *time.Time
		)
		if err := rows.Scan(&n.ID, &n.UserID, &n.Kind, &n.Title, &n.Body, &data, &n.Status, &n.Attempts, &createdAt, &sentAt); err != nil {
			return nil, err
		}
		if len(data) > 0 {
			n.Data = json.RawMessage(data)
		}
		n.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if sentAt != nil {
			n.SentAt = sentAt.UTC().Format(time.RFC3339)
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func nullJSON(v []byte) any {
	if len(v) == 0 {
		return nil
	}
	return string(v)
}
