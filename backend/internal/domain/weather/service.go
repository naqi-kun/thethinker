package weather

import (
	"context"
	"errors"
	"log"
	"time"
)

// Client is the port for the external weather data provider.
// The implementation lives in internal/infrastructure/external/weather.
type Client interface {
	GetConditions(ctx context.Context, location string) (*Conditions, error)
}

// Cache is the port for last-known-good weather storage. The default
// implementation is an in-memory map (internal/infrastructure/persistence/memory);
// it can be swapped for a Postgres-backed store without touching the domain.
type Cache interface {
	// Get returns the most recent reading stored for location, if any.
	Get(location string) (*Conditions, bool)
	// Put stores reading as the latest known-good conditions for location.
	Put(location string, reading *Conditions)
}

// ErrUnavailable is returned when there is no live reading and no cached
// reading within max-age. Callers should omit weather entirely in this case
// rather than substitute fabricated data.
var ErrUnavailable = errors.New("weather: no current or recent conditions available")

// defaultMaxAge is how long a cached last-known-good reading remains servable
// after the live provider stops responding.
const defaultMaxAge = 6 * time.Hour

type Service struct {
	client Client // nil when no API key is configured
	cache  Cache
	maxAge time.Duration
	now    func() time.Time // injectable for tests
}

func NewService(client Client, cache Cache) *Service {
	return &Service{
		client: client,
		cache:  cache,
		maxAge: defaultMaxAge,
		now:    time.Now,
	}
}

// GetConditions returns the current conditions for a location.
//
// On a successful live fetch it stamps the reading with the observation time,
// stores it as last-known-good for that location, and returns it. If the live
// fetch fails (or no client is wired) it serves the cached reading for that
// location when one exists and is within max-age — preserving its original
// ObservedAt so callers can render an "as of" hint. If nothing usable is
// cached it returns ErrUnavailable so the caller omits weather rather than
// presenting fabricated data.
func (s *Service) GetConditions(ctx context.Context, location string) (*Conditions, error) {
	if location == "" {
		location = "your area"
	}

	if s.client != nil {
		cond, err := s.client.GetConditions(ctx, location)
		if err == nil {
			cond.ObservedAt = s.now().UTC()
			s.cache.Put(location, cond)
			return cond, nil
		}
		log.Printf("weather: live fetch failed for %q (%v); falling back to last-known-good cache", location, err)
	} else {
		log.Printf("weather: no API key configured; falling back to last-known-good cache for %q", location)
	}

	cached, ok := s.cache.Get(location)
	if !ok {
		log.Printf("weather: cache miss for %q; omitting weather", location)
		return nil, ErrUnavailable
	}

	age := s.now().Sub(cached.ObservedAt)
	if age > s.maxAge {
		log.Printf("weather: cached reading for %q is stale (age %s > max-age %s); omitting weather",
			location, age.Round(time.Minute), s.maxAge)
		return nil, ErrUnavailable
	}

	log.Printf("weather: serving last-known-good cache for %q (observed %s, age %s)",
		location, cached.ObservedAt.Format(time.RFC3339), age.Round(time.Minute))
	return cached, nil
}
