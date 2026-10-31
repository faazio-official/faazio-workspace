// Package districts is the read context for the production district master
// (admins.district_master, migration 0046) served over GET /geo/districts. Making the DB the read
// authority means seeding a new state/district is data-only — no app ship — while
// internal/platform/geo stays the in-process write/validation authority (IsValid/StateForDistrict).
//
// It is a distinct context, not internal/geo: that package is the delivery-zone hex grid, and
// internal/platform/geo is the district validation mirror.
package districts

import (
	"context"
	"fmt"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// District is one admins.district_master row on the wire. The camelCase tags make the JSON shape
// identical to the client fixture DistrictInfo (@data/districts), so clients need no remapping.
type District struct {
	DistrictCode string `json:"districtCode"`
	Name         string `json:"name"`
	StateCode    string `json:"stateCode"`
}

// Repo reads the district master. The gateway (service_role) is the only writer.
type Repo struct {
	pool *db.Pool
}

// NewRepo returns a districts repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// List returns active districts, optionally narrowed to one 2-letter state code ("" means all). The
// predicate hits the partial index district_master_state_idx (state_code, district_name)
// WHERE is_active. Order is Tamil Nadu first (the primary coverage state), then the remaining states
// by code, then districts by name — the same order as internal/platform/geo and the @data fixtures
// (locked by TestListMatchesMirror).
func (r *Repo) List(ctx context.Context, stateCode string) ([]District, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("districts: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select district_code as "districtCode", district_name as "name", state_code::text as "stateCode"
		  from admins.district_master
		 where is_active and ($1 = '' or state_code = $1)
		 order by (state_code <> 'TN'), state_code, district_name`, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []District{}
	for rows.Next() {
		var d District
		if err := rows.Scan(&d.DistrictCode, &d.Name, &d.StateCode); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
