// Package media is the enterprise media registry context: the single SQL identity for an image whose
// bytes live in Cloudflare R2. It mints asset rows (DRAFT), confirms them (ACTIVE + owner link),
// resolves public CDN URLs in batch, and signs short-lived private GETs. Bytes never pass through the
// gateway — clients PUT/GET directly against R2 with presigned URLs (monolith-breakdown §1).
package media

import (
	"context"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Repo reads and writes media.assets.
type Repo struct {
	pool *db.Pool
}

// New returns a media registry repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const assetSelect = `
select id, owner_type, owner_id, kind::text, bucket, r2_key, mime, bytes,
       width, height, hash, status::text, created_by, created_at
from media.assets`

// Create inserts a DRAFT asset. When r2_key already exists (content-addressed dedup) the existing row is
// returned untouched, so the caller reuses one identity per distinct blob.
func (r *Repo) Create(ctx context.Context, a contracts.MediaAsset) (contracts.MediaAsset, error) {
	if r.pool == nil {
		return contracts.MediaAsset{}, fmt.Errorf("media: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		insert into media.assets
		  (id, owner_type, owner_id, kind, bucket, r2_key, mime, bytes, width, height, hash, status, created_by)
		values ($1,$2,$3,$4::asset_kind,$5,$6,$7,$8,$9,$10,$11,'DRAFT',$12)
		on conflict (r2_key) do update set updated_at = now()
		returning id, owner_type, owner_id, kind::text, bucket, r2_key, mime, bytes,
		          width, height, hash, status::text, created_by, created_at`,
		a.ID, a.OwnerType, a.OwnerID, a.Kind, a.Bucket, a.Key, a.Mime, a.Bytes,
		a.Width, a.Height, nullableString(a.Hash), a.CreatedBy)
	if err != nil {
		return contracts.MediaAsset{}, err
	}
	defer rows.Close()
	assets, err := scanAssets(rows)
	if err != nil {
		return contracts.MediaAsset{}, err
	}
	if len(assets) == 0 {
		return contracts.MediaAsset{}, fmt.Errorf("media: insert returned no row")
	}
	return assets[0], nil
}

// Confirm transitions a DRAFT to ACTIVE and links its owner. A non-admin may only confirm a row they
// created (created_by = actorID). Returns ok=false when the row is absent, not theirs, or not a DRAFT.
func (r *Repo) Confirm(ctx context.Context, id, ownerType, ownerID, actorID string, admin bool) (contracts.MediaAsset, bool, error) {
	if r.pool == nil {
		return contracts.MediaAsset{}, false, fmt.Errorf("media: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		update media.assets
		   set status = 'ACTIVE', owner_type = $2, owner_id = $3, updated_at = now()
		 where id = $1 and status = 'DRAFT' and ($4 or created_by = $5)
		 returning id, owner_type, owner_id, kind::text, bucket, r2_key, mime, bytes,
		           width, height, hash, status::text, created_by, created_at`,
		id, ownerType, ownerID, admin, actorID)
	if err != nil {
		return contracts.MediaAsset{}, false, err
	}
	defer rows.Close()
	assets, err := scanAssets(rows)
	if err != nil {
		return contracts.MediaAsset{}, false, err
	}
	if len(assets) == 0 {
		return contracts.MediaAsset{}, false, nil
	}
	return assets[0], true, nil
}

// ByID returns one asset by id.
func (r *Repo) ByID(ctx context.Context, id string) (contracts.MediaAsset, bool, error) {
	if r.pool == nil {
		return contracts.MediaAsset{}, false, fmt.Errorf("media: database not configured")
	}
	rows, err := r.pool.Query(ctx, assetSelect+` where id = $1`, id)
	if err != nil {
		return contracts.MediaAsset{}, false, err
	}
	defer rows.Close()
	assets, err := scanAssets(rows)
	if err != nil {
		return contracts.MediaAsset{}, false, err
	}
	if len(assets) == 0 {
		return contracts.MediaAsset{}, false, nil
	}
	return assets[0], true, nil
}

// ByKey returns one asset by its immutable r2_key (used to link an upload the client only knows by key).
func (r *Repo) ByKey(ctx context.Context, key string) (contracts.MediaAsset, bool, error) {
	if r.pool == nil {
		return contracts.MediaAsset{}, false, fmt.Errorf("media: database not configured")
	}
	rows, err := r.pool.Query(ctx, assetSelect+` where r2_key = $1`, key)
	if err != nil {
		return contracts.MediaAsset{}, false, err
	}
	defer rows.Close()
	assets, err := scanAssets(rows)
	if err != nil {
		return contracts.MediaAsset{}, false, err
	}
	if len(assets) == 0 {
		return contracts.MediaAsset{}, false, nil
	}
	return assets[0], true, nil
}

// Resolve returns ACTIVE assets for the given ids (public batch read), preserving no particular order.
func (r *Repo) Resolve(ctx context.Context, ids []string) ([]contracts.MediaAsset, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("media: database not configured")
	}
	if len(ids) == 0 {
		return []contracts.MediaAsset{}, nil
	}
	rows, err := r.pool.Query(ctx, assetSelect+` where id = any($1) and status = 'ACTIVE'`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAssets(rows)
}

// SetStatus transitions an asset's moderation status, scoped to the creator unless admin.
func (r *Repo) SetStatus(ctx context.Context, id, status, actorID string, admin bool) (contracts.MediaAsset, bool, error) {
	if r.pool == nil {
		return contracts.MediaAsset{}, false, fmt.Errorf("media: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		update media.assets set status = $2::asset_status, updated_at = now()
		 where id = $1 and ($3 or created_by = $4)
		 returning id, owner_type, owner_id, kind::text, bucket, r2_key, mime, bytes,
		           width, height, hash, status::text, created_by, created_at`,
		id, status, admin, actorID)
	if err != nil {
		return contracts.MediaAsset{}, false, err
	}
	defer rows.Close()
	assets, err := scanAssets(rows)
	if err != nil {
		return contracts.MediaAsset{}, false, err
	}
	if len(assets) == 0 {
		return contracts.MediaAsset{}, false, nil
	}
	return assets[0], true, nil
}

// Delete removes an asset row (GC), scoped to the creator unless admin. The R2 object is deleted by the
// caller/ops by key; this only drops the identity row.
func (r *Repo) Delete(ctx context.Context, id, actorID string, admin bool) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("media: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		delete from media.assets
		 where id = $1 and ($2 or created_by = $3)`, id, admin, actorID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func scanAssets(rows pgx.Rows) ([]contracts.MediaAsset, error) {
	out := []contracts.MediaAsset{}
	for rows.Next() {
		var (
			a         contracts.MediaAsset
			hash      *string
			createdAt time.Time
		)
		if err := rows.Scan(
			&a.ID, &a.OwnerType, &a.OwnerID, &a.Kind, &a.Bucket, &a.Key, &a.Mime, &a.Bytes,
			&a.Width, &a.Height, &hash, &a.Status, &a.CreatedBy, &createdAt,
		); err != nil {
			return nil, err
		}
		if hash != nil {
			a.Hash = *hash
		}
		a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, a)
	}
	return out, rows.Err()
}

func nullableString(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}
