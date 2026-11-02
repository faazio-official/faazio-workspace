// Package reference serves the small, slowly-changing reference catalogues that used to be hardcoded
// in the clients: the ISO state/UT master (admins.states), the app-brand list (ops.app_brand) and the
// ad-placement catalogue (ads.placements). Moving them to the DB means adding a state or a placement
// is data-only — no client ship — and both clients read one source of truth.
//
// It is a tiny read-only context: no mutations, no audit, both routes are auth-gated reads.
package reference

import (
	"context"
	"fmt"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// State is one admins.states row on the wire. camelCase matches the client StateInfo shape
// (@data/states) so clients need no remapping.
type State struct {
	StateCode string `json:"stateCode"`
	Name      string `json:"name"`
	Kind      string `json:"kind"`
}

// AppBrand is one ops.app_brand row (the app_brand enum mirrored as a readable table).
type AppBrand struct {
	Brand string `json:"brand"`
	Label string `json:"label"`
}

// Placement is one ads.placements row: a named ad slot plus the apps it can serve and the target
// types it accepts.
type Placement struct {
	Placement   string   `json:"placement"`
	Label       string   `json:"label"`
	ReachNote   string   `json:"reachNote"`
	Apps        []string `json:"apps"`
	TargetTypes []string `json:"targetTypes"`
}

// Repo reads the reference catalogues. The gateway (service_role) is the only writer.
type Repo struct {
	pool *db.Pool
}

// NewRepo returns a reference repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// States returns the active states/UTs, name-ordered for dropdown scannability.
func (r *Repo) States(ctx context.Context) ([]State, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("reference: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select state_code::text as "stateCode", name, kind
		  from admins.states
		 where is_active
		 order by sort_order, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []State{}
	for rows.Next() {
		var s State
		if err := rows.Scan(&s.StateCode, &s.Name, &s.Kind); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// Apps returns the active app brands with display labels.
func (r *Repo) Apps(ctx context.Context) ([]AppBrand, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("reference: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select brand::text as "brand", label
		  from ops.app_brand
		 where is_active
		 order by sort_order, brand`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AppBrand{}
	for rows.Next() {
		var a AppBrand
		if err := rows.Scan(&a.Brand, &a.Label); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Placements returns the active ad placements with their app/target metadata.
func (r *Repo) Placements(ctx context.Context) ([]Placement, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("reference: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select placement, label, reach_note, apps::text[], target_types
		  from ads.placements
		 where is_active
		 order by sort_order, placement`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Placement{}
	for rows.Next() {
		var p Placement
		if err := rows.Scan(&p.Placement, &p.Label, &p.ReachNote, &p.Apps, &p.TargetTypes); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
