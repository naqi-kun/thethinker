package recommendation_test

import (
	"context"
	"testing"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

// fakeWeatherClient is a weather.Client that always returns fixed conditions,
// so we can assert the service threads them into the AI brief.
type fakeWeatherClient struct{ cond *weather.Conditions }

func (f *fakeWeatherClient) GetConditions(_ context.Context, _ string) (*weather.Conditions, error) {
	return f.cond, nil
}

func newWeatherService(ai recommendation.AIRecommender, wsvc *weather.Service, prefs *user.Preferences) *recommendation.Service {
	return recommendation.NewService(
		&fakeWardrobeRepo{items: testWardrobe()},
		&eventsCalendarRepo{},
		&fakePrefsRepo{prefs: prefs},
		wsvc,
		ai,
		&stubHistoryRepo{},
		&stubTransactor{},
	)
}

func TestGetOutfit_PassesWeatherIntoBrief(t *testing.T) {
	prefs := &user.Preferences{UserID: "u1", UseAI: true, Answers: map[string]string{"location": "Berlin"}}
	ai := &capturingAI{}
	wsvc := weather.NewService(
		&fakeWeatherClient{cond: &weather.Conditions{Temperature: 6, FeelsLike: 3, Description: "light rain"}},
		emptyWeatherCache{},
	)

	if _, err := newWeatherService(ai, wsvc, prefs).GetOutfit(context.Background(), "u1", testDate, "", "", ""); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ai.brief.Weather == nil {
		t.Fatal("brief.Weather = nil, want conditions passed through")
	}
	if ai.brief.Weather.Temperature != 6 || ai.brief.Weather.Description != "light rain" {
		t.Errorf("brief.Weather = %+v, want 6°C / light rain", ai.brief.Weather)
	}
}

// With no saved location the service never looks weather up, so the brief must
// carry nil — the stylist falls back to weather-agnostic styling.
func TestGetOutfit_OmitsWeatherWithoutLocation(t *testing.T) {
	prefs := &user.Preferences{UserID: "u1", UseAI: true, Answers: map[string]string{}}
	ai := &capturingAI{}
	wsvc := weather.NewService(
		&fakeWeatherClient{cond: &weather.Conditions{Temperature: 6, Description: "light rain"}},
		emptyWeatherCache{},
	)

	if _, err := newWeatherService(ai, wsvc, prefs).GetOutfit(context.Background(), "u1", testDate, "", "", ""); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ai.brief.Weather != nil {
		t.Errorf("brief.Weather = %+v, want nil when no location is set", ai.brief.Weather)
	}
}
