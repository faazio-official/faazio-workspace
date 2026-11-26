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
	"sort"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/faazio/server/gateway/internal/platform/taxmath"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Category is one taxonomy.categories row.
type Category struct {
	ID             string  `json:"id"`
	App            string  `json:"app"`
	Name           string  `json:"name"`
	Slug           string  `json:"slug"`
	IconURL        string  `json:"iconUrl,omitempty"`
	ParentID       *string `json:"parentId"`
	SearchQuery    string  `json:"searchQuery,omitempty"`
	IsActive       bool    `json:"isActive"`
	ShowOnHomeRail bool    `json:"showOnHomeRail"`
	SortOrder      int64   `json:"sortOrder"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
	CreatedBy      string  `json:"createdBy"`
	UpdatedBy      string  `json:"updatedBy,omitempty"`
	// Tamil display name (0107). Empty means "not translated" → the app falls back to English.
	NameTA string `json:"nameTa,omitempty"`
	// PriceTierSet selects the customer price-filter buckets for this category (0143):
	// standard (100/200), premium (200/350) or snack (100/250).
	PriceTierSet string `json:"priceTierSet,omitempty"`
	// HeaderLabels are the curated header lists this row belongs to (0115):
	// MAIN_APP_HEADER | MART | FOOD | PHARMA. `App` is always one of them.
	HeaderLabels []string `json:"headerLabels"`
	// GST is the mandatory per-category tax (0118–0120). Nil only for a legacy row the backfill has
	// not reached — the write path always sets it.
	GSTRatePct          int    `json:"gstRatePct"`
	GSTRateCategoryID   string `json:"gstRateCategoryId,omitempty"`
	GSTRateCategoryName string `json:"gstRateCategoryName,omitempty"`
	// ProductCount is how many live listings link directly to this node. A delete needs a move
	// target as soon as this node or any descendant reports a non-zero count.
	ProductCount int64 `json:"productCount"`
	// DeletedAt/DeleteReason/PurgeAt describe a row in the trash (0136). Empty on a live row.
	// A delete moves the node and its whole subtree here; it is restorable for CategoryTrashWindow.
	DeletedAt    string `json:"deletedAt,omitempty"`
	DeleteReason string `json:"deleteReason,omitempty"`
	PurgeAt      string `json:"purgeAt,omitempty"`
}

// CategoryTrashWindow is how long a deleted category stays restorable before the purger removes it
// for good. It mirrors the credential trash (0128), the district trash (0134) and the catalogue
// product trash (0089).
const CategoryTrashWindow = 7 * 24 * time.Hour

// SubCategoryInput is one inline sub-category created/updated with its parent in the portal sheet.
type SubCategoryInput struct {
	// ID links an existing child on update. Empty on create mints a new `cat-<shortid>`.
	ID string `json:"id"`
	// App defaults to the parent's app when empty (a header-only parent carries header-only children).
	App               string `json:"app"`
	Name              string `json:"name"`
	NameTA            string `json:"nameTa"`
	SearchQuery       string `json:"searchQuery"`
	IconURL           string `json:"iconUrl"`
	SortOrder         int64  `json:"sortOrder"`
	IsActive          *bool  `json:"isActive"`
	GSTRateCategoryID string `json:"gstRateCategoryId"`
	GSTRatePct        int    `json:"gstRatePct"`
}

// Input is a create/update payload.
type Input struct {
	ID             string  `json:"id"`
	App            string  `json:"app"`
	Name           string  `json:"name"`
	Slug           string  `json:"slug"`
	IconURL        string  `json:"iconUrl"`
	ParentID       *string `json:"parentId"`
	SearchQuery    string  `json:"searchQuery"`
	SortOrder      int64   `json:"sortOrder"`
	IsActive       *bool   `json:"isActive"`
	ShowOnHomeRail *bool   `json:"showOnHomeRail"` // nil on update = unchanged
	NameTA         string  `json:"nameTa"`
	// HeaderLabels replaces the curated header lists when non-nil (0115). nil on update = unchanged.
	// MAIN_APP_HEADER is also mirrored onto taxonomy.categories.show_on_home_rail.
	HeaderLabels *[]string `json:"headerLabels"`
	// GSTRateCategoryID is the mandatory GST rate pick (0118). The slab's own percentage is copied,
	// never the caller's number. GSTRatePct is accepted for FOOD/display only and is ignored on write.
	GSTRateCategoryID string `json:"gstRateCategoryId"`
	GSTRatePct        int    `json:"gstRatePct"`
	// SubCategories are the inline child rows (Option B: each child has its own mandatory GST pick).
	// nil on update = children unchanged; an array = replace the parent's child set.
	SubCategories *[]SubCategoryInput `json:"subCategories"`
}

// ListOptions filters a category listing.
type ListOptions struct {
	App      string
	ParentID *string // non-nil → children of that id; nil → no parent filter
	TopLevel bool    // only rows with parent_id is null
	// Header filters to rows tagged with that curated header list (0115):
	// MAIN_APP_HEADER | MART | FOOD | PHARMA. Empty → no header filter.
	Header     string
	ActiveOnly bool
	// Trash restricts the result to soft-deleted rows (the portal's Deleted tab) when true, and
	// excludes them when false — a live read never sees a trashed row.
	Trash bool
	// HomeRailOnly restricts the result to the shared main app header list. FOOD is excluded here as
	// well as on write, so a legacy row flagged before the rule existed can never surface a FOOD chip.
	HomeRailOnly bool
}

// Curated header labels accepted by taxonomy.category_headers.header (0115).
const (
	HeaderMainApp = "MAIN_APP_HEADER"
	HeaderMart    = "MART"
	HeaderFood    = "FOOD"
	HeaderPharma  = "PHARMA"
)

// ValidHeader reports whether s is an accepted header label.
func ValidHeader(s string) bool {
	switch s {
	case HeaderMainApp, HeaderMart, HeaderFood, HeaderPharma:
		return true
	}
	return false
}

// primaryHeader maps a category's app onto its primary header label. MAIN_APP_HEADER is its own
// primary label (a header-only category belongs to no vendor sub-app).
func primaryHeader(app string) string {
	switch app {
	case HeaderMart, HeaderFood, HeaderPharma, HeaderMainApp:
		return app
	}
	return ""
}

// Repo reads/writes taxonomy.categories.
type Repo struct{ pool *db.Pool }

// NewRepo returns a category repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// querier is satisfied by both *pgxpool.Pool and pgx.Tx so the read helper can run inside a write
// transaction and outside one.
type querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// headerLabelsSelect aggregates the row's curated header labels. It references the target table by
// name so the same expression works in every SELECT over taxonomy.categories.
const headerLabelsSelect = `coalesce((select array_agg(h.header order by h.header)
	from taxonomy.category_headers h
   where h.category_id = taxonomy.categories.id), '{}'::text[])`

// gstSelect pulls the mandatory per-category GST link (0119) without a join fan-out.
const gstSelect = `coalesce((select g.gst_rate_pct from tax.category_gst_rates g
   where g.category_id = taxonomy.categories.id), 5),
 coalesce((select g.gst_rate_category_id from tax.category_gst_rates g
   where g.category_id = taxonomy.categories.id), ''),
 coalesce((select r.name from tax.category_gst_rates g
   join tax.gst_rate_categories r on r.id = g.gst_rate_category_id
   where g.category_id = taxonomy.categories.id), '')`

const rowSelect = `select id, app::text, name, slug, coalesce(icon_url, ''),
	parent_id, coalesce(search_query, ''), is_active, show_on_home_rail, sort_order,
	created_at::text, updated_at::text, created_by, coalesce(updated_by, ''),
	coalesce(name_ta, ''), coalesce(price_tier_set, 'standard'), ` + headerLabelsSelect + `, ` + gstSelect + `,
	(select count(*) from catalog.products p
	  where p.deleted_at is null and p.taxonomy_category_id = taxonomy.categories.id),
	deleted_at, delete_reason`

func scanCategory(row pgx.Row) (Category, error) {
	var c Category
	var deletedAt *time.Time
	err := row.Scan(&c.ID, &c.App, &c.Name, &c.Slug, &c.IconURL,
		&c.ParentID, &c.SearchQuery, &c.IsActive, &c.ShowOnHomeRail, &c.SortOrder,
		&c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy, &c.NameTA, &c.PriceTierSet,
		&c.HeaderLabels, &c.GSTRatePct, &c.GSTRateCategoryID, &c.GSTRateCategoryName,
		&c.ProductCount, &deletedAt, &c.DeleteReason)
	if c.HeaderLabels == nil {
		c.HeaderLabels = []string{}
	}
	if deletedAt != nil {
		c.DeletedAt = deletedAt.UTC().Format(time.RFC3339)
		c.PurgeAt = deletedAt.Add(CategoryTrashWindow).UTC().Format(time.RFC3339)
	}
	return c, err
}

// List returns categories matching opts, ordered top-level-first by sort_order. A trashed row is
// excluded unless opts.Trash asks for the trash listing.
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
		   and ($5::text = '' or exists (
		         select 1 from taxonomy.category_headers h
		          where h.category_id = taxonomy.categories.id and h.header = $5))
		   and (not $6 or ((show_on_home_rail or exists (
		         select 1 from taxonomy.category_headers h
		          where h.category_id = taxonomy.categories.id
		            and h.header = 'MAIN_APP_HEADER'))
		         and app::text <> 'FOOD'
		         -- A header-only sub-category is reached through its parent's drill-in, never as a
		         -- sibling chip on the rail.
		         and not (app::text = 'MAIN_APP_HEADER' and parent_id is not null)))
		   and (case when $7 then
		         deleted_at is not null
		         -- Only the root of each trashed subtree is listed (its parent is live or null), so a
		         -- restore/purge always acts on one coherent subtree and bulk selection never overlaps.
		         and not exists (
		               select 1 from taxonomy.categories p
		                where p.id = taxonomy.categories.parent_id and p.deleted_at is not null)
		        else deleted_at is null end)
		 order by app, sort_order, lower(name)`,
		opts.App, opts.ParentID, opts.TopLevel, opts.ActiveOnly, opts.Header, opts.HomeRailOnly,
		opts.Trash)
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
	return getCategory(ctx, r.pool, id)
}

