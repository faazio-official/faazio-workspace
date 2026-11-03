package weather

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"
)

type fakeCache struct {
	values map[string][]byte
	ints   map[string]int64
}

func newFakeCache() *fakeCache {
	return &fakeCache{values: map[string][]byte{}, ints: map[string]int64{}}
}

func (f *fakeCache) GetJSON(_ context.Context, key string, dst any) bool {
	b, ok := f.values[key]
	if !ok {
		return false
	}
	return json.Unmarshal(b, dst) == nil
}

func (f *fakeCache) SetJSON(_ context.Context, key string, v any, _ time.Duration) {
	b, err := json.Marshal(v)
	if err == nil {
		f.values[key] = b
	}
}

func (f *fakeCache) Incr(_ context.Context, key string, _ time.Duration) (int64, error) {
	f.ints[key]++
	return f.ints[key], nil
}

func (f *fakeCache) GetInt(_ context.Context, key string) (int64, bool) {
	v, ok := f.ints[key]
	return v, ok
}

type fakeAPI struct {
	raining bool
	err     error
	calls   int
}

func (f *fakeAPI) Enabled() bool { return true }
func (f *fakeAPI) Raining(context.Context, float64, float64) (bool, error) {
	f.calls++
	return f.raining, f.err
}

type fakeUsage struct {
	calls int
}

func (f *fakeUsage) AddCall(context.Context, time.Time, string) error { f.calls++; return nil }
func (f *fakeUsage) Daily(context.Context, int) ([]UsageRow, error)   { return nil, nil }

func TestCheckerCachesOneCallPerWindow(t *testing.T) {
	cache := newFakeCache()
	api := &fakeAPI{raining: true}
	usage := &fakeUsage{}
	c := NewChecker(cache, api, usage, AnnualCallLimit)
	c.now = func() time.Time { return time.Date(2026, 6, 1, 10, 0, 0, 0, IST) }

	cell := "10:20"
	raining, err := c.IsRaining(context.Background(), cell)
	if err != nil || !raining {
		t.Fatalf("first check = %v, %v; want true, nil", raining, err)
	}
	if api.calls != 1 || usage.calls != 1 {
		t.Fatalf("first check api/usage = %d/%d, want 1/1", api.calls, usage.calls)
	}
	if got := cache.ints["faazio:v1:weather:calls:2026-27"]; got != 1 {
		t.Fatalf("counter = %d, want 1", got)
	}

	if _, err := c.IsRaining(context.Background(), cell); err != nil {
		t.Fatal(err)
	}
	if api.calls != 1 || usage.calls != 1 {
		t.Fatalf("cached check api/usage = %d/%d, want 1/1", api.calls, usage.calls)
	}
}

func TestCheckerProviderErrorFailsAndLogs(t *testing.T) {
	cache := newFakeCache()
	api := &fakeAPI{err: errors.New("provider down")}
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, &slog.HandlerOptions{Level: slog.LevelWarn}))
	c := NewChecker(cache, api, nil, AnnualCallLimit, logger)
	c.now = func() time.Time { return time.Date(2026, 6, 1, 10, 0, 0, 0, IST) }

	raining, err := c.IsRaining(context.Background(), "9:9")
	if err == nil || raining {
		t.Fatalf("first check = %v, %v; want fail-closed error, false", raining, err)
	}
	if api.calls != 1 {
		t.Fatalf("provider calls = %d, want 1", api.calls)
	}
	if got := cache.ints["faazio:v1:weather:calls:2026-27"]; got != 1 {
		t.Fatalf("failed call must count against the budget, counter = %d", got)
	}

	// A provider failure is never cached as a dry verdict, so the next check retries the provider —
	// and every failure is logged in detail.
	raining, err = c.IsRaining(context.Background(), "9:9")
	if err == nil || raining {
		t.Fatalf("recheck = %v, %v; want fail-closed error, false", raining, err)
	}
	if api.calls != 2 {
		t.Fatalf("recheck must call the provider again (no dry cache): calls=%d", api.calls)
	}
	logged := logs.String()
	if !strings.Contains(logged, "weather_degraded") || !strings.Contains(logged, "provider down") {
		t.Fatalf("failure must be logged in detail, got: %s", logged)
	}
}

func TestCheckerDisabledProviderFails(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, &slog.HandlerOptions{Level: slog.LevelWarn}))
	c := NewChecker(newFakeCache(), nil, nil, AnnualCallLimit, logger)
	raining, err := c.IsRaining(context.Background(), "9:9")
	if err == nil || raining {
		t.Fatalf("disabled provider = %v, %v; want fail-closed error, false", raining, err)
	}
	if !strings.Contains(logs.String(), "provider not configured") {
		t.Fatalf("disabled-provider failure must be logged, got: %s", logs.String())
	}
}

func TestCheckerOverrideSkipsProvider(t *testing.T) {
	api := &fakeAPI{}
	c := NewChecker(newFakeCache(), api, nil, AnnualCallLimit)
	c.SetOverride(context.Background(), "1:2", true)
	raining, err := c.IsRaining(context.Background(), "1:2")
	if err != nil || !raining {
		t.Fatalf("override = %v, %v; want true, nil", raining, err)
	}
	if api.calls != 0 {
		t.Fatalf("override must not call the provider, calls=%d", api.calls)
	}
}

func TestCheckerBudgetExhausted(t *testing.T) {
	cache := newFakeCache()
	cache.ints["faazio:v1:weather:calls:2026-27"] = 10
	api := &fakeAPI{raining: true}
	c := NewChecker(cache, api, nil, 10)
	c.now = func() time.Time { return time.Date(2026, 6, 1, 10, 0, 0, 0, IST) }

	raining, err := c.IsRaining(context.Background(), "3:4")
	if err == nil || raining {
		t.Fatalf("exhausted budget = %v, %v; want fail-closed error, false", raining, err)
	}
	if api.calls != 0 {
		t.Fatalf("exhausted budget must not call the provider: calls=%d", api.calls)
	}
}

func TestFinancialYear(t *testing.T) {
	cases := []struct {
		at   time.Time
		want string
	}{
		{time.Date(2026, 3, 31, 23, 0, 0, 0, IST), "2025-26"},
		{time.Date(2026, 4, 1, 0, 0, 0, 0, IST), "2026-27"},
		{time.Date(2027, 1, 15, 12, 0, 0, 0, IST), "2026-27"},
	}
	for _, c := range cases {
		if got := FinancialYear(c.at); got != c.want {
			t.Errorf("FinancialYear(%v) = %q, want %q", c.at, got, c.want)
		}
	}
}

func TestFinancialYearEndIsFuture(t *testing.T) {
	cases := []time.Time{
		time.Date(2026, 3, 31, 23, 0, 0, 0, IST),
		time.Date(2026, 4, 1, 0, 0, 0, 0, IST),
		time.Date(2027, 1, 15, 12, 0, 0, 0, IST),
	}
	for _, at := range cases {
		end := FinancialYearEnd(at)
		if !end.After(at) {
			t.Errorf("FinancialYearEnd(%v) = %v, want a future instant", at, end)
		}
		if end.Month() != time.April || end.Day() != 1 || end.Hour() != 0 {
			t.Errorf("FinancialYearEnd(%v) = %v, want Apr 1 00:00", at, end)
		}
	}
}
