package weather

import "context"

type Service struct {
	// TODO: inject external weather client (internal/infrastructure/external/weather)
}

func NewService() *Service {
	return &Service{}
}

// GetConditions returns the current conditions for a location.
//
// The real third-party weather integration is not wired yet, so this returns a
// stable placeholder snapshot. It exists so the recommendation flow (KAN-49) can
// surface a weather badge today; swap the body for a real client later.
func (s *Service) GetConditions(_ context.Context, location string) (*Conditions, error) {
	if location == "" {
		location = "your area"
	}
	return &Conditions{
		Temperature: 22,
		FeelsLike:   22,
		Description: "clear",
		Location:    location,
	}, nil
}
