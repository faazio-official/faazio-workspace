package categories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// AttributeGroup is one superadmin-authored facet group attached to a leaf sub-category
// (Burger → Patty, Cheese Type, Bun). It is deliberately separate from the navigation/GST taxonomy
// tree so attribute permutations never become categories.
type AttributeGroup struct {
	ID            string            `json:"id"`
	SubcategoryID string            `json:"subcategoryId"`
	Slug          string            `json:"slug"`
	DisplayName   string            `json:"displayName"`
	InputType     string            `json:"inputType"`
	DisplayOrder  int               `json:"displayOrder"`
	Options       []AttributeOption `json:"options"`
}

// AttributeOption is one selectable value in a group (Chicken, Cheddar, Brioche).
type AttributeOption struct {
	ID              string   `json:"id"`
	Label           string   `json:"label"`
	ParentFilterTab string   `json:"parentFilterTab,omitempty"`
	IconURL         string   `json:"iconUrl,omitempty"`
	Keywords        []string `json:"keywords"`
	DisplayOrder    int      `json:"displayOrder"`
}

// AttributeGroupInput is one group in a replace-all write. An empty ID mints a new group; a supplied
// ID updates in place so seller-applied dish tags survive an edit.
type AttributeGroupInput struct {
	ID           string                 `json:"id"`
	Slug         string                 `json:"slug"`
	DisplayName  string                 `json:"displayName"`
	InputType    string                 `json:"inputType"`
	DisplayOrder int                    `json:"displayOrder"`
	Options      []AttributeOptionInput `json:"options"`
}

// AttributeOptionInput is one option in a replace-all write.
type AttributeOptionInput struct {
	ID              string   `json:"id"`
	Label           string   `json:"label"`
	ParentFilterTab string   `json:"parentFilterTab"`
	IconURL         string   `json:"iconUrl"`
	Keywords        []string `json:"keywords"`
	DisplayOrder    int      `json:"displayOrder"`
}

// ErrInvalidAttribute is returned when an attribute group/option payload is malformed or references a
// row outside the target sub-category.
var ErrInvalidAttribute = errors.New("categories: invalid attribute definition")

// ValidInputType reports whether s is an accepted facet input type.
func ValidInputType(s string) bool {
	return s == "single_select" || s == "multi_select"
}

