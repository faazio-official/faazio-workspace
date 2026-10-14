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
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/db"
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

// Inbox returns a user's notifications, newest first.
func (r *Repo) Inbox(ctx context.Context, userID string, limit int) ([]Notification, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("notifications: database not configured")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return r.scan(ctx, `
		select id, coalesce(user_id,''), kind, title, body, data, status, created_at, sent_at
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
		select id, coalesce(user_id,''), kind, title, body, data, status, created_at, sent_at
		  from notifications.outbox
		 where ($1 = '' or status = $1)
		 order by created_at desc limit $2`, status, limit)
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
	_, err := r.pool.Exec(ctx, `
		insert into notifications.push_tokens (user_id, token, platform)
		values ($1,$2,$3)
		on conflict (user_id) do update
		  set token = excluded.token, platform = excluded.platform, updated_at = now()`,
		userID, token, plat)
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
		if err := rows.Scan(&n.ID, &n.UserID, &n.Kind, &n.Title, &n.Body, &data, &n.Status, &createdAt, &sentAt); err != nil {
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
