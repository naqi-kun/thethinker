package weather

type Conditions struct {
	Temperature float64
	FeelsLike   float64
	Description string // "sunny" | "rainy" | "cloudy" | etc.
	Location    string
}
