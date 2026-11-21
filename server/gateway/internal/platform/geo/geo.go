// Package geo is the gateway's in-process mirror of the district master (admins.district_master).
// Platform code only — every context may import it. It is a read-through cache: Init/Reload load the
// table through the shared pool, and IsValid/StateForDistrict/Name/ForState answer from that
// snapshot, so a district created through the SUPER_ADMIN write API is immediately valid for seller
// onboarding and district scoping without a gateway restart. The embedded seed below is only the
// boot fallback for a gateway that starts without Postgres (health-only runs).
//
// The DB is the authority. A deactivated district (is_active = false) stays in the snapshot — it
// remains valid for references already on it (seller/admin rows FK it) and is only hidden from the
// picker read, GET /geo/districts, which filters is_active.
package geo

import (
	"context"
	"strings"
	"sync/atomic"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// District is one admins.district_master row.
type District struct {
	Code      string
	Name      string
	StateCode string
	// Active mirrors is_active: false hides the district from pickers but keeps it a valid code.
	Active bool
}

// seed mirrors the 0046 seed (Tamil Nadu then Puducherry, name-ordered within each state). It is the
// fallback snapshot when the gateway has no database; the DB row set is authoritative otherwise.
var seed = []District{
	{Code: "TNA", Name: "Ariyalur", StateCode: "TN", Active: true},
	{Code: "TNC", Name: "Chengalpattu", StateCode: "TN", Active: true},
	{Code: "TCH", Name: "Chennai", StateCode: "TN", Active: true},
	{Code: "TCO", Name: "Coimbatore", StateCode: "TN", Active: true},
	{Code: "TCD", Name: "Cuddalore", StateCode: "TN", Active: true},
	{Code: "TDP", Name: "Dharmapuri", StateCode: "TN", Active: true},
	{Code: "TDG", Name: "Dindigul", StateCode: "TN", Active: true},
	{Code: "TER", Name: "Erode", StateCode: "TN", Active: true},
	{Code: "TKL", Name: "Kallakurichi", StateCode: "TN", Active: true},
	{Code: "TKP", Name: "Kanchipuram", StateCode: "TN", Active: true},
	{Code: "TKK", Name: "Kanyakumari", StateCode: "TN", Active: true},
	{Code: "TKR", Name: "Karur", StateCode: "TN", Active: true},
	{Code: "TKG", Name: "Krishnagiri", StateCode: "TN", Active: true},
	{Code: "TMD", Name: "Madurai", StateCode: "TN", Active: true},
	{Code: "TMY", Name: "Mayiladuthurai", StateCode: "TN", Active: true},
	{Code: "TNP", Name: "Nagapattinam", StateCode: "TN", Active: true},
	{Code: "TNK", Name: "Namakkal", StateCode: "TN", Active: true},
	{Code: "TNG", Name: "Nilgiris", StateCode: "TN", Active: true},
	{Code: "TPE", Name: "Perambalur", StateCode: "TN", Active: true},
	{Code: "TPK", Name: "Pudukkottai", StateCode: "TN", Active: true},
	{Code: "TRT", Name: "Ramanathapuram", StateCode: "TN", Active: true},
	{Code: "TRN", Name: "Ranipet", StateCode: "TN", Active: true},
	{Code: "TSL", Name: "Salem", StateCode: "TN", Active: true},
	{Code: "TSK", Name: "Sivaganga", StateCode: "TN", Active: true},
	{Code: "TTK", Name: "Tenkasi", StateCode: "TN", Active: true},
	{Code: "TTH", Name: "Thanjavur", StateCode: "TN", Active: true},
	{Code: "TTE", Name: "Theni", StateCode: "TN", Active: true},
	{Code: "TTT", Name: "Thoothukudi", StateCode: "TN", Active: true},
	{Code: "TTC", Name: "Tiruchirappalli", StateCode: "TN", Active: true},
	{Code: "TTL", Name: "Tirunelveli", StateCode: "TN", Active: true},
	{Code: "TTP", Name: "Tirupathur", StateCode: "TN", Active: true},
	{Code: "TPP", Name: "Tiruppur", StateCode: "TN", Active: true},
	{Code: "TLV", Name: "Tiruvallur", StateCode: "TN", Active: true},
	{Code: "TVA", Name: "Tiruvannamalai", StateCode: "TN", Active: true},
	{Code: "TVR", Name: "Tiruvarur", StateCode: "TN", Active: true},
	{Code: "VEL", Name: "Vellore", StateCode: "TN", Active: true},
	{Code: "VLP", Name: "Villupuram", StateCode: "TN", Active: true},
	{Code: "VIR", Name: "Virudhunagar", StateCode: "TN", Active: true},
	{Code: "PY0", Name: "Puducherry", StateCode: "PY", Active: true},
	{Code: "PY1", Name: "Karaikal", StateCode: "PY", Active: true},
	{Code: "PY2", Name: "Mahé", StateCode: "PY", Active: true},
	{Code: "PY3", Name: "Yanam", StateCode: "PY", Active: true},
}

// snapshot is one immutable view of the master: the ordered slice plus its lookup maps. Reads swap a
// pointer, so no lock is taken on the hot path and a reload never observes a half-built map.
type snapshot struct {
	all    []District
	byCode map[string]District
	states map[string]bool
}

func newSnapshot(rows []District) *snapshot {
	s := &snapshot{
		all:    rows,
		byCode: make(map[string]District, len(rows)),
		states: make(map[string]bool),
	}
	for _, d := range rows {
		s.byCode[d.Code] = d
		s.states[d.StateCode] = true
	}
	return s
}

var current atomic.Pointer[snapshot]

func init() { current.Store(newSnapshot(seed)) }

// Init loads the master from admins.district_master into the in-process snapshot. Called at gateway
// boot; a nil pool leaves the seed snapshot in place and returns nil so health-only runs still start.
func Init(ctx context.Context, pool *db.Pool) error { return Reload(ctx, pool) }

// Reload refreshes the snapshot from the database. Every district write calls it so the new row is
// valid for onboarding/scoping immediately. A failed read keeps the previous snapshot serving.
func Reload(ctx context.Context, pool *db.Pool) error {
	if pool == nil {
		return nil
	}
	rows, err := pool.Query(ctx, `
		select district_code, district_name, state_code::text, is_active
		  from admins.district_master
		 order by (state_code <> 'TN'), state_code, district_name`)
	if err != nil {
		return err
	}
	defer rows.Close()
	out := make([]District, 0, len(seed))
	for rows.Next() {
		var d District
		if err := rows.Scan(&d.Code, &d.Name, &d.StateCode, &d.Active); err != nil {
			return err
		}
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(out) == 0 {
		// An empty read is a broken/rolled-back database, never a real master (the FK targets and
		// every seller row depend on it). Keep the previous snapshot instead of invalidating all codes.
		return nil
	}
	current.Store(newSnapshot(out))
	return nil
}

// All returns every district in the snapshot, ordered by state then name.
func All() []District {
	rows := current.Load().all
	out := make([]District, len(rows))
	copy(out, rows)
	return out
}

// Seed returns the embedded fallback snapshot (tests + drift checks against the 0046 seed).
func Seed() []District {
	out := make([]District, len(seed))
	copy(out, seed)
	return out
}

// Normalise upper-cases and trims a client-supplied district code.
func Normalise(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// IsValid reports whether code is a known district code (exact, uppercase). Deactivated districts
// stay valid: existing references must keep resolving.
func IsValid(code string) bool {
	_, ok := current.Load().byCode[Normalise(code)]
	return ok
}

// IsActive reports whether a known district is currently enabled for pickers.
func IsActive(code string) bool {
	return current.Load().byCode[Normalise(code)].Active
}

// StateForDistrict returns the parent ISO state/UT code for a district, or "".
func StateForDistrict(code string) string {
	return current.Load().byCode[Normalise(code)].StateCode
}

// Name returns the display name for a district code, or "".
func Name(code string) string {
	return current.Load().byCode[Normalise(code)].Name
}

// InCoverageState reports whether a state has district coverage.
func InCoverageState(stateCode string) bool {
	return current.Load().states[Normalise(stateCode)]
}

// ForState returns the districts of one state (empty when the state has no coverage).
func ForState(stateCode string) []District {
	stateCode = Normalise(stateCode)
	out := []District{}
	for _, d := range current.Load().all {
		if d.StateCode == stateCode {
			out = append(out, d)
		}
	}
	return out
}
