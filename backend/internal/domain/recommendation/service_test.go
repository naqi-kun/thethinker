package recommendation_test

import (
	"context"
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

// emptyWeatherCache is a do-nothing weather.Cache: it stores nothing and never
// hits, so weather.NewService with a nil client always reports ErrUnavailable —
// exercising the nil-conditions (month-heuristic) recommendation path.
type emptyWeatherCache struct{}

func (emptyWeatherCache) Get(string) (*weather.Conditions, bool) { return nil, false }
func (emptyWeatherCache) Put(string, *weather.Conditions)        {}

func TestDeriveTimeOfDay(t *testing.T) {
	cases := []struct {
		hour int
		want recommendation.TimeOfDay
	}{
		{6, recommendation.TimeOfDayMorning},
		{11, recommendation.TimeOfDayMorning},
		{12, recommendation.TimeOfDayAfternoon},
		{16, recommendation.TimeOfDayAfternoon},
		{17, recommendation.TimeOfDayEvening},
		{23, recommendation.TimeOfDayEvening},
	}
	for _, tc := range cases {
		ts := time.Date(2026, 6, 11, tc.hour, 0, 0, 0, time.UTC)
		got := recommendation.DeriveTimeOfDay(ts)
		if got != tc.want {
			t.Errorf("hour %d: got %q, want %q", tc.hour, got, tc.want)
		}
	}
}

type stubWardrobeRepo struct{}

func (s *stubWardrobeRepo) FindByUserID(_ context.Context, _ string) ([]*wardrobe.ClothingItem, error) {
	return nil, nil
}
func (s *stubWardrobeRepo) FindByID(_ context.Context, _ string) (*wardrobe.ClothingItem, error) {
	return nil, nil
}
func (s *stubWardrobeRepo) Save(_ context.Context, _ *wardrobe.ClothingItem) error { return nil }
func (s *stubWardrobeRepo) UpdateImageURL(_ context.Context, _, _ string) error    { return nil }
func (s *stubWardrobeRepo) UpdateStatus(_ context.Context, _ string, _ wardrobe.Status) error {
	return nil
}
func (s *stubWardrobeRepo) Delete(_ context.Context, _ string) error { return nil }
func (s *stubWardrobeRepo) MarkWorn(_ context.Context, _ string, _ []string, _ time.Time) error {
	return nil
}

type stubCalendarRepo struct{}

func (s *stubCalendarRepo) SaveCalendar(_ context.Context, _ *calendar.Calendar) error { return nil }
func (s *stubCalendarRepo) ListCalendars(_ context.Context, _ string) ([]*calendar.Calendar, error) {
	return nil, nil
}
func (s *stubCalendarRepo) ListAllCalendars(_ context.Context) ([]*calendar.Calendar, error) {
	return nil, nil
}
func (s *stubCalendarRepo) FindCalendar(_ context.Context, _, _ string) (*calendar.Calendar, error) {
	return nil, nil
}
func (s *stubCalendarRepo) DeleteCalendar(_ context.Context, _, _ string) error { return nil }
func (s *stubCalendarRepo) ReplaceCalendarEvents(_ context.Context, _ string, _ []*calendar.Event) error {
	return nil
}
func (s *stubCalendarRepo) FindEventsByDate(_ context.Context, _ string, _ time.Time) ([]*calendar.Event, error) {
	return nil, nil
}
func (s *stubCalendarRepo) SetEventIgnored(_ context.Context, _, _ string, _ bool) (bool, error) {
	return false, nil
}
func (s *stubCalendarRepo) FindConnection(_ context.Context, _ string) (*calendar.CalendarConnection, error) {
	return nil, nil
}
func (s *stubCalendarRepo) SaveConnection(_ context.Context, _ *calendar.CalendarConnection) error {
	return nil
}
func (s *stubCalendarRepo) DeleteConnection(_ context.Context, _ string) error { return nil }
func (s *stubCalendarRepo) FindUpcomingEvents(_ context.Context, _ string) ([]*calendar.Event, error) {
	return nil, nil
}

type stubAIRecommender struct{}

func (s *stubAIRecommender) StartSession(_ context.Context, _ []*wardrobe.ClothingItem, _ recommendation.RecBrief) (string, recommendation.AIRec, error) {
	return "", recommendation.AIRec{}, nil
}
func (s *stubAIRecommender) Regenerate(_ context.Context, _ string) (recommendation.AIRec, error) {
	return recommendation.AIRec{}, nil
}
func (s *stubAIRecommender) Accept(_ context.Context, _ string) error { return nil }

type stubHistoryRepo struct{}

func (s *stubHistoryRepo) Save(_ context.Context, _ *recommendation.AcceptedOutfit) error {
	return nil
}
func (s *stubHistoryRepo) List(_ context.Context, _ string, _ string, _ int, _ recommendation.HistoryFilter) ([]*recommendation.AcceptedOutfit, string, error) {
	return nil, "", nil
}

type stubTransactor struct{}

func (s *stubTransactor) InTransaction(_ context.Context, fn func(context.Context) error) error {
	return fn(context.Background())
}

func TestAcceptAndRecord_EmptyItemIDs(t *testing.T) {
	svc := recommendation.NewService(
		&stubWardrobeRepo{},
		&stubCalendarRepo{},
		nil,
		weather.NewService(nil, emptyWeatherCache{}),
		&stubAIRecommender{},
		&stubHistoryRepo{},
		&stubTransactor{},
	)
	err := svc.AcceptAndRecord(context.Background(), "user-1", "", []string{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
