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
	// ReadAt is set the first time the recipient opens the notification (in-app read state).
	ReadAt string `json:"readAt,omitempty"`
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
		r.cache.Del(ctx, cache.Notifications(userID), cache.NotificationsUnread(userID))
	}
	return nil
}

// maxEnqueueMany bounds one bulk broadcast. The outbox is a single FIFO drained 100 rows per tick
// (DefaultDrainInterval) and shares that queue with incoming_call ring pushes, so a board broadcast
// must never be able to queue an unbounded number of rows ahead of a call. A capped batch still
// reaches a capped number of donors immediately; the rest of the board is served by the normal read.
const maxEnqueueMany = 500

// EnqueueMany inserts one PENDING outbox row per recipient in a single statement. It is the bulk
// counterpart of Enqueue for board broadcasts (a new public blood request concerns every matching
// donor at once), and differs from it in three ways that all exist to protect the shared outbox:
//
//   - Recipients without a `push` token are dropped. Pending() joins push_tokens, so a tokenless
//     row can never be drained — it would sit PENDING forever and widen every subsequent scan.
//   - The insert is one round-trip, not one per recipient. EnqueueSeller loops Enqueue per user;
//     at board-broadcast scale that is thousands of sequential statements inside a POST.
//   - maxEnqueueMany caps the batch. The outbox is a single FIFO drained 100 rows per tick that
//     also carries incoming_call ring pushes, so an unbounded fan-out would delay calls behind it.
//
// Delivery stays best-effort: the board read is the source of truth, the push is only a nudge.
func (r *Repo) EnqueueMany(ctx context.Context, userIDs []string, kind, title, body string, data map[string]any) error {
	if r.pool == nil || len(userIDs) == 0 {
		return nil
	}
	recipients := userIDs
	if len(recipients) > maxEnqueueMany {
		recipients = recipients[:maxEnqueueMany]
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
		select 'ntf-' || substr(md5(random()::text || u.user_id), 1, 10), u.user_id, $2, $3, $4, $5
		  from unnest($1::text[]) as u(user_id)
		 where exists (
		         select 1 from notifications.push_tokens pt
		          where pt.user_id = u.user_id and pt.token_kind = 'push'
		       )`, recipients, kind, title, body, nullJSON(raw))
	if err != nil {
		return err
	}
	// Every recipient's cached inbox is now stale (TTLNotifications); drop them in one call.
	if r.cache != nil {
		keys := make([]string, 0, len(recipients)*2)
		for _, userID := range recipients {
			keys = append(keys, cache.Notifications(userID), cache.NotificationsUnread(userID))
		}
		r.cache.Del(ctx, keys...)
	}
	return nil
}

// EnqueueSeller fans a PENDING row out to the active owner login(s) of the sellers owning the given
// stores, gated by that seller's alert preferences. Store ids only — the outbox row never carries
// customer PII. Sub-user staff logins do not receive account alerts (the owner is the account).
func (r *Repo) EnqueueSeller(ctx context.Context, storeIDs []string, kind, title, body string, data map[string]any) error {
	if r.pool == nil || len(storeIDs) == 0 {
		return nil
	}
	rows, err := r.pool.Query(ctx, `
		select distinct pu.user_id
		  from admins.portal_users pu
		  join directory.stores s on s.seller_id = pu.seller_id
		  left join sellers.notification_preferences np on np.seller_id = pu.seller_id
		 where s.id = any($1) and pu.active and pu.role = 'SELLER' and pu.sub_role is null
		   and pu.deleted_at is null
		   and (case $2
		          when 'SELLER_ORDER_NEW' then coalesce(np.new_order, true)
		          when 'SELLER_LOW_STOCK' then coalesce(np.low_stock, true)
		          when 'SELLER_SLA_BREACH' then coalesce(np.sla_breach, true)
		          when 'SELLER_CAMPAIGN' then coalesce(np.campaigns, true)
		          else true
		        end)`, storeIDs, kind)
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

// inboxExcludedKinds are outbox kinds that are delivered as a live push (an incoming call rings
// through the call surface) but are NOT part of the durable in-app inbox. They are filtered out of
// both the inbox list and the unread badge so a call never shows up as an unread inbox row.
const inboxExcludedKinds = `('incoming_call')`

// Inbox returns a user's durable in-app notifications, newest first. Ephemeral ring pushes
// (`incoming_call`) are excluded — they are consumed by the call surface, not the inbox.
func (r *Repo) Inbox(ctx context.Context, userID string, limit int) ([]Notification, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("notifications: database not configured")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return r.scan(ctx, `
		select id, coalesce(user_id,''), kind, title, body, data, status, attempts, created_at, sent_at, read_at
		  from notifications.outbox
		 where user_id = $1 and kind not in `+inboxExcludedKinds+`
		 order by created_at desc limit $2`, userID, limit)
}

// UnreadCount returns the number of unread inbox notifications for a user (the badge count).
// `incoming_call` rows are excluded for the same reason as Inbox — a ring is not an inbox item.
func (r *Repo) UnreadCount(ctx context.Context, userID string) (int, error) {
	if r.pool == nil {
		return 0, fmt.Errorf("notifications: database not configured")
	}
	var n int
	if err := r.pool.QueryRow(ctx, `
		select count(*)
		  from notifications.outbox
		 where user_id = $1 and read_at is null and kind not in `+inboxExcludedKinds,
		userID).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

// MarkRead stamps one of the caller's notifications as read. A foreign/unknown id is a no-op.
func (r *Repo) MarkRead(ctx context.Context, userID, id string) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		update notifications.outbox
		   set read_at = now()
		 where id = $1 and user_id = $2 and read_at is null`, id, userID)
	if err != nil {
		return err
	}
	if r.cache != nil {
		r.cache.Del(ctx, cache.Notifications(userID), cache.NotificationsUnread(userID))
	}
	return nil
}

