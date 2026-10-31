// Package categories owns the superadmin-controlled category taxonomy (taxonomy.categories): one
// parent/child tree shared by every sub-app (MART/FOOD/PHARMA). The gateway (service_role) is the
// only writer; shoppers and sellers read. See docs/architecture/monolith-breakdown.md §1.
package categories

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Category is one taxonomy.categories row.
type Category struct {
	ID          string  `json:"id"`
	App         string  `json:"app"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description,omitempty"`
	IconURL     string  `json:"iconUrl,omitempty"`
	ParentID    *string `json:"parentId"`
	SearchQuery string  `json:"searchQuery,omitempty"`
	IsActive    bool    `json:"isActive"`
	SortOrder   int64   `json:"sortOrder"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
	CreatedBy   string  `json:"createdBy"`
	UpdatedBy   string  `json:"updatedBy,omitempty"`
}

// Input is a create/update payload.
type Input struct {
	ID          string  `json:"id"`
	App         string  `json:"app"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	IconURL     string  `json:"iconUrl"`
	ParentID    *string `json:"parentId"`
	SearchQuery string  `json:"searchQuery"`
	SortOrder   int64   `json:"sortOrder"`
	IsActive    *bool   `json:"isActive"`
}

// ListOptions filters a category listing.
type ListOptions struct {
	App        string
	ParentID   *string // non-nil → children of that id; nil → no parent filter
	TopLevel   bool    // only rows with parent_id is null
	ActiveOnly bool
}

// Repo reads/writes taxonomy.categories.
type Repo struct{ pool *db.Pool }

// NewRepo returns a category repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const rowSelect = `select id, app::text, name, slug, coalesce(description, ''), coalesce(icon_url, ''),
	parent_id, coalesce(search_query, ''), is_active, sort_order,
	created_at::text, updated_at::text, created_by, coalesce(updated_by, '')`

func scanCategory(row pgx.Row) (Category, error) {
	var c Category
	err := row.Scan(&c.ID, &c.App, &c.Name, &c.Slug, &c.Description, &c.IconURL,
		&c.ParentID, &c.SearchQuery, &c.IsActive, &c.SortOrder,
		&c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy)
	return c, err
}

// List returns categories matching opts, ordered top-level-first by sort_order.
func (r *Repo) List(ctx context.Context, opts ListOptions) ([]Category, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("categories: database not configured")
	}
	rows, err := r.pool.Query(ctx, rowSelect+`
		  from taxonomy.categories
		 where ($1 = '' or app::text = $1)
		   and ($2::text is null or parent_id = $2)
		   and (not $3 or (parent_id is null))
		   and (not $4 or is_active)
		 order by app, sort_order, lower(name)`,
		opts.App, opts.ParentID, opts.TopLevel, opts.ActiveOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Category{}
	for rows.Next() {
		c, err := scanCategory(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// Get returns one category by id.
func (r *Repo) Get(ctx context.Context, id string) (Category, error) {
	if r.pool == nil {
		return Category{}, fmt.Errorf("categories: database not configured")
	}
	c, err := scanCategory(r.pool.QueryRow(ctx, rowSelect+` from taxonomy.categories where id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, ErrNotFound
		}
		return Category{}, err
	}
	return c, nil
}

// ErrNotFound is returned when a category id does not exist.
var ErrNotFound = errors.New("categories: not found")

// Create inserts a new category. When in.ID is empty a stable `cat-<shortid>` id is minted.
func (r *Repo) Create(ctx context.Context, in Input, actor string) (Category, error) {
	if r.pool == nil {
		return Category{}, fmt.Errorf("categories: database not configured")
	}
	id := strings.TrimSpace(in.ID)
	if id == "" {
		id = "cat-" + shortID()
	}
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		slug = slugify(in.Name)
	}
	c, err := scanCategory(r.pool.QueryRow(ctx, `
		insert into taxonomy.categories
		  (id, app, name, slug, description, icon_url, parent_id, search_query, is_active, sort_order, created_by, updated_by)
		values ($1, $2::app_brand, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
		returning `+`id, app::text, name, slug, coalesce(description, ''), coalesce(icon_url, ''),
			parent_id, coalesce(search_query, ''), is_active, sort_order,
			created_at::text, updated_at::text, created_by, coalesce(updated_by, '')`,
		id, in.App, in.Name, slug, nullStr(in.Description), nullStr(in.IconURL),
		in.ParentID, nullStr(in.SearchQuery), active, in.SortOrder, actor))
	if err != nil {
		return Category{}, err
	}
	return c, nil
}

// Update patches an existing category. A nil IsActive leaves the flag unchanged.
func (r *Repo) Update(ctx context.Context, id string, in Input, actor string) (Category, error) {
	if r.pool == nil {
		return Category{}, fmt.Errorf("categories: database not configured")
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		slug = slugify(in.Name)
	}
	c, err := scanCategory(r.pool.QueryRow(ctx, `
		update taxonomy.categories
		   set app = $2::app_brand,
		       name = $3,
		       slug = $4,
		       description = $5,
		       icon_url = $6,
		       parent_id = $7,
		       search_query = $8,
		       is_active = coalesce($9, is_active),
		       sort_order = $10,
		       updated_by = $11,
		       updated_at = now()
		 where id = $1
		returning `+`id, app::text, name, slug, coalesce(description, ''), coalesce(icon_url, ''),
			parent_id, coalesce(search_query, ''), is_active, sort_order,
			created_at::text, updated_at::text, created_by, coalesce(updated_by, '')`,
		id, in.App, in.Name, slug, nullStr(in.Description), nullStr(in.IconURL),
		in.ParentID, nullStr(in.SearchQuery), in.IsActive, in.SortOrder, actor))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, ErrNotFound
		}
		return Category{}, err
	}
	return c, nil
}

// Deactivate soft-deletes a category (is_active = false) so existing sellers/products that reference
// it are never orphaned. Returns false when the id does not exist.
func (r *Repo) Deactivate(ctx context.Context, id, actor string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("categories: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update taxonomy.categories
		   set is_active = false, updated_by = $2, updated_at = now()
		 where id = $1 and is_active`, id, actor)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func nullStr(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

// slugify mirrors the seed's slug rule (lowercase, non-alphanumerics → '-').
func slugify(s string) string {
	var b strings.Builder
	prevDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		default:
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
