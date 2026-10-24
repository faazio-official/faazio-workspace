// Package festival owns the super-admin festival-surge calendar (ops.festival_calendar) and the
// active-window lookup checkout/payout use.
package festival

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Festival is one calendar row.
type Festival struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	StartDate  string `json:"startDate"`
	EndDate    string `json:"endDate"`
	SurgePaisa int64  `json:"surgePaisa"`
	Active     bool   `json:"active"`
	CreatedBy  string `json:"createdBy,omitempty"`
	CreatedAt  string `json:"createdAt,omitempty"`
}

// Repo reads/writes ops.festival_calendar.
type Repo struct {
	pool *db.Pool
}

// NewRepo returns a festival calendar repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// List returns every calendar row (newest window first).
func (r *Repo) List(ctx context.Context) ([]Festival, error) {
	if r == nil || r.pool == nil {
		return []Festival{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		select id, name, start_date::text, end_date::text, surge_paisa, active,
		       created_by, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		  from ops.festival_calendar
		 order by start_date desc, created_at desc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Festival{}
	for rows.Next() {
		var f Festival
		if err := rows.Scan(&f.ID, &f.Name, &f.StartDate, &f.EndDate, &f.SurgePaisa,
			&f.Active, &f.CreatedBy, &f.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// Insert creates a calendar row. The id is generated server-side.
func (r *Repo) Insert(ctx context.Context, f Festival, actorID string) (Festival, error) {
	if r == nil || r.pool == nil {
		return Festival{}, errors.New("festival: database not configured")
	}
	f.ID = "fest-" + randomID()
	f.CreatedBy = actorID
	err := r.pool.QueryRow(ctx, `
		insert into ops.festival_calendar
		  (id, name, start_date, end_date, surge_paisa, active, created_by)
		values ($1,$2,$3::date,$4::date,$5,$6,$7)
		returning id, name, start_date::text, end_date::text, surge_paisa, active,
		          created_by, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')`,
		f.ID, f.Name, f.StartDate, f.EndDate, f.SurgePaisa, f.Active, actorID).
		Scan(&f.ID, &f.Name, &f.StartDate, &f.EndDate, &f.SurgePaisa, &f.Active,
			&f.CreatedBy, &f.CreatedAt)
	return f, err
}

// Delete removes a calendar row.
func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	if r == nil || r.pool == nil {
		return false, errors.New("festival: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `delete from ops.festival_calendar where id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ActiveFestival resolves the active festival whose window contains day (highest surge wins).
func (r *Repo) ActiveFestival(ctx context.Context, day time.Time) (contracts.Festival, bool, error) {
	if r == nil || r.pool == nil {
		return contracts.Festival{}, false, nil
	}
	var f contracts.Festival
	err := r.pool.QueryRow(ctx, `
		select id, name, surge_paisa
		  from ops.festival_calendar
		 where active and start_date <= $1::date and end_date >= $1::date
		 order by surge_paisa desc, created_at desc
		 limit 1`, day.In(time.FixedZone("IST", 5*3600+1800)).Format("2006-01-02")).
		Scan(&f.ID, &f.Name, &f.SurgePaisa)
	if errors.Is(err, pgx.ErrNoRows) {
		return contracts.Festival{}, false, nil
	}
	if err != nil {
		return contracts.Festival{}, false, err
	}
	return f, true, nil
}

func randomID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
