package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	domain "school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

const openWeatherURL = "https://api.openweathermap.org/data/2.5/weather"

type Client struct {
	apiKey     string
	httpClient *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

// owmResponse is the minimal subset of the OpenWeatherMap /weather response we use.
type owmResponse struct {
	Weather []struct {
		Description string `json:"description"`
	} `json:"weather"`
	Main struct {
		Temp      float64 `json:"temp"`
		FeelsLike float64 `json:"feels_like"`
	} `json:"main"`
	Name string `json:"name"`
}

// GetConditions fetches current weather for the given location (city name or postcode).
// OpenWeatherMap accepts both: https://openweathermap.org/current
func (c *Client) GetConditions(ctx context.Context, location string) (*domain.Conditions, error) {
	params := url.Values{}
	params.Set("q", location)
	params.Set("units", "metric")
	params.Set("appid", c.apiKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, openWeatherURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("weather: build request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("weather: http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("weather: location %q not found", location)
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("weather: invalid API key")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("weather: status %d", resp.StatusCode)
	}

	var owm owmResponse
	if err := json.NewDecoder(resp.Body).Decode(&owm); err != nil {
		return nil, fmt.Errorf("weather: decode: %w", err)
	}

	description := "clear"
	if len(owm.Weather) > 0 {
		description = owm.Weather[0].Description
	}
	loc := owm.Name
	if loc == "" {
		loc = location
	}

	return &domain.Conditions{
		Temperature: owm.Main.Temp,
		FeelsLike:   owm.Main.FeelsLike,
		Description: description,
		Location:    loc,
	}, nil
}