// MarkAllRead stamps every unread notification for the caller as read.
func (r *Repo) MarkAllRead(ctx context.Context, userID string) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		update notifications.outbox
		   set read_at = now()
		 where user_id = $1 and read_at is null`, userID)
	if err != nil {
		return err
	}
	if r.cache != nil {
		r.cache.Del(ctx, cache.Notifications(userID), cache.NotificationsUnread(userID))
	}
	return nil
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
		select id, coalesce(user_id,''), kind, title, body, data, status, attempts, created_at, sent_at, read_at
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
	// Platform is the token's registered platform (ios/android/web; "" when unrecorded).
	Platform string
	// TokenKind is push (FCM/APNs alert) or voip (PushKit, incoming calls only).
	TokenKind string
	Title     string
	Body      string
	Data      []byte
}

// Pending returns up to limit drainable rows that have a registered push token, oldest first:
// status PENDING plus FAILED rows whose next_attempt_at has passed (retry window). Rows past
// MaxDeliveryAttempts (next_attempt_at NULL) and rows without a token stay out of the drain.
//
// Token selection: a user may hold a `push` token and a `voip` token at once (migration 0105), so
// the lateral join picks exactly one per row. An `incoming_call` prefers the VoIP token — only a
// PushKit token can make CallKit ring — and falls back to the push token on a device that has none
// (Android). Every other kind only ever uses the push token: an alert cannot be delivered to a
// VoIP-scoped token.
//
// `preferVoIP` is false when no APNs transport is configured. A PushKit token is not an FCM
// registration token, so routing it to FCM can only fail; selecting the push token instead means an
// iOS device still gets the background wake-up even though it cannot ring.
func (r *Repo) Pending(ctx context.Context, limit int, preferVoIP bool) ([]PendingMessage, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("notifications: database not configured")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		select o.id, o.user_id, t.token, coalesce(t.platform,''), t.token_kind, o.title, o.body, o.data
		  from notifications.outbox o
		  join lateral (
		    select pt.token, pt.platform, pt.token_kind
		      from notifications.push_tokens pt
		     where pt.user_id = o.user_id
		       and (o.kind = 'incoming_call' or pt.token_kind = 'push')
		     order by case
		                when $2 and o.kind = 'incoming_call' and pt.token_kind = 'voip' then 0
		                when pt.token_kind = 'push' then 1
		                else 2
		              end,
		              pt.updated_at desc
		     limit 1
		  ) t on true
		 where o.status = 'PENDING'
		    or (o.status = 'FAILED' and o.next_attempt_at is not null and o.next_attempt_at <= now())
		 order by o.created_at asc
		 limit $1`, limit, preferVoIP)
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
		if err := rows.Scan(&m.ID, &m.UserID, &m.Token, &m.Platform, &m.TokenKind, &m.Title, &m.Body, &data); err != nil {
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
// the row is terminal. A transient send failure no longer drops the notification for good.
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

// ExpireToken prunes the device's push_tokens row when the provider reports a permanently-dead token
// (FCM UNREGISTERED / APNs 410 Unregistered). Retrying against it would waste the whole budget on
// every future enqueue, and keeping the row would re-attempt it forever.
//
// A user can hold a second token of a different kind (migration 0105): an iOS device has both a
// PushKit VoIP token and an FCM token. If one dies while a token that can still carry this message
// survives, the row goes back to PENDING with no backoff so the next drain delivers it over the
// surviving transport — only the last usable token dying makes the row terminal. "Usable" is
// kind-specific: a VoIP token can carry only an `incoming_call`, never an alert (the drain query
// would otherwise strand the row in PENDING forever, because nothing can select it). Everything
// happens in one transaction so a terminal row can never survive without its dead token pruned.
func (r *Repo) ExpireToken(ctx context.Context, id, token string) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var userID, kind string
	if err := tx.QueryRow(ctx,
		`select user_id, kind from notifications.outbox where id = $1`, id).Scan(&userID, &kind); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from notifications.push_tokens where token = $1`, token); err != nil {
		return err
	}
	// A call may go out over either token kind; an alert only over a push token.
	usable := `pt.token_kind = 'push'`
	if kind == "incoming_call" {
		usable = `pt.token_kind in ('push','voip')`
	}
	var remaining int
	if err := tx.QueryRow(ctx,
		`select count(*) from notifications.push_tokens pt where pt.user_id = $1 and `+usable,
		userID).Scan(&remaining); err != nil {
		return err
	}
	if remaining > 0 {
		// Another usable token for this user survives; let the next drain try it immediately.
		if _, err := tx.Exec(ctx, `
			update notifications.outbox
			   set status = 'PENDING',
			       next_attempt_at = null,
			       updated_at = now()
			 where id = $1`, id); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	if _, err := tx.Exec(ctx, `
		update notifications.outbox
		   set status = 'FAILED',
		       attempts = $2,
		       next_attempt_at = null, -- terminal: never retry a dead token
		       updated_at = now()
		 where id = $1`, id, MaxDeliveryAttempts); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Register upserts a device push token for the user. kind is push (FCM/APNs alert) or voip
// (PushKit); the two coexist per user, and each is replaced independently on refresh.
func (r *Repo) Register(ctx context.Context, userID, token, platform, kind string) error {
	if r.pool == nil {
		return fmt.Errorf("notifications: database not configured")
	}
	var plat any
	if platform == "ios" || platform == "android" || platform == "web" {
		plat = platform
	}
	if kind != TokenKindVoIP {
		kind = TokenKindPush
	}
	// A device can only belong to one portal login at a time: drop any previous owner of this
	// token before the per-user upsert (shared phones must not receive the old seller's orders).
	// Only the token value is evicted, so the same user's other token kind is untouched (the FCM and
	// the PushKit token are different credentials and coexist for one device).
	if _, err := r.pool.Exec(ctx,
		`delete from notifications.push_tokens where token = $1 and user_id <> $2`,
		token, userID); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		insert into notifications.push_tokens (user_id, token, platform, token_kind)
		values ($1,$2,$3,$4)
		on conflict (user_id, token_kind) do update
		  set token = excluded.token, platform = excluded.platform, updated_at = now()`,
		userID, token, plat, kind)
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
			readAt    *time.Time
		)
		if err := rows.Scan(&n.ID, &n.UserID, &n.Kind, &n.Title, &n.Body, &data, &n.Status, &n.Attempts, &createdAt, &sentAt, &readAt); err != nil {
			return nil, err
		}
		if len(data) > 0 {
			n.Data = json.RawMessage(data)
		}
		n.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if sentAt != nil {
			n.SentAt = sentAt.UTC().Format(time.RFC3339)
		}
		if readAt != nil {
			n.ReadAt = readAt.UTC().Format(time.RFC3339)
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