func getCategory(ctx context.Context, q querier, id string) (Category, error) {
	c, err := scanCategory(q.QueryRow(ctx, rowSelect+` from taxonomy.categories where id = $1`, id))
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

// ErrDuplicate is returned when a create re-uses an existing category id.
var ErrDuplicate = errors.New("categories: duplicate id")

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
	labels, showOnRail := resolveHeaderLabels(in.App, in.HeaderLabels, in.ShowOnHomeRail, nil)

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Category{}, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if _, err := tx.Exec(ctx, `
		insert into taxonomy.categories
		  (id, app, name, slug, icon_url, parent_id, search_query, is_active,
		   show_on_home_rail, sort_order, created_by, updated_by, name_ta)
		values ($1, $2::app_brand, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12)`,
		id, in.App, in.Name, slug, nullStr(in.IconURL),
		in.ParentID, nullStr(in.SearchQuery), active, showOnRail, in.SortOrder, actor,
		strings.TrimSpace(in.NameTA)); err != nil {
		if isUniqueViolation(err) {
			return Category{}, ErrDuplicate
		}
		return Category{}, err
	}
	if err := replaceHeaderLabels(ctx, tx, id, labels); err != nil {
		return Category{}, err
	}
	if err := setCategoryGST(ctx, tx, id, in.GSTRateCategoryID, in.App, actor); err != nil {
		return Category{}, err
	}
	if in.SubCategories != nil {
		if err := replaceSubCategories(ctx, tx, id, in.App, *in.SubCategories, actor); err != nil {
			return Category{}, err
		}
	}
	c, err := getCategory(ctx, tx, id)
	if err != nil {
		return Category{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Category{}, err
	}
	return c, nil
}

// Update patches an existing category. A nil IsActive/ShowOnHomeRail/HeaderLabels leaves that field
// unchanged (the primary app label still follows a changed App).
func (r *Repo) Update(ctx context.Context, id string, in Input, actor string) (Category, error) {
	if r.pool == nil {
		return Category{}, fmt.Errorf("categories: database not configured")
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		slug = slugify(in.Name)
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Category{}, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	existing, err := getCategory(ctx, tx, id)
	if err != nil {
		return Category{}, err
	}
	// A nil ParentID on update means "unchanged" — the portal no longer edits the parent, so a plain
	// name/GST edit must never detach an existing child into a top-level row.
	parentID := in.ParentID
	if parentID == nil {
		parentID = existing.ParentID
	}
	// An explicit HeaderLabels list wins; the legacy rail flag only participates when the caller set
	// it explicitly, or when neither field was sent ("unchanged").
	var rail *bool
	switch {
	case in.ShowOnHomeRail != nil:
		rail = in.ShowOnHomeRail
	case in.HeaderLabels == nil:
		rail = &existing.ShowOnHomeRail
	}
	labels, showOnRail := resolveHeaderLabels(in.App, in.HeaderLabels, rail, existing.HeaderLabels)

	tag, err := tx.Exec(ctx, `
		update taxonomy.categories
		   set app = $2::app_brand,
		       name = $3,
		       slug = $4,
		       icon_url = $5,
		       parent_id = $6,
		       search_query = $7,
		       is_active = coalesce($8, is_active),
		       show_on_home_rail = $9,
		       sort_order = $10,
		       updated_by = $11,
		       name_ta = $12,
		       updated_at = now()
		 where id = $1`,
		id, in.App, in.Name, slug, nullStr(in.IconURL),
		parentID, nullStr(in.SearchQuery), in.IsActive, showOnRail, in.SortOrder, actor,
		strings.TrimSpace(in.NameTA))
	if err != nil {
		return Category{}, err
	}
	if tag.RowsAffected() == 0 {
		return Category{}, ErrNotFound
	}
	if err := replaceHeaderLabels(ctx, tx, id, labels); err != nil {
		return Category{}, err
	}
	// A nil GSTRateCategoryID on update leaves the existing rate (a partial patch); the handler makes
	// it mandatory on the portal path by always sending one.
	if strings.TrimSpace(in.GSTRateCategoryID) != "" {
		if err := setCategoryGST(ctx, tx, id, in.GSTRateCategoryID, in.App, actor); err != nil {
			return Category{}, err
		}
	}
	if in.SubCategories != nil {
		if err := replaceSubCategories(ctx, tx, id, in.App, *in.SubCategories, actor); err != nil {
			return Category{}, err
		}
	}
	c, err := getCategory(ctx, tx, id)
	if err != nil {
		return Category{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Category{}, err
	}
	return c, nil
}

// setCategoryGST links a category to the picked slab. The slab's own percentage is copied, never a
// caller-supplied number, so checkout and the portal can never disagree. A FOOD category is always
// pinned to a 5% food slab (policy: all food is 5%), whatever slab the caller names.
func setCategoryGST(ctx context.Context, tx pgx.Tx, id, rateCategoryID, app, actor string) error {
	slab := strings.TrimSpace(rateCategoryID)
	var (
		pct    int
		slabID string
		err    error
	)
	if app == HeaderFood {
		err = tx.QueryRow(ctx, `
			select id, gst_rate_pct from tax.gst_rate_categories
			 where sector = 'FOOD'::app_brand and gst_rate_pct = $1 and is_active
			 order by (id = 'gst-food-standard') desc, id
			 limit 1`, taxmath.FoodGSTRate).Scan(&slabID, &pct)
		if err != nil {
			return fmt.Errorf("categories: no %d%% FOOD GST slab configured: %w", taxmath.FoodGSTRate, err)
		}
	} else {
		if slab == "" {
			return fmt.Errorf("categories: a GST rate category is required")
		}
		err = tx.QueryRow(ctx, `
			select id, gst_rate_pct from tax.gst_rate_categories
			 where id = $1 and is_active`, slab).Scan(&slabID, &pct)
		if err != nil {
			return fmt.Errorf("categories: unknown GST rate category %q: %w", slab, err)
		}
	}
	_, err = tx.Exec(ctx, `
		insert into tax.category_gst_rates (category_id, gst_rate_pct, gst_rate_category_id, updated_by)
		values ($1, $2, $3, $4)
		on conflict (category_id) do update
		  set gst_rate_pct = excluded.gst_rate_pct,
		      gst_rate_category_id = excluded.gst_rate_category_id,
		      is_active = true,
		      updated_by = excluded.updated_by,
		      updated_at = now()`,
		id, pct, slabID, actor)
	return err
}

// replaceSubCategories rewrites a parent's inline child set (Option B: every child carries its own
// mandatory GST pick). Children the payload omits are deactivated, never deleted, so products and
// sellers that reference them keep a valid taxonomy row. Each child inherits the parent's app.
func replaceSubCategories(ctx context.Context, tx pgx.Tx, parentID, app string, subs []SubCategoryInput, actor string) error {
	kept := make([]string, 0, len(subs))
	for i, sub := range subs {
		name := strings.TrimSpace(sub.Name)
		if name == "" {
			return fmt.Errorf("categories: sub-category name is required")
		}
		childApp := strings.ToUpper(strings.TrimSpace(sub.App))
		if childApp == "" {
			childApp = app
		}
		id := strings.TrimSpace(sub.ID)
		if id == "" {
			id = "cat-" + shortID()
		}
		slug := slugify(name)
		active := true
		if sub.IsActive != nil {
			active = *sub.IsActive
		}
		// An inline child is reached through its parent's drill-in, not as its own rail chip, so it
		// carries only its primary app label and never mirrors onto show_on_home_rail.
		labels := []string{childApp}
		if _, err := tx.Exec(ctx, `
			insert into taxonomy.categories
			  (id, app, name, slug, icon_url, parent_id, search_query, is_active,
			   show_on_home_rail, sort_order, created_by, updated_by, name_ta)
			values ($1, $2::app_brand, $3, $4, $5, $6, $7, $8,
			        false, $9, $10, $10, $11)
			on conflict (id) do update
			  set app = excluded.app,
			      name = excluded.name,
			      slug = excluded.slug,
			      icon_url = excluded.icon_url,
			      parent_id = excluded.parent_id,
			      search_query = excluded.search_query,
			      is_active = excluded.is_active,
			      sort_order = excluded.sort_order,
			      updated_by = excluded.updated_by,
			      name_ta = excluded.name_ta,
			      updated_at = now()`,
			id, childApp, name, slug, nullStr(strings.TrimSpace(sub.IconURL)), parentID,
			nullStr(strings.TrimSpace(sub.SearchQuery)), active,
			int64(i), actor, strings.TrimSpace(sub.NameTA)); err != nil {
			return err
		}
		if err := replaceHeaderLabels(ctx, tx, id, labels); err != nil {
			return err
		}
		if err := setCategoryGST(ctx, tx, id, sub.GSTRateCategoryID, childApp, actor); err != nil {
			return err
		}
		kept = append(kept, id)
	}
	// `kept` is a non-nil slice, so an explicit empty list (`subCategories: []`) deactivates the whole
	// previous child set — the rows stay for reference resolution.
	_, err := tx.Exec(ctx, `
		update taxonomy.categories
		   set is_active = false, updated_by = $2, updated_at = now()
		 where parent_id = $1 and is_active and not (id = any($3))`, parentID, actor, kept)
	return err
}

// Deactivate soft-hides a category (is_active = false) so existing sellers/products that reference
// it are never orphaned. It never touches the trash: a deactivated row stays live. Idempotent: a
// repeat deactivate of a live-or-already-hidden row still returns true; false only when the id does
// not exist at all.
func (r *Repo) Deactivate(ctx context.Context, id, actor string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("categories: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update taxonomy.categories
		   set is_active = false, updated_by = $2, updated_at = now()
		 where id = $1 and deleted_at is null`, id, actor)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// SetActive flips the plain hide flag (is_active) without touching the trash or descendants. It is
// the table's inline Active/Inactive switch: a hidden row stays visible in the admin list and keeps
// resolving for existing sellers/products. A trashed row is refused (restore it first).
func (r *Repo) SetActive(ctx context.Context, id string, active bool, actor string) (Category, error) {
	if r.pool == nil {
		return Category{}, fmt.Errorf("categories: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update taxonomy.categories
		   set is_active = $2, updated_by = $3, updated_at = now()
		 where id = $1 and deleted_at is null`, id, active, actor)
	if err != nil {
		return Category{}, err
	}
	if tag.RowsAffected() == 0 {
		return Category{}, ErrCategoryNotFound
	}
	return r.Get(ctx, id)
}

// Category delete contract. A delete moves the row **and its whole subtree** to the trash
// (deleted_at + is_active = false), so a hidden parent never leaves a live child behind and the whole
// subtree comes back on restore. Listings that point at a node in that subtree are never orphaned:
// the caller must name a `moveTo` sibling-level category, and every affected listing is re-linked to
// that destination's drill-in leaf in the same transaction.
var (
	// ErrCategoryNotFound means the id does not exist (or is not in the trash for a restore/purge).
	ErrCategoryNotFound = errors.New("categories: not found")
	// ErrCategoryHasProducts means listings still live in the subtree and no move target was given.
	ErrCategoryHasProducts = errors.New("categories: listings must be moved first")
	// ErrInvalidMoveTarget means the destination is absent, inactive, another app, inside the
	// subtree being deleted, or at a different tree level than the category being deleted.
	ErrInvalidMoveTarget = errors.New("categories: invalid move target")
	// ErrTrashExpired means the 7-day undo window has closed (the row is purged instead).
	ErrTrashExpired = errors.New("categories: restore window closed")
	// ErrStillReferenced means a purge was refused because listings, stores or menus still point at
	// the trashed subtree.
	ErrStillReferenced = errors.New("categories: still referenced")
)

// DeleteResult reports what one category deletion trashed and re-linked.
type DeleteResult struct {
	ID string `json:"id"`
	// Trashed is the number of taxonomy rows moved to the trash (the category plus its descendants).
	Trashed int64 `json:"trashed"`
	// MovedProducts is the number of listings re-linked to the destination leaf.
	MovedProducts int64 `json:"movedProducts"`
	// TargetID / TargetName identify the drill-in leaf the listings moved onto (empty when none).
	TargetID   string `json:"targetId,omitempty"`
	TargetName string `json:"targetName,omitempty"`
}

// subtreeSQL walks one category's descendants inclusively. `$1` is the root id.
const subtreeSQL = `
	with recursive sub as (
	  select c.id, c.parent_id, c.name, c.sort_order
	    from taxonomy.categories c
	   where c.id = $1
	  union all
	  select c.id, c.parent_id, c.name, c.sort_order
	    from taxonomy.categories c
	    join sub on c.parent_id = sub.id
	)
	select id, parent_id, name, sort_order from sub`

// Delete moves one category plus everything under it to the trash (0136). When listings point at any
// node in that subtree the caller must pass moveTo — a live sibling-level category — and each listing
// is re-linked (and re-labelled) onto that destination's drill-in leaf.
//
// Level discipline: a top-level category may only be merged into another top-level category, and a
// child may only be merged into another child, so a deletion can never push products across tree
// levels. The destination is reduced to an ACTIVE LEAF (itself when childless, otherwise its first
// active descendant leaf by sort order — the same "representative leaf" rule 0094 uses) because the
// catalog only accepts leaves as a product's taxonomy link.
//
// Returns ErrCategoryHasProducts when listings remain and moveTo is empty, so the portal can prompt
// for a destination instead of silently dropping the mapping.
func (r *Repo) Delete(ctx context.Context, id, moveTo, reason, actor string) (DeleteResult, error) {
	var out DeleteResult
	if r.pool == nil {
		return out, fmt.Errorf("categories: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// 1. The node being deleted (row lock so a concurrent edit cannot move it mid-transaction).
	var (
		app      string
		parentID *string
		deleted  *time.Time
	)
	if err := tx.QueryRow(ctx, `
		select app::text, parent_id, deleted_at
		  from taxonomy.categories
		 where id = $1
		 for update`, id).Scan(&app, &parentID, &deleted); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return out, ErrCategoryNotFound
		}
		return out, err
	}
	// An already-trashed row is never trashed twice: the portal lists it under Deleted, where the
	// only actions are restore and delete-forever.
	if deleted != nil {
		return out, ErrCategoryNotFound
	}

	// 2. The subtree ids, used for both the product sweep and the deactivation.
	rows, err := tx.Query(ctx, subtreeSQL, id)
	if err != nil {
		return out, err
	}
	subtree := make([]string, 0, 8)
	for rows.Next() {
		var subID string
		var subParent *string
		var subName string
		var subSort int64
		if err := rows.Scan(&subID, &subParent, &subName, &subSort); err != nil {
			rows.Close()
			return out, err
		}
		subtree = append(subtree, subID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, err
	}

	// 3. Listings that would be orphaned. Only explicit taxonomy links count: a coarse display label
	// shares a name with a node sometimes, but it was never a drill-in membership.
	var affected int64
	if err := tx.QueryRow(ctx, `
		select count(*) from catalog.products
		 where deleted_at is null and taxonomy_category_id = any($1)`, subtree).Scan(&affected); err != nil {
		return out, err
	}

	moveTo = strings.TrimSpace(moveTo)
	if affected > 0 && moveTo == "" {
		return out, ErrCategoryHasProducts
	}

	if moveTo != "" {
		// 4. Validate the destination: same app, same tree level, not inside the subtree, active.
		var (
			dstApp    string
			dstParent *string
			dstActive bool
		)
		if err := tx.QueryRow(ctx, `
			select app::text, parent_id, is_active
			  from taxonomy.categories
			 where id = $1`, moveTo).Scan(&dstApp, &dstParent, &dstActive); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return out, ErrInvalidMoveTarget
			}
			return out, err
		}
		if !dstActive || dstApp != app {
			return out, ErrInvalidMoveTarget
		}
		// Same level: both top-level, or both children. `parentID == nil` is the level marker.
		if (dstParent == nil) != (parentID == nil) {
			return out, ErrInvalidMoveTarget
		}
		for _, subID := range subtree {
			if subID == moveTo {
				return out, ErrInvalidMoveTarget
			}
		}

		// 5. Reduce the destination to an ACTIVE LEAF (the catalog's only legal product target).
		leafID, leafName, err := resolveLeaf(ctx, tx, moveTo)
		if err != nil {
			return out, err
		}

		tag, err := tx.Exec(ctx, `
			update catalog.products
			   set category             = $2,
			       taxonomy_category_id = $3,
			       updated_at           = now()
			 where deleted_at is null
			   and taxonomy_category_id = any($1)`, subtree, leafName, leafID)
		if err != nil {
			return out, err
		}
		out.MovedProducts = tag.RowsAffected()
		out.TargetID = leafID
		out.TargetName = leafName
	}

	// 6. Move the node and everything beneath it to the trash in one statement. is_active is cleared
	// too so a row trashed before 0136 (or a leftover reference) never reads as live.
	tag, err := tx.Exec(ctx, `
		update taxonomy.categories
		   set is_active = false, deleted_at = now(), delete_reason = $3,
		       updated_by = $2, updated_at = now()
		 where id = any($1)`, subtree, actor, strings.TrimSpace(reason))
	if err != nil {
		return out, err
	}
	out.ID = id
	out.Trashed = tag.RowsAffected()

	if err := tx.Commit(ctx); err != nil {
		return out, err
	}
	return out, nil
}

// Restore clears the trash flag of one node and every descendant trashed with it. The subtree comes
// back DEACTIVATED (is_active stays false), so the operator re-enables it deliberately — the same
// contract as a restored credential or district. When the id is a descendant of a trashed row the
// topmost trashed ancestor is restored instead, so a child can never come back under a trashed
// parent. A row past the undo window is purged instead and reported as ErrTrashExpired.
func (r *Repo) Restore(ctx context.Context, id, actor string) (Category, error) {
	if r.pool == nil {
		return Category{}, fmt.Errorf("categories: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Category{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var deletedAt *time.Time
	var root string
	// Walk up from the row: the trashed rows form a contiguous run, so the topmost trashed ancestor
	// (largest depth) is the restore root. A live parent ends the run.
	if err := tx.QueryRow(ctx, `
		with recursive chain as (
		  select c.id, c.parent_id, c.deleted_at, 0 as depth
		    from taxonomy.categories c where c.id = $1
		  union all
		  select c.id, c.parent_id, c.deleted_at, chain.depth + 1
		    from taxonomy.categories c join chain on chain.parent_id = c.id
		)
		select coalesce((select ch.id from chain ch
		                  where ch.deleted_at is not null
		                  order by ch.depth desc limit 1), ''),
		       (select ch.deleted_at from chain ch where ch.depth = 0)`, id).
		Scan(&root, &deletedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, ErrCategoryNotFound
		}
		return Category{}, err
	}
	if deletedAt == nil || root == "" {
		return Category{}, ErrCategoryNotFound
	}
	if time.Since(*deletedAt) > CategoryTrashWindow {
		if _, err := purgeTrashedSubtree(ctx, tx, root); err != nil {
			return Category{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return Category{}, err
		}
		return Category{}, ErrTrashExpired
	}

	if _, err := tx.Exec(ctx, `
		with recursive sub as (
		  select c.id from taxonomy.categories c where c.id = $1
		  union all
		  select c.id from taxonomy.categories c join sub on c.parent_id = sub.id
		)
		update taxonomy.categories
		   set deleted_at = null, delete_reason = '', updated_by = $2, updated_at = now()
		 where id in (select id from sub)`, root, actor); err != nil {
		return Category{}, err
	}
	c, err := getCategory(ctx, tx, root)
	if err != nil {
		return Category{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Category{}, err
	}
	return c, nil
}

// PurgeResult reports what one permanent delete removed.
type PurgeResult struct {
	ID       string `json:"id"`
	Purged   int64  `json:"purged"`
	PurgeAll bool   `json:"purgeAll"`
}

// PurgeOne permanently removes one trashed subtree now (the console's "delete forever"). A live row,
// a row still inside the window acted on by an operator, or a subtree still referenced by a listing,
// store or menu is refused with ErrCategoryNotFound / ErrStillReferenced. ErrTrashExpired is never
// returned here: an operator may purge early.
func (r *Repo) PurgeOne(ctx context.Context, id string) (PurgeResult, error) {
	var out PurgeResult
	if r.pool == nil {
		return out, fmt.Errorf("categories: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var deletedAt *time.Time
	if err := tx.QueryRow(ctx, `
		select deleted_at from taxonomy.categories where id = $1 for update`, id).
		Scan(&deletedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return out, ErrCategoryNotFound
		}
		return out, err
	}
	if deletedAt == nil {
		return out, ErrCategoryNotFound
	}
	n, err := purgeTrashedSubtree(ctx, tx, id)
	if err != nil {
		return out, err
	}
	if err := tx.Commit(ctx); err != nil {
		return out, err
	}
	return PurgeResult{ID: id, Purged: n}, nil
}

// purgeTrashedSubtree hard-deletes a trashed subtree bottom-up inside tx. Every row must be trashed
// and unreferenced: a listing, store or menu still pointing at any node refuses the whole purge so a
// "delete forever" can never orphan a reference. Rows are removed children-first so the self-FK on
// parent_id is satisfied. Returns the number of rows removed.
func purgeTrashedSubtree(ctx context.Context, tx pgx.Tx, id string) (int64, error) {
	var live, referenced int64
	if err := tx.QueryRow(ctx, `
		with recursive sub as (
		  select c.id, c.deleted_at from taxonomy.categories c where c.id = $1
		  union all
		  select c.id, c.deleted_at from taxonomy.categories c join sub on c.parent_id = sub.id
		)
		select count(*) filter (where deleted_at is null),
		       count(*) filter (where exists (select 1 from catalog.products p where p.taxonomy_category_id = sub.id)
		                          or exists (select 1 from directory.stores s where s.seller_category_id = sub.id)
		                          or exists (select 1 from directory.menus m
		                                      where m.sub_category_id = sub.id or m.section_id = sub.id))
		  from sub`, id).Scan(&live, &referenced); err != nil {
		return 0, err
	}
	if live > 0 {
		return 0, ErrCategoryNotFound
	}
	if referenced > 0 {
		return 0, ErrStillReferenced
	}
	var total int64
	// The self-FK on parent_id means a statement can only remove current leaves, so sweep level by
	// level until the whole subtree is gone (the recursive CTE stops yielding once the root is gone).
	for {
		tag, err := tx.Exec(ctx, `
			with recursive sub as (
			  select c.id from taxonomy.categories c where c.id = $1
			  union all
			  select c.id from taxonomy.categories c join sub on c.parent_id = sub.id
			)
			delete from taxonomy.categories
			 where id in (select id from sub)
			   and not exists (
			         select 1 from taxonomy.categories k where k.parent_id = taxonomy.categories.id)`,
			id)
		if err != nil {
			return 0, err
		}
		n := tag.RowsAffected()
		if n == 0 {
			return total, nil
		}
		total += n
	}
}

// PurgeDeleted removes trashed, unreferenced categories older than maxAge (the hourly worker). A row
// with a trashed child is skipped in that pass — the next pass removes it after the child goes.
func (r *Repo) PurgeDeleted(ctx context.Context, maxAge time.Duration) (int64, error) {
	if r.pool == nil {
		return 0, fmt.Errorf("categories: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		delete from taxonomy.categories c
		 where c.deleted_at is not null
		   and c.deleted_at < $1
		   and not exists (select 1 from taxonomy.categories k where k.parent_id = c.id)
		   and not exists (select 1 from catalog.products p where p.taxonomy_category_id = c.id)
		   and not exists (select 1 from directory.stores s where s.seller_category_id = c.id)
		   and not exists (select 1 from directory.menus m
		                    where m.sub_category_id = c.id or m.section_id = c.id)`,
		time.Now().Add(-maxAge))
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// resolveLeaf returns the ACTIVE leaf a listing may be linked to: the id itself when it has no active
// children, otherwise its first active descendant leaf by (sort_order, id) — deterministic, so a
// retried delete lands on the same leaf.
func resolveLeaf(ctx context.Context, tx pgx.Tx, id string) (string, string, error) {
	var leafID, leafName string
	err := tx.QueryRow(ctx, `
		with recursive sub as (
		  select c.id, c.name, c.sort_order
		    from taxonomy.categories c
		   where c.id = $1 and c.is_active
		  union all
		  select c.id, c.name, c.sort_order
		    from taxonomy.categories c
		    join sub on c.parent_id = sub.id
		   where c.is_active
		)
		select s.id, s.name
		  from sub s
		 where not exists (
		         select 1 from taxonomy.categories k where k.parent_id = s.id and k.is_active)
		 order by s.sort_order, s.id
		 limit 1`, id).Scan(&leafID, &leafName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// The destination has no active leaf (e.g. it was deactivated concurrently).
			return "", "", ErrInvalidMoveTarget
		}
		return "", "", err
	}
	return leafID, leafName, nil
}

// replaceHeaderLabels rewrites the curated header labels for one category inside tx.
func replaceHeaderLabels(ctx context.Context, tx pgx.Tx, id string, labels []string) error {
	if _, err := tx.Exec(ctx, `delete from taxonomy.category_headers where category_id = $1`, id); err != nil {
		return err
	}
	if len(labels) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `
		insert into taxonomy.category_headers (category_id, header)
		select $1::text, unnest($2::text[])
		on conflict (category_id, header) do nothing`, id, labels)
	return err
}

// resolveHeaderLabels computes the label set to persist plus the mirrored show_on_home_rail flag.
//
// Rules: the primary app label is always present; a category can only carry one primary app label.
// MAIN_APP_HEADER is both a standalone primary app (header-only categories belong to no vendor
// sub-app) and the shared label a MART/PHARMA row can additionally carry; it is never allowed on a
// FOOD row. An explicit HeaderLabels list fully determines the set; otherwise the existing set is
// kept (create: just the app label) with the legacy ShowOnHomeRail flag applied as an alias for the
// MAIN_APP_HEADER label.
func resolveHeaderLabels(app string, explicit *[]string, legacyRail *bool, existing []string) ([]string, bool) {
	set := map[string]bool{}
	if explicit != nil {
		for _, raw := range *explicit {
			if h := strings.ToUpper(strings.TrimSpace(raw)); ValidHeader(h) {
				set[h] = true
			}
		}
	} else {
		for _, h := range existing {
			if ValidHeader(h) {
				set[h] = true
			}
		}
		if legacyRail != nil {
			if *legacyRail {
				set[HeaderMainApp] = true
			} else {
				delete(set, HeaderMainApp)
			}
		}
	}

	primary := primaryHeader(app)
	if primary != "" {
		// A vendor-sub-app row keeps its own label but may also be shared into the header (kept by
		// the explicit list or the legacy rail alias); a header-only row keeps exactly the header
		// label. Either way the primary label is always present and the other app labels are dropped.
		for _, h := range []string{HeaderMart, HeaderFood, HeaderPharma} {
			if h != primary {
				delete(set, h)
			}
		}
		set[primary] = true
	}

	if app == HeaderFood {
		delete(set, HeaderMainApp)
	}

	out := make([]string, 0, len(set))
	for h := range set {
		out = append(out, h)
	}
	sort.Strings(out)
	return out, set[HeaderMainApp]
}

// isUniqueViolation reports whether err is a Postgres unique-constraint violation (SQLSTATE 23505).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
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
