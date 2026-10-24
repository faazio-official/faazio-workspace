package weather

import (
	"context"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// UsageRow is one ops.weather_api_usage day (the Supabase history row).
type UsageRow struct {
	Date  string `json:"date"`
	Calls int64  `json:"calls"`
	FY    string `json:"fy"`
}

// Repo persists the one-row-per-day Weather Union call history. The live budget counter lives in
// Valkey; Supabase only keeps the auditable daily trail.
type Repo struct {
	pool *db.Pool
}

// NewRepo returns a weather usage repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// AddCall increments today's usage row (insert on first call, +1 afterwards).
func (r *Repo) AddCall(ctx context.Context, day time.Time, fy string) error {
	if r == nil || r.pool == nil {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		insert into ops.weather_api_usage (d, calls, fy)
		values ($1, 1, $2)
		on conflict (d) do update
		  set calls = ops.weather_api_usage.calls + 1,
		      fy = excluded.fy,
		      updated_at = now()`, day.In(IST).Format("2006-01-02"), fy)
	return err
}

// Daily returns the most recent usage rows (newest first).
func (r *Repo) Daily(ctx context.Context, limit int) ([]UsageRow, error) {
	if r == nil || r.pool == nil {
		return []UsageRow{}, nil
	}
	if limit <= 0 || limit > 365 {
		limit = 90
	}
	rows, err := r.pool.Query(ctx, `
		select d::text, calls, fy from ops.weather_api_usage
		 order by d desc limit $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []UsageRow{}
	for rows.Next() {
		var u UsageRow
		if err := rows.Scan(&u.Date, &u.Calls, &u.FY); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
