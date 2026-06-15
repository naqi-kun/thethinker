package weather

import (
	"context"
	"errors"
	"testing"
	"time"
)

// fakeClient records calls and returns a canned reading or error.
type fakeClient struct {
	cond  *Conditions
	err   error
	calls int
}

func (f *fakeClient) GetConditions(_ context.Context, _ string) (*Conditions, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	c := *f.cond // copy so the caller can't mutate our canned value
	return &c, nil
}

// mapCache is a trivial in-test Cache.
type mapCache struct {
	m map[string]Conditions
}

func newMapCache() *mapCache { return &mapCache{m: map[string]Conditions{}} }

func (c *mapCache) Get(loc string) (*Conditions, bool) {
	v, ok := c.m[loc]
	if !ok {
		return nil, false
	}
	out := v
	return &out, true
}

func (c *mapCache) Put(loc string, r *Conditions) { c.m[loc] = *r }

func newServiceAt(client Client, cache Cache, now *time.Time) *Service {
	return &Service{
		client: client,
		cache:  cache,
		maxAge: defaultMaxAge,
		now:    func() time.Time { return *now },
	}
}

func TestGetConditions_LiveFetchStampsAndCaches(t *testing.T) {
	fixed := time.Date(2026, 6, 15, 8, 30, 0, 0, time.UTC)
	client := &fakeClient{cond: &Conditions{Temperature: 12, FeelsLike: 11, Description: "rain", Location: "London"}}
	cache := newMapCache()
	svc := newServiceAt(client, cache, &fixed)

	got, err := svc.GetConditions(context.Background(), "London")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Temperature != 12 || got.Description != "rain" {
		t.Fatalf("unexpected conditions: %+v", got)
	}
	if !got.ObservedAt.Equal(fixed) {
		t.Fatalf("ObservedAt = %v, want %v", got.ObservedAt, fixed)
	}
	// The reading must have been written to the cache for later fallback.
	cached, ok := cache.Get("London")
	if !ok {
		t.Fatal("expected live reading to be cached")
	}
	if !cached.ObservedAt.Equal(fixed) {
		t.Fatalf("cached ObservedAt = %v, want %v", cached.ObservedAt, fixed)
	}
}

func TestGetConditions_FailureWithinMaxAgeServesCache(t *testing.T) {
	t0 := time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC)
	now := t0
	client := &fakeClient{cond: &Conditions{Temperature: 12, FeelsLike: 11, Description: "rain", Location: "London"}}
	cache := newMapCache()
	svc := newServiceAt(client, cache, &now)

	if _, err := svc.GetConditions(context.Background(), "London"); err != nil {
		t.Fatalf("priming fetch failed: %v", err)
	}

	// Live provider now fails; advance to within max-age.
	client.err = errors.New("provider down")
	now = t0.Add(3 * time.Hour)

	got, err := svc.GetConditions(context.Background(), "London")
	if err != nil {
		t.Fatalf("expected cached reading, got error: %v", err)
	}
	if got.Temperature != 12 {
		t.Fatalf("unexpected cached temperature: %v", got.Temperature)
	}
	// The original observation time must be preserved, not refreshed.
	if !got.ObservedAt.Equal(t0) {
		t.Fatalf("ObservedAt = %v, want original %v", got.ObservedAt, t0)
	}
}

func TestGetConditions_FailurePastMaxAgeOmits(t *testing.T) {
	t0 := time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC)
	now := t0
	client := &fakeClient{cond: &Conditions{Temperature: 12, FeelsLike: 11, Description: "rain", Location: "London"}}
	cache := newMapCache()
	svc := newServiceAt(client, cache, &now)

	if _, err := svc.GetConditions(context.Background(), "London"); err != nil {
		t.Fatalf("priming fetch failed: %v", err)
	}

	client.err = errors.New("provider down")
	now = t0.Add(defaultMaxAge + time.Minute) // just past max-age

	got, err := svc.GetConditions(context.Background(), "London")
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
	if got != nil {
		t.Fatalf("expected nil conditions, got %+v", got)
	}
}

func TestGetConditions_CacheMissOmits(t *testing.T) {
	now := time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC)
	client := &fakeClient{err: errors.New("provider down")}
	svc := newServiceAt(client, newMapCache(), &now)

	got, err := svc.GetConditions(context.Background(), "Nowhere")
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
	if got != nil {
		t.Fatalf("expected nil conditions, got %+v", got)
	}
}

func TestGetConditions_NoClientNeverCallsProvider(t *testing.T) {
	now := time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC)
	cache := newMapCache()
	svc := newServiceAt(nil, cache, &now) // nil client == no API key configured

	// Empty cache → omit.
	got, err := svc.GetConditions(context.Background(), "London")
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
	if got != nil {
		t.Fatalf("expected nil conditions, got %+v", got)
	}

	// A previously cached reading within max-age is still served without a client.
	cache.Put("London", &Conditions{Temperature: 20, Description: "clear", ObservedAt: now.Add(-30 * time.Minute)})
	got, err = svc.GetConditions(context.Background(), "London")
	if err != nil {
		t.Fatalf("expected cached reading, got error: %v", err)
	}
	if got.Temperature != 20 {
		t.Fatalf("unexpected temperature: %v", got.Temperature)
	}
}
