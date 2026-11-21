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

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Category is one taxonomy.categories row.
type Category struct {
	ID             string  `json:"id"`
	App            string  `json:"app"`
	Name           string  `json:"name"`
	Slug           string  `json:"slug"`
	Description    string  `json:"description,omitempty"`
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
	// Tamil display copy (0107). Empty means "not translated" → the app falls back to English.
	NameTA        string `json:"nameTa,omitempty"`
	DescriptionTA string `json:"descriptionTa,omitempty"`
	// HeaderLabels are the curated header lists this row belongs to (0115):
	// MAIN_APP_HEADER | MART | FOOD | PHARMA. `App` is always one of them.
	HeaderLabels []string `json:"headerLabels"`
}

// Input is a create/update payload.
type Input struct {
	ID             string  `json:"id"`
	App            string  `json:"app"`
	Name           string  `json:"name"`
	Slug           string  `json:"slug"`
	Description    string  `json:"description"`
	IconURL        string  `json:"iconUrl"`
	ParentID       *string `json:"parentId"`
	SearchQuery    string  `json:"searchQuery"`
	SortOrder      int64   `json:"sortOrder"`
	IsActive       *bool   `json:"isActive"`
	ShowOnHomeRail *bool   `json:"showOnHomeRail"` // nil on update = unchanged
	NameTA         string  `json:"nameTa"`
	DescriptionTA  string  `json:"descriptionTa"`
	// HeaderLabels replaces the curated header lists when non-nil (0115). nil on update = unchanged.
	// MAIN_APP_HEADER is also mirrored onto taxonomy.categories.show_on_home_rail.
	HeaderLabels *[]string `json:"headerLabels"`
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

// primaryHeader maps a category's app onto its primary header label.
func primaryHeader(app string) string {
	switch app {
	case HeaderMart, HeaderFood, HeaderPharma:
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

const rowSelect = `select id, app::text, name, slug, coalesce(description, ''), coalesce(icon_url, ''),
	parent_id, coalesce(search_query, ''), is_active, show_on_home_rail, sort_order,
	created_at::text, updated_at::text, created_by, coalesce(updated_by, ''),
	coalesce(name_ta, ''), coalesce(description_ta, ''), ` + headerLabelsSelect

func scanCategory(row pgx.Row) (Category, error) {
	var c Category
	err := row.Scan(&c.ID, &c.App, &c.Name, &c.Slug, &c.Description, &c.IconURL,
		&c.ParentID, &c.SearchQuery, &c.IsActive, &c.ShowOnHomeRail, &c.SortOrder,
		&c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy, &c.NameTA, &c.DescriptionTA,
		&c.HeaderLabels)
	if c.HeaderLabels == nil {
		c.HeaderLabels = []string{}
	}
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
		   and ($5::text = '' or exists (
		         select 1 from taxonomy.category_headers h
		          where h.category_id = taxonomy.categories.id and h.header = $5))
		   and (not $6 or ((show_on_home_rail or exists (
		         select 1 from taxonomy.category_headers h
		          where h.category_id = taxonomy.categories.id
		            and h.header = 'MAIN_APP_HEADER')) and app::text <> 'FOOD'))
		 order by app, sort_order, lower(name)`,
		opts.App, opts.ParentID, opts.TopLevel, opts.ActiveOnly, opts.Header, opts.HomeRailOnly)
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
		  (id, app, name, slug, description, icon_url, parent_id, search_query, is_active,
		   show_on_home_rail, sort_order, created_by, updated_by, name_ta, description_ta)
		values ($1, $2::app_brand, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13, $14)`,
		id, in.App, in.Name, slug, nullStr(in.Description), nullStr(in.IconURL),
		in.ParentID, nullStr(in.SearchQuery), active, showOnRail, in.SortOrder, actor,
		strings.TrimSpace(in.NameTA), strings.TrimSpace(in.DescriptionTA)); err != nil {
		if isUniqueViolation(err) {
			return Category{}, ErrDuplicate
		}
		return Category{}, err
	}
	if err := replaceHeaderLabels(ctx, tx, id, labels); err != nil {
		return Category{}, err
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
		       description = $5,
		       icon_url = $6,
		       parent_id = $7,
		       search_query = $8,
		       is_active = coalesce($9, is_active),
		       show_on_home_rail = $10,
		       sort_order = $11,
		       updated_by = $12,
		       name_ta = $13,
		       description_ta = $14,
		       updated_at = now()
		 where id = $1`,
		id, in.App, in.Name, slug, nullStr(in.Description), nullStr(in.IconURL),
		in.ParentID, nullStr(in.SearchQuery), in.IsActive, showOnRail, in.SortOrder, actor,
		strings.TrimSpace(in.NameTA), strings.TrimSpace(in.DescriptionTA))
	if err != nil {
		return Category{}, err
	}
	if tag.RowsAffected() == 0 {
		return Category{}, ErrNotFound
	}
	if err := replaceHeaderLabels(ctx, tx, id, labels); err != nil {
		return Category{}, err
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

// Deactivate soft-deletes a category (is_active = false) so existing sellers/products that reference
// it are never orphaned. Idempotent: a repeat deactivate of a live-or-already-hidden row still
// returns true; false only when the id does not exist at all.
func (r *Repo) Deactivate(ctx context.Context, id, actor string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("categories: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update taxonomy.categories
		   set is_active = false, updated_by = $2, updated_at = now()
		 where id = $1`, id, actor)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
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
// Rules: the primary app label is always present; a category can only carry one primary app label;
// MAIN_APP_HEADER (the shared main app header) is never allowed on a FOOD row. An explicit
// HeaderLabels list fully determines the set; otherwise the existing set is kept (create: just the
// app label) with the legacy ShowOnHomeRail flag applied as an alias for the MAIN_APP_HEADER label.
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