// ListAttributeGroups returns the facet groups + options for one sub-category, ordered for display.
func (r *Repo) ListAttributeGroups(ctx context.Context, subcategoryID string) ([]AttributeGroup, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("categories: database not configured")
	}
	subcategoryID = strings.TrimSpace(subcategoryID)
	if subcategoryID == "" {
		return []AttributeGroup{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		select id, subcategory_id, slug, display_name, input_type, display_order
		  from taxonomy.subcategory_attribute_groups
		 where subcategory_id = $1
		 order by display_order asc, lower(display_name) asc`, subcategoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groups := []AttributeGroup{}
	index := map[string]int{}
	for rows.Next() {
		var g AttributeGroup
		g.Options = []AttributeOption{}
		if err := rows.Scan(&g.ID, &g.SubcategoryID, &g.Slug, &g.DisplayName, &g.InputType, &g.DisplayOrder); err != nil {
			return nil, err
		}
		index[g.ID] = len(groups)
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		return groups, nil
	}

	optRows, err := r.pool.Query(ctx, `
		select o.id, o.group_id, coalesce(o.parent_filter_tab, ''), o.label, coalesce(o.icon_url, ''),
		       o.keywords, o.display_order
		  from taxonomy.attribute_options o
		  join taxonomy.subcategory_attribute_groups g on g.id = o.group_id
		 where g.subcategory_id = $1
		 order by o.display_order asc, lower(o.label) asc`, subcategoryID)
	if err != nil {
		return nil, err
	}
	defer optRows.Close()
	for optRows.Next() {
		var (
			o       AttributeOption
			groupID string
		)
		if err := optRows.Scan(&o.ID, &groupID, &o.ParentFilterTab, &o.Label, &o.IconURL, &o.Keywords, &o.DisplayOrder); err != nil {
			return nil, err
		}
		if o.Keywords == nil {
			o.Keywords = []string{}
		}
		if i, ok := index[groupID]; ok {
			groups[i].Options = append(groups[i].Options, o)
		}
	}
	return groups, optRows.Err()
}

// ReplaceAttributeGroups rewrites the facet groups of one sub-category. Group and option ids are
// preserved when supplied (so dish tags never orphan on a reorder); ids absent from the payload are
// deleted. The whole rewrite runs in one transaction.
func (r *Repo) ReplaceAttributeGroups(ctx context.Context, subcategoryID string, groups []AttributeGroupInput, actor string) ([]AttributeGroup, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("categories: database not configured")
	}
	subcategoryID = strings.TrimSpace(subcategoryID)

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var exists bool
	if err := tx.QueryRow(ctx,
		`select exists (select 1 from taxonomy.categories where id = $1)`, subcategoryID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}

	keptGroups := make([]string, 0, len(groups))
	for i, g := range groups {
		display := strings.TrimSpace(g.DisplayName)
		if display == "" || len(display) > 100 {
			return nil, ErrInvalidAttribute
		}
		slug := strings.TrimSpace(g.Slug)
		if slug == "" {
			slug = slugify(display)
		}
		if !validSlug(slug) {
			return nil, ErrInvalidAttribute
		}
		inputType := strings.TrimSpace(g.InputType)
		if inputType == "" {
			inputType = "multi_select"
		}
		if !ValidInputType(inputType) {
			return nil, ErrInvalidAttribute
		}
		id := strings.TrimSpace(g.ID)
		if id == "" {
			id = "ag-" + shortID()
		} else {
			var owner string
			err := tx.QueryRow(ctx,
				`select subcategory_id from taxonomy.subcategory_attribute_groups where id = $1`, id).Scan(&owner)
			switch {
			case err == nil && owner != subcategoryID:
				return nil, ErrInvalidAttribute
			case err != nil && !errors.Is(err, pgx.ErrNoRows):
				return nil, err
			}
		}
		if _, err := tx.Exec(ctx, `
			insert into taxonomy.subcategory_attribute_groups
			  (id, subcategory_id, slug, display_name, input_type, display_order)
			values ($1, $2, $3, $4, $5, $6)
			on conflict (id) do update
			  set subcategory_id = excluded.subcategory_id,
			      slug = excluded.slug,
			      display_name = excluded.display_name,
			      input_type = excluded.input_type,
			      display_order = excluded.display_order,
			      updated_at = now()`,
			id, subcategoryID, slug, display, inputType, i); err != nil {
			if isUniqueViolation(err) {
				return nil, ErrDuplicate
			}
			return nil, err
		}

		keptOptions := make([]string, 0, len(g.Options))
		for j, o := range g.Options {
			label := strings.TrimSpace(o.Label)
			if label == "" || len(label) > 100 {
				return nil, ErrInvalidAttribute
			}
			tab := strings.TrimSpace(o.ParentFilterTab)
			if len(tab) > 50 {
				return nil, ErrInvalidAttribute
			}
			oid := strings.TrimSpace(o.ID)
			if oid == "" {
				oid = "ao-" + shortID()
			} else {
				var owner string
				err := tx.QueryRow(ctx, `
					select g.subcategory_id
					  from taxonomy.attribute_options o
					  join taxonomy.subcategory_attribute_groups g on g.id = o.group_id
					 where o.id = $1`, oid).Scan(&owner)
				switch {
				case err == nil && owner != subcategoryID:
					return nil, ErrInvalidAttribute
				case err != nil && !errors.Is(err, pgx.ErrNoRows):
					return nil, err
				}
			}
			if _, err := tx.Exec(ctx, `
				insert into taxonomy.attribute_options
				  (id, group_id, parent_filter_tab, label, icon_url, keywords, display_order)
				values ($1, $2, nullif($3, ''), $4, nullif($5, ''), $6, $7)
				on conflict (id) do update
				  set group_id = excluded.group_id,
				      parent_filter_tab = excluded.parent_filter_tab,
				      label = excluded.label,
				      icon_url = excluded.icon_url,
				      keywords = excluded.keywords,
				      display_order = excluded.display_order,
				      updated_at = now()`,
				oid, id, tab, label, strings.TrimSpace(o.IconURL), normalizeKeywords(o.Keywords), j); err != nil {
				if isUniqueViolation(err) {
					return nil, ErrDuplicate
				}
				return nil, err
			}
			keptOptions = append(keptOptions, oid)
		}
		// Remove options the payload dropped. A removed option cascades its dish links.
		if _, err := tx.Exec(ctx, `
			delete from taxonomy.attribute_options
			 where group_id = $1 and not (id = any($2::text[]))`, id, keptOptions); err != nil {
			return nil, err
		}
		keptGroups = append(keptGroups, id)
	}

	// Remove groups the payload dropped (their options + dish links cascade).
	if _, err := tx.Exec(ctx, `
		delete from taxonomy.subcategory_attribute_groups
		 where subcategory_id = $1 and not (id = any($2::text[]))`, subcategoryID, keptGroups); err != nil {
		return nil, err
	}

	_ = actor

	result, err := listAttributeGroupsTx(ctx, tx, subcategoryID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

// listAttributeGroupsTx is ListAttributeGroups bound to a transaction so the write returns the exact
// persisted shape before commit.
func listAttributeGroupsTx(ctx context.Context, tx pgx.Tx, subcategoryID string) ([]AttributeGroup, error) {
	rows, err := tx.Query(ctx, `
		select id, subcategory_id, slug, display_name, input_type, display_order
		  from taxonomy.subcategory_attribute_groups
		 where subcategory_id = $1
		 order by display_order asc, lower(display_name) asc`, subcategoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	groups := []AttributeGroup{}
	index := map[string]int{}
	for rows.Next() {
		var g AttributeGroup
		g.Options = []AttributeOption{}
		if err := rows.Scan(&g.ID, &g.SubcategoryID, &g.Slug, &g.DisplayName, &g.InputType, &g.DisplayOrder); err != nil {
			return nil, err
		}
		index[g.ID] = len(groups)
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		return groups, nil
	}
	optRows, err := tx.Query(ctx, `
		select o.id, o.group_id, coalesce(o.parent_filter_tab, ''), o.label, coalesce(o.icon_url, ''),
		       o.keywords, o.display_order
		  from taxonomy.attribute_options o
		  join taxonomy.subcategory_attribute_groups g on g.id = o.group_id
		 where g.subcategory_id = $1
		 order by o.display_order asc, lower(o.label) asc`, subcategoryID)
	if err != nil {
		return nil, err
	}
	defer optRows.Close()
	for optRows.Next() {
		var (
			o       AttributeOption
			groupID string
		)
		if err := optRows.Scan(&o.ID, &groupID, &o.ParentFilterTab, &o.Label, &o.IconURL, &o.Keywords, &o.DisplayOrder); err != nil {
			return nil, err
		}
		if o.Keywords == nil {
			o.Keywords = []string{}
		}
		if i, ok := index[groupID]; ok {
			groups[i].Options = append(groups[i].Options, o)
		}
	}
	return groups, optRows.Err()
}

func validSlug(s string) bool {
	if s == "" || len(s) > 50 {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-', r == '_':
		default:
			return false
		}
	}
	return true
}

// normalizeKeywords trims, lower-cases and de-duplicates the auto-tag keywords, capping the list so a
// single option cannot bloat a read.
func normalizeKeywords(in []string) []string {
	out := make([]string, 0, len(in))
	seen := map[string]bool{}
	for _, raw := range in {
		k := strings.ToLower(strings.TrimSpace(raw))
		if k == "" || seen[k] || len(k) > 60 {
			continue
		}
		seen[k] = true
		out = append(out, k)
		if len(out) >= 12 {
			break
		}
	}
	return out
}
