package recommendation_test

import (
	"context"
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

// capturingAI records the brief it was handed so a test can assert what occasion
// and aesthetic the service resolved.
type capturingAI struct {
	brief recommendation.RecBrief
}

func (c *capturingAI) StartSession(_ context.Context, _ []*wardrobe.ClothingItem, brief recommendation.RecBrief) (string, recommendation.AIRec, error) {
	c.brief = brief
	return "sess", recommendation.AIRec{TopID: "top-1", BottomID: "bottom-1", ShoesID: "shoes-1"}, nil
}
func (c *capturingAI) Regenerate(_ context.Context, _ string) (recommendation.AIRec, error) {
	return recommendation.AIRec{TopID: "top-1", BottomID: "bottom-1", ShoesID: "shoes-1"}, nil
}
func (c *capturingAI) Accept(_ context.Context, _ string) error { return nil }

// eventsCalendarRepo returns a fixed set of events for the day.
type eventsCalendarRepo struct {
	stubCalendarRepo
	events []*calendar.Event
}

func (e *eventsCalendarRepo) FindEventsByDate(_ context.Context, _ string, _ time.Time) ([]*calendar.Event, error) {
	return e.events, nil
}

func newOccasionService(ai recommendation.AIRecommender, cal calendar.Repository, prefs *user.Preferences) *recommendation.Service {
	return recommendation.NewService(
		&fakeWardrobeRepo{items: testWardrobe()},
		cal,
		&fakePrefsRepo{prefs: prefs},
		weather.NewService(nil, emptyWeatherCache{}),
		ai,
		&stubHistoryRepo{},
		&stubTransactor{},
	)
}

func TestGetOutfit_OccasionResolution(t *testing.T) {
	lunch := &calendar.Event{ID: "ev-lunch", Title: "Client lunch", Type: "casual"}
	standup := &calendar.Event{ID: "ev-standup", Title: "Board meeting", Type: "meeting"}
	cal := &eventsCalendarRepo{events: []*calendar.Event{lunch, standup}}

	cases := []struct {
		name         string
		occasionArg  string
		eventID      string
		cal          calendar.Repository
		wantOccasion string
		wantLabel    string
	}{
		{
			name:         "default picks the most-formal event of the day",
			cal:          cal,
			wantOccasion: "formal",
			wantLabel:    "Board meeting",
		},
		{
			name:         "explicit event_id dresses for that event",
			eventID:      "ev-lunch",
			cal:          cal,
			wantOccasion: "casual",
			wantLabel:    "Client lunch",
		},
		{
			name:         "explicit occasion override is honored",
			occasionArg:  "sport",
			cal:          cal,
			wantOccasion: "sport",
			wantLabel:    "Sport",
		},
		{
			name:         "no events degrades to everyday",
			cal:          &eventsCalendarRepo{},
			wantOccasion: "everyday",
			wantLabel:    "Everyday",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ai := &capturingAI{}
			svc := newOccasionService(ai, tc.cal, aiEnabledPrefs())

			rec, err := svc.GetOutfit(context.Background(), "u1", testDate, "", tc.occasionArg, tc.eventID)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ai.brief.Occasion != tc.wantOccasion {
				t.Errorf("brief.Occasion = %q, want %q", ai.brief.Occasion, tc.wantOccasion)
			}
			if rec.Occasion != tc.wantLabel {
				t.Errorf("response Occasion = %q, want %q", rec.Occasion, tc.wantLabel)
			}
		})
	}
}

func TestGetOutfit_PassesAestheticFromPrefs(t *testing.T) {
	prefs := &user.Preferences{UserID: "u1", UseAI: true, Answers: map[string]string{"aesthetic": "minimalist"}}
	ai := &capturingAI{}
	svc := newOccasionService(ai, &eventsCalendarRepo{}, prefs)

	if _, err := svc.GetOutfit(context.Background(), "u1", testDate, "", "", ""); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ai.brief.Aesthetic != "minimalist" {
		t.Errorf("brief.Aesthetic = %q, want %q", ai.brief.Aesthetic, "minimalist")
	}
}

// legacy "inspiration" data still yields an aesthetic signal (first entry).
func TestGetOutfit_AestheticFallsBackToInspiration(t *testing.T) {
	prefs := &user.Preferences{UserID: "u1", UseAI: true, Answers: map[string]string{"inspiration": "streetwear,classic"}}
	ai := &capturingAI{}
	svc := newOccasionService(ai, &eventsCalendarRepo{}, prefs)

	if _, err := svc.GetOutfit(context.Background(), "u1", testDate, "", "", ""); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ai.brief.Aesthetic != "streetwear" {
		t.Errorf("brief.Aesthetic = %q, want %q", ai.brief.Aesthetic, "streetwear")
	}
}
