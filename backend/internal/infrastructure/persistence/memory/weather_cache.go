// Package memory holds in-memory implementations of domain ports. These survive
// the process lifetime and reset on restart — suitable for caches and other
// non-authoritative state that a durable store can later replace behind the
// same port.
package memory

import (
	"strings"
	"sync"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

// WeatherCache is an in-memory, concurrency-safe last-known-good store keyed by
// normalized location. It implements weather.Cache. It does not evict on its
// own — the weather.Service enforces max-age on read, so stale entries are
// simply never served (and overwritten on the next successful live fetch).
type WeatherCache struct {
	mu       sync.RWMutex
	readings map[string]weather.Conditions
}

// NewWeatherCache returns an empty cache ready for use.
func NewWeatherCache() *WeatherCache {
	return &WeatherCache{readings: make(map[string]weather.Conditions)}
}

func (c *WeatherCache) Get(location string) (*weather.Conditions, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	reading, ok := c.readings[normalize(location)]
	if !ok {
		return nil, false
	}
	// Return a copy so callers can't mutate the stored entry.
	out := reading
	return &out, true
}

func (c *WeatherCache) Put(location string, reading *weather.Conditions) {
	if reading == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.readings[normalize(location)] = *reading
}

func normalize(location string) string {
	return strings.ToLower(strings.TrimSpace(location))
}
