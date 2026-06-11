package weather

import "context"

// Client is the port for the external weather data provider.
// The implementation lives in internal/infrastructure/external/weather.
type Client interface {
	GetConditions(ctx context.Context, location string) (*Conditions, error)
}

type Service struct {
	client Client // nil → stub fallback
}

func NewService(client Client) *Service {
	return &Service{client: client}
}

// GetConditions returns the current conditions for a location.
// If no client is wired (nil) or the call fails, it returns a stable stub so
// the recommendation flow always has weather data to work with.
func (s *Service) GetConditions(ctx context.Context, location string) (*Conditions, error) {
	if location == "" {
		location = "your area"
	}
	if s.client != nil {
		cond, err := s.client.GetConditions(ctx, location)
		if err == nil {
			return cond, nil
		}
		// fall through to stub on any error (bad API key, network, unknown city…)
	}
	return &Conditions{
		Temperature: 22,
		FeelsLike:   22,
		Description: "clear",
		Location:    location,
	}, nil
}
