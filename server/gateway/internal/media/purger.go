// Media cache-purge worker. `media.assets` emits a `pg_notify('media_updated', …)` on every
// insert/update-of-status/r2_key and (via 0026) on delete. This worker LISTENs on a dedicated
// connection and, for a PUBLIC asset, purges its CDN URL so an immutable-key cache can still be
// invalidated on moderation/removal; it also drops the Valkey identity key (the handler does this on
// its own write paths — this covers out-of-band edits).
//
// Decoupled from the request path: an event emits, the worker purges. Delivery is best-effort (a lost
// NOTIFY or a disabled purger just means the content expires via its Cache Rule).
package media

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/faazio/server/gateway/internal/platform/r2"
)

// purgeReconnect is the backoff before re-establishing the LISTEN connection after an error.
const purgeReconnect = 5 * time.Second

// cdnPurger is the slice of cloudflare.Purger the worker needs (testable with a fake).
type cdnPurger interface {
	Enabled() bool
	PurgeURLs(ctx context.Context, urls []string) error
}

// PurgeWorker LISTENs for media change events and purges affected CDN URLs.
type PurgeWorker struct {
	pool   *db.Pool
	signer *r2.Signer
	purger cdnPurger
	cache  *cache.Cache
	logger *slog.Logger
}

// NewPurgeWorker builds the worker. Any nil dependency disables it (see Enabled).
func NewPurgeWorker(pool *db.Pool, signer *r2.Signer, purger cdnPurger, c *cache.Cache, logger *slog.Logger) *PurgeWorker {
	if logger == nil {
		logger = slog.Default()
	}
	return &PurgeWorker{pool: pool, signer: signer, purger: purger, cache: c, logger: logger}
}

// Enabled reports whether the worker has a DB + cache, an enabled signer and an enabled purger.
// Any nil/disabled dependency disables the worker so it never makes half-configured purge calls.
func (w *PurgeWorker) Enabled() bool {
	return w != nil && w.pool != nil && w.cache != nil && w.signer.Enabled() && w.purger != nil && w.purger.Enabled()
}

// Run blocks until ctx is cancelled, keeping a LISTEN connection alive and reconnecting with backoff.
// Safe to call in a goroutine.
func (w *PurgeWorker) Run(ctx context.Context) {
	if !w.Enabled() {
		w.logger.Info("media purge worker disabled (r2/cloudflare not configured)")
		return
	}
	for {
		if err := w.listen(ctx); err != nil {
			if ctx.Err() != nil {
				return
			}
			w.logger.Warn("media purge listen error", "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(purgeReconnect):
			}
			continue
		}
		return
	}
}

// listen holds a dedicated connection subscribed to `media_updated` and handles each notification.
func (w *PurgeWorker) listen(ctx context.Context) error {
	conn, err := w.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "listen media_updated"); err != nil {
		return err
	}
	w.logger.Info("media purge worker listening on media_updated")
	for {
		n, err := conn.Conn().WaitForNotification(ctx)
		if err != nil {
			return err
		}
		w.handle(ctx, n.Payload)
	}
}

// handle purges one event's CDN URL + Valkey identity. Payload shape (db-schema §12.16):
// {id,status,r2_key,kind} for insert/update, with an added "op":"DELETE" for deletes.
func (w *PurgeWorker) handle(ctx context.Context, payload string) {
	var p struct {
		ID     string `json:"id"`
		Status string `json:"status"`
		R2Key  string `json:"r2_key"`
		Kind   string `json:"kind"`
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return
	}
	if p.ID != "" {
		w.cache.Del(ctx, cache.MediaAsset(p.ID))
	}
	if p.Kind != "PUBLIC" || p.R2Key == "" {
		return // PRIVATE assets are never publicly cached
	}
	if p.Status == "DRAFT" {
		// A DRAFT has never been publicly served, so nothing is cached at its URL yet. Purging here
		// would waste a metered purge_cache call on every upload (mint → DRAFT). The Valkey identity
		// key was already dropped above. A rare ACTIVE → DRAFT flip just falls back to Cache-Rule TTL
		// expiry (best-effort purge contract, caching-cloudflare-valkey.md §9).
		return
	}
	url := w.signer.PublicURL(p.R2Key)
	if url == "" {
		return
	}
	purgeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := w.purger.PurgeURLs(purgeCtx, []string{url}); err != nil {
		w.logger.Warn("media purge failed", "id", p.ID, "err", err)
	}
}
