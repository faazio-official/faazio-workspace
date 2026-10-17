// Media GC sweeper. Orphaned uploads are `media.assets` rows minted DRAFT at upload-url and never
// confirmed; their bytes sit in R2 with no owner. This worker reclaims them: for every DRAFT older
// than the retention TTL it deletes the R2 object, then drops the registry row. Bytes never pass
// through the gateway on the read/write paths — this is the one server-initiated object delete.
//
// The worker is provider-agnostic and testable: it depends on small interfaces (gcStore/gcSigner),
// so the loop is unit-tested with fakes and the real *Repo/*r2.Signer satisfy them in production.
// Reference: docs/architecture/db-schema.md §12.16, caching-cloudflare-valkey.md §5.
package media

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
)

const (
	// DefaultGCInterval is how often the background sweeper runs.
	DefaultGCInterval = 6 * time.Hour
	// DefaultDraftTTL is how long an unconfirmed upload survives before GC (generous: a slow seller
	// still has time to finish, but junk never accumulates).
	DefaultDraftTTL = 24 * time.Hour
	// gcBatch bounds one sweep pass so a backlog drains in chunks without a long DB lock.
	gcBatch = 200
)

// ErrGCUnavailable is returned by SweepOnce when the sweeper has no repo or signer configured.
var ErrGCUnavailable = errors.New("media: gc not configured")

// gcStore is the slice of Repo the sweeper needs.
type gcStore interface {
	StaleDrafts(ctx context.Context, before time.Time, limit int) ([]contracts.MediaAsset, error)
	Delete(ctx context.Context, id, actorID string, admin bool) (bool, error)
}

// gcSigner is the slice of r2.Signer the sweeper needs.
type gcSigner interface {
	Enabled() bool
	DeleteObject(ctx context.Context, bucket, key string) error
}

// Sweeper deletes orphaned DRAFT assets on an interval (and on the admin manual trigger).
type Sweeper struct {
	repo     gcStore
	signer   gcSigner
	interval time.Duration
	ttl      time.Duration
	batch    int
	logger   *slog.Logger
	now      func() time.Time
}

// NewSweeper builds a GC sweeper. repo/signer may be nil (SweepOnce returns ErrGCUnavailable).
func NewSweeper(repo gcStore, signer gcSigner, logger *slog.Logger) *Sweeper {
	if logger == nil {
		logger = slog.Default()
	}
	return &Sweeper{
		repo: repo, signer: signer,
		interval: DefaultGCInterval, ttl: DefaultDraftTTL, batch: gcBatch,
		logger: logger, now: time.Now,
	}
}

// Enabled reports whether the sweeper has both a store and an enabled signer.
func (s *Sweeper) Enabled() bool {
	return s != nil && s.repo != nil && s.signer != nil && s.signer.Enabled()
}

// SweepOnce reclaims one batch of stale DRAFT assets and returns how many row+object pairs were
// deleted. A per-asset delete error is logged and skipped (the row is left for the next pass); only a
// listing/context error aborts the pass.
func (s *Sweeper) SweepOnce(ctx context.Context) (int, error) {
	if !s.Enabled() {
		return 0, ErrGCUnavailable
	}
	drafts, err := s.repo.StaleDrafts(ctx, s.now().Add(-s.ttl), s.batch)
	if err != nil {
		return 0, err
	}
	deleted := 0
	for _, a := range drafts {
		if err := ctx.Err(); err != nil {
			return deleted, err
		}
		if err := s.signer.DeleteObject(ctx, a.Bucket, a.Key); err != nil {
			s.logger.Warn("media gc: r2 delete failed", "id", a.ID, "err", err)
			continue // leave the row so the next pass retries
		}
		ok, err := s.repo.Delete(ctx, a.ID, "", true)
		if err != nil {
			s.logger.Warn("media gc: row delete failed", "id", a.ID, "err", err)
			continue
		}
		if ok {
			deleted++
		}
	}
	return deleted, nil
}

// Run blocks until ctx is cancelled, sweeping each tick. Safe to call in a goroutine.
func (s *Sweeper) Run(ctx context.Context) {
	if !s.Enabled() {
		s.logger.Info("media gc disabled (r2 not configured)")
		return
	}
	s.logger.Info("media gc started", "interval", s.interval.String(), "draft_ttl", s.ttl.String())
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := s.SweepOnce(ctx)
			if err != nil {
				s.logger.Warn("media gc failed", "err", err)
			} else if n > 0 {
				s.logger.Info("media gc reclaimed", "count", n)
			}
		}
	}
}
