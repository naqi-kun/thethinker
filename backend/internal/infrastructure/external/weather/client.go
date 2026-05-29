package weather

import (
	"context"

	domain "school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

type Client struct {
	// TODO: apiKey string
	// TODO: httpClient *http.Client
}

func NewClient( /* apiKey string */ ) *Client {
	return &Client{}
}

// GetConditions fetches current weather for the given location.
// TODO: integrate with a weather API (e.g., OpenWeatherMap)
func (c *Client) GetConditions(ctx context.Context, location string) (*domain.Conditions, error) {
	panic("not implemented")
}
