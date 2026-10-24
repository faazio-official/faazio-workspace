package weather

import (
	"context"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/geo"
	"github.com/faazio/server/gateway/internal/platform/cache"
)

// AnnualCallLimit is the Weather Union budget (60,000 calls per Indian financial year).
const AnnualCallLimit int64 = 60000

// IST is the fixed India Standard Time zone (no DST).
var IST = time.FixedZone("IST", 5*3600+1800)

// CacheStore is the subset of the Valkey cache the checker needs (a fake in unit tests).
type CacheStore interface {
	GetJSON(ctx context.Context, key string, dst any) bool
	SetJSON(ctx context.Context, key string, v any, ttl time.Duration)
	Incr(ctx context.Context, key string, ttl time.Duration) (int64, error)
	GetInt(ctx context.Context, key string) (int64, bool)
}

// UsageStore persists the daily call history (implemented by Repo).
type UsageStore interface {
	AddCall(ctx context.Context, day time.Time, fy string) error
	Daily(ctx context.Context, limit int) ([]UsageRow, error)
}

// Checker resolves rain per zone with a 30-minute cache, a manual override and an annual budget.
type Checker struct {
	cache CacheStore
	api   API
	usage UsageStore
	limit int64
	now   func() time.Time
}

// NewChecker builds the weather checker. api/usage may be nil (provider disabled / no DB).
func NewChecker(c CacheStore, api API, usage UsageStore, limit int64) *Checker {
	if c == nil {
		c = &cache.Cache{}
	}
	if limit <= 0 {
		limit = AnnualCallLimit
	}
	return &Checker{cache: c, api: api, usage: usage, limit: limit, now: time.Now}
}

// IsRaining reports whether a zone is raining now. It never blocks checkout: a disabled provider,
// exhausted budget or provider error degrades to false.
func (c *Checker) IsRaining(ctx context.Context, cellID string) (bool, error) {
	if c == nil || cellID == "" {
		return false, nil
	}
	var override bool
	if c.cache.GetJSON(ctx, cache.WeatherOverride(cellID), &override) {
		return override, nil
	}
	var cached bool
	if c.cache.GetJSON(ctx, cache.WeatherZone(cellID), &cached) {
		return cached, nil
	}
	if c.api == nil || !c.api.Enabled() {
		return false, nil
	}

	now := c.now()
	fy := FinancialYear(now)
	if used, ok := c.cache.GetInt(ctx, cache.WeatherCalls(fy)); ok && used >= c.limit {
		return false, fmt.Errorf("weather: annual call budget exhausted (%d/%d)", used, c.limit)
	}

	lat, lng := geo.GeoCellCenter(cellID)
	raining, err := c.api.Raining(ctx, lat, lng)
	if err != nil {
		return false, err
	}

	c.cache.SetJSON(ctx, cache.WeatherZone(cellID), raining, cache.TTLWeatherZone)
	_, _ = c.cache.Incr(ctx, cache.WeatherCalls(fy), time.Until(FinancialYearEnd(now)))
	if c.usage != nil {
		_ = c.usage.AddCall(ctx, now, fy)
	}
	return raining, nil
}

// SetOverride forces a zone's rain verdict for one 30-minute window (super-admin action).
func (c *Checker) SetOverride(ctx context.Context, cellID string, raining bool) {
	if c == nil || cellID == "" {
		return
	}
	c.cache.SetJSON(ctx, cache.WeatherOverride(cellID), raining, cache.TTLWeatherOverride)
}

// Usage is the super-admin budget dashboard projection.
type Usage struct {
	FY        string     `json:"fy"`
	Limit     int64      `json:"limit"`
	Used      int64      `json:"used"`
	Remaining int64      `json:"remaining"`
	Warning   bool       `json:"warning"`
	Daily     []UsageRow `json:"daily"`
}

// Usage reads the Valkey counter plus the Supabase daily trail.
func (c *Checker) Usage(ctx context.Context) (Usage, error) {
	now := c.now()
	fy := FinancialYear(now)
	used, _ := c.cache.GetInt(ctx, cache.WeatherCalls(fy))
	remaining := c.limit - used
	if remaining < 0 {
		remaining = 0
	}
	daily := []UsageRow{}
	if c.usage != nil {
		rows, err := c.usage.Daily(ctx, 90)
		if err != nil {
			return Usage{}, err
		}
		if rows != nil {
			daily = rows
		}
	}
	return Usage{
		FY: fy, Limit: c.limit, Used: used, Remaining: remaining,
		Warning: c.limit > 0 && used*100 >= c.limit*80,
		Daily:   daily,
	}, nil
}

// FinancialYear returns the Indian financial-year label (Apr 1–Mar 31), e.g. "2026-27".
func FinancialYear(at time.Time) string {
	ist := at.In(IST)
	start := ist.Year()
	if ist.Month() < time.April {
		start--
	}
	return fmt.Sprintf("%d-%02d", start, (start+1)%100)
}

// FinancialYearEnd returns the next Apr 1 00:00 IST, the counter's expiry.
func FinancialYearEnd(at time.Time) time.Time {
	ist := at.In(IST)
	start := ist.Year()
	if ist.Month() < time.April {
		start--
	}
	return time.Date(start+1, time.April, 1, 0, 0, 0, 0, IST)
}
