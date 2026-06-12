package recommendation_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

// fakeWardrobeRepo returns a fixed wardrobe for any user.
type fakeWardrobeRepo struct {
	stubWardrobeRepo
	items []*wardrobe.ClothingItem
}

func (f *fakeWardrobeRepo) FindByUserID(_ context.Context, _ string) ([]*wardrobe.ClothingItem, error) {
	return f.items, nil
}

// fakePrefsRepo returns fixed preferences (or nil to simulate a new user).
type fakePrefsRepo struct {
	prefs *user.Preferences
}

func (f *fakePrefsRepo) FindPreferences(_ context.Context, _ string) (*user.Preferences, error) {
	return f.prefs, nil
}

// fakeAI either succeeds with a fixed recommendation or always errors.
type fakeAI struct {
	sessionID string
	rec       recommendation.AIRec
	err       error
}

func (f *fakeAI) StartSession(_ context.Context, _ []*wardrobe.ClothingItem) (string, recommendation.AIRec, error) {
	return f.sessionID, f.rec, f.err
}
func (f *fakeAI) Regenerate(_ context.Context, _ string) (recommendation.AIRec, error) {
	return f.rec, f.err
}
func (f *fakeAI) Accept(_ context.Context, _ string) error { return nil }

func testWardrobe() []*wardrobe.ClothingItem {
	return []*wardrobe.ClothingItem{
		{ID: "top-1", SubType: wardrobe.SubTypeTShirt, Season: wardrobe.SeasonAll},
		{ID: "bottom-1", SubType: wardrobe.SubTypeJeans, Season: wardrobe.SeasonAll},
		{ID: "shoes-1", SubType: wardrobe.SubTypeSneakers, Season: wardrobe.SeasonAll},
	}
}

func newTestService(prefs *user.Preferences, ai recommendation.AIRecommender) *recommendation.Service {
	return recommendation.NewService(
		&fakeWardrobeRepo{items: testWardrobe()},
		&stubCalendarRepo{},
		&fakePrefsRepo{prefs: prefs},
		weather.NewService(nil),
		ai,
		&stubHistoryRepo{},
		&stubTransactor{},
	)
}

func TestGetOutfit_UseAIDisabled_UsesRuleBased(t *testing.T) {
	prefs := &user.Preferences{UserID: "u1", UseAI: false, Answers: map[string]string{}}
	ai := &fakeAI{sessionID: "should-not-be-used", rec: recommendation.AIRec{TopID: "top-1"}}
	svc := newTestService(prefs, ai)

	rec, err := svc.GetOutfit(context.Background(), "u1", time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Recommender != recommendation.RecommenderRuleBased {
		t.Errorf("recommender = %q, want %q", rec.Recommender, recommendation.RecommenderRuleBased)
	}
	if rec.SessionID != "" {
		t.Errorf("sessionID = %q, want empty for rule-based", rec.SessionID)
	}
	if len(rec.Items) == 0 {
		t.Error("expected rule-based items, got none")
	}
}

func TestGetOutfit_AIError_FallsBackToRuleBased(t *testing.T) {
	prefs := &user.Preferences{UserID: "u1", UseAI: true, Answers: map[string]string{}}
	ai := &fakeAI{err: errors.New("ai service down")}
	svc := newTestService(prefs, ai)

	rec, err := svc.GetOutfit(context.Background(), "u1", time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC), "")
	if err != nil {
		t.Fatalf("expected graceful fallback, got error: %v", err)
	}
	if rec.Recommender != recommendation.RecommenderRuleBased {
		t.Errorf("recommender = %q, want %q", rec.Recommender, recommendation.RecommenderRuleBased)
	}
	if len(rec.Items) == 0 {
		t.Error("expected rule-based items, got none")
	}
}

func TestGetOutfit_AISucceeds_ReportsAIRecommender(t *testing.T) {
	prefs := &user.Preferences{UserID: "u1", UseAI: true, Answers: map[string]string{}}
	ai := &fakeAI{
		sessionID: "sess-42",
		rec:       recommendation.AIRec{TopID: "top-1", BottomID: "bottom-1", ShoesID: "shoes-1"},
	}
	svc := newTestService(prefs, ai)

	rec, err := svc.GetOutfit(context.Background(), "u1", time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Recommender != recommendation.RecommenderAI {
		t.Errorf("recommender = %q, want %q", rec.Recommender, recommendation.RecommenderAI)
	}
	if rec.SessionID != "sess-42" {
		t.Errorf("sessionID = %q, want sess-42", rec.SessionID)
	}
	if len(rec.Items) != 3 {
		t.Errorf("items = %d, want 3", len(rec.Items))
	}
}

func TestGetOutfit_NoPreferences_DefaultsToAI(t *testing.T) {
	ai := &fakeAI{
		sessionID: "sess-1",
		rec:       recommendation.AIRec{TopID: "top-1", BottomID: "bottom-1", ShoesID: "shoes-1"},
	}
	svc := newTestService(nil, ai) // no prefs row at all

	rec, err := svc.GetOutfit(context.Background(), "u1", time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Recommender != recommendation.RecommenderAI {
		t.Errorf("recommender = %q, want %q (AI should be the default)", rec.Recommender, recommendation.RecommenderAI)
	}
}
