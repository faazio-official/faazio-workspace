package weather

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
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
	cache  CacheStore
	api    API
	usage  UsageStore
	limit  int64
	now    func() time.Time
	logger *slog.Logger
}

// NewChecker builds the weather checker. api/usage may be nil (provider disabled / no DB);
// IsRaining then returns the fail-closed ErrWeatherProviderNotConfigured. The optional logger
// receives a detailed line for every failure (provider down, budget exhausted, API error) so a
// failed rain check is always auditable. Nil logger → log/slog default.
func NewChecker(c CacheStore, api API, usage UsageStore, limit int64, loggers ...*slog.Logger) *Checker {
	if c == nil {
		c = &cache.Cache{}
	}
	if limit <= 0 {
		limit = AnnualCallLimit
	}
	logger := slog.Default()
	if len(loggers) > 0 && loggers[0] != nil {
		logger = loggers[0]
	}
	return &Checker{cache: c, api: api, usage: usage, limit: limit, now: time.Now, logger: logger}
}

// logDegrade writes the always-on audit line for a failed weather check (hard or degraded). cell is
// the hex delivery zone; extra key/value pairs carry the failure specifics.
func (c *Checker) logDegrade(cellID string, detail string) {
	lat, lng := geo.GeoCellCenter(cellID)
	c.logger.Warn("weather_degraded",
		"source", "weather",
		"cell", cellID,
		"lat", lat,
		"lng", lng,
		"detail", detail,
	)
}

// IsRaining reports whether a zone is raining now. Manual overrides and a cached recent provider
// verdict are honoured. Failure semantics follow the weather error taxonomy (contracts):
//   - disabled provider / exhausted budget → ErrWeatherProviderNotConfigured / ErrWeatherBudgetExhausted
//     (FAIL-CLOSED: delivery pricing must abort — an operator intervenes);
//   - transient provider outage → an error wrapping ErrWeatherProviderUnavailable (DEGRADED: delivery
//     pricing fails open on the weather surge) AND the zone is marked degraded in cache for 5 minutes
//     so subsequent checkouts fast-fail without re-hitting Weather Union while it's down.
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
	// Fast-fail on a live degraded marker: the provider already errored within the last 5 minutes,
	// so skip the API call (and its budget charge) entirely.
	var degraded bool
	if c.cache.GetJSON(ctx, cache.WeatherDegraded(cellID), &degraded) && degraded {
		c.logDegrade(cellID, "provider degraded marker active; skipping call")
		return false, fmt.Errorf("weather: provider degraded for cell %s: %w", cellID, contracts.ErrWeatherProviderUnavailable)
	}
	if c.api == nil || !c.api.Enabled() {
		c.logDegrade(cellID, "provider not configured or disabled")
		return false, fmt.Errorf("weather: provider not configured or disabled: %w", contracts.ErrWeatherProviderNotConfigured)
	}

	now := c.now()
	fy := FinancialYear(now)
	if used, ok := c.cache.GetInt(ctx, cache.WeatherCalls(fy)); ok && used >= c.limit {
		c.logDegrade(cellID, fmt.Sprintf("annual call budget exhausted (%d/%d)", used, c.limit))
		return false, fmt.Errorf("weather: annual call budget exhausted (%d/%d): %w", used, c.limit, contracts.ErrWeatherBudgetExhausted)
	}

	lat, lng := geo.GeoCellCenter(cellID)
	raining, err := c.api.Raining(ctx, lat, lng)
	// The provider call is counted even when it fails: the annual budget guards API spend. The
	// degraded marker below keeps a single outage to one call per zone per 5-minute window instead
	// of one per checkout.
	c.recordCall(ctx, now, fy)
	if err != nil {
		// Mark the zone degraded so the outage is remembered briefly (fail-open surge path can rely
		// on it) and subsequent checkouts don't re-hit Weather Union. Real verdicts are never
		// fabricated — the recovery path re-calls the provider once the marker lapses.
		c.cache.SetJSON(ctx, cache.WeatherDegraded(cellID), true, cache.TTLWeatherDegraded)
		c.logDegrade(cellID, "provider error: "+err.Error())
		return false, fmt.Errorf("weather: provider error for cell %s: %w: %w", cellID, err, contracts.ErrWeatherProviderUnavailable)
	}

	c.cache.SetJSON(ctx, cache.WeatherZone(cellID), raining, cache.TTLWeatherZone)
	return raining, nil
}

func (c *Checker) recordCall(ctx context.Context, now time.Time, fy string) {
	_, _ = c.cache.Incr(ctx, cache.WeatherCalls(fy), time.Until(FinancialYearEnd(now)))
	if c.usage != nil {
		_ = c.usage.AddCall(ctx, now, fy)
	}
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
