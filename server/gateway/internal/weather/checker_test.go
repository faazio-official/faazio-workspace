package weather

import (
	"context"
	"encoding/json"
	"errors"
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

func TestCheckerCachesProviderErrorAsDry(t *testing.T) {
	cache := newFakeCache()
	api := &fakeAPI{err: errors.New("provider down")}
	c := NewChecker(cache, api, nil, AnnualCallLimit)
	c.now = func() time.Time { return time.Date(2026, 6, 1, 10, 0, 0, 0, IST) }

	raining, err := c.IsRaining(context.Background(), "9:9")
	if err == nil || raining {
		t.Fatalf("first check = %v, %v; want false + error", raining, err)
	}
	if api.calls != 1 {
		t.Fatalf("provider calls = %d, want 1", api.calls)
	}
	if got := cache.ints["faazio:v1:weather:calls:2026-27"]; got != 1 {
		t.Fatalf("failed call must count against the budget, counter = %d", got)
	}

	// The failed window is cached dry, so the next quote cannot hammer the provider.
	raining, err = c.IsRaining(context.Background(), "9:9")
	if err != nil || raining {
		t.Fatalf("cached check = %v, %v; want false, nil", raining, err)
	}
	if api.calls != 1 {
		t.Fatalf("cached check must not call the provider again: calls=%d", api.calls)
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
	if err == nil {
		t.Fatal("expected a budget-exhausted error")
	}
	if raining || api.calls != 0 {
		t.Fatalf("exhausted budget must not call the provider: raining=%v calls=%d", raining, api.calls)
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
