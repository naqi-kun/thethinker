package weather

import "time"

type Conditions struct {
	Temperature float64
	FeelsLike   float64
	Description string // "sunny" | "rainy" | "cloudy" | etc.
	Location    string
	// ObservedAt is when the reading was actually fetched from the provider.
	// Set on every successful live fetch; preserved when a cached last-known-good
	// reading is served after a later lookup fails. Zero for readings that never
	// came from a live fetch.
	ObservedAt time.Time
}
