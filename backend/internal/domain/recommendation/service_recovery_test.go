package recommendation_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

// scriptedAI sets distinct outcomes for StartSession vs Regenerate and counts how
// many times each is called, so a test can assert the recovery path precisely.
type scriptedAI struct {
	startSessionID string
	startRec       recommendation.AIRec
	startErr       error
	regenRec       recommendation.AIRec
	regenErr       error
	startCalls     int
	regenCalls     int
}

func (f *scriptedAI) StartSession(_ context.Context, _ []*wardrobe.ClothingItem, _ recommendation.RecBrief) (string, recommendation.AIRec, error) {
	f.startCalls++
	return f.startSessionID, f.startRec, f.startErr
}
func (f *scriptedAI) Regenerate(_ context.Context, _ string) (recommendation.AIRec, error) {
	f.regenCalls++
	return f.regenRec, f.regenErr
}
func (f *scriptedAI) Accept(_ context.Context, _ string) error { return nil }

func aiEnabledPrefs() *user.Preferences {
	return &user.Preferences{UserID: "u1", UseAI: true, Answers: map[string]string{}}
}

var testDate = time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC)

// A 5xx on regenerate (stale session after an AI restart) recovers by starting a
// fresh AI session — the core KAN-78 fix.
func TestGetOutfit_RegenerateServerError_StartsFreshSession(t *testing.T) {
	ai := &scriptedAI{
		regenErr:       recommendation.ErrAIServerError,
		startSessionID: "fresh-sess",
		startRec:       recommendation.AIRec{TopID: "top-1", BottomID: "bottom-1", ShoesID: "shoes-1"},
	}
	svc := newTestService(aiEnabledPrefs(), ai)

	rec, err := svc.GetOutfit(context.Background(), "u1", testDate, "stale-sess", "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ai.regenCalls != 1 || ai.startCalls != 1 {
		t.Fatalf("calls: regen=%d start=%d, want regen=1 start=1", ai.regenCalls, ai.startCalls)
	}
	if rec.Recommender != recommendation.RecommenderAI {
		t.Errorf("recommender = %q, want AI", rec.Recommender)
	}
	if rec.SessionID != "fresh-sess" {
		t.Errorf("sessionID = %q, want fresh-sess", rec.SessionID)
	}
}

// If the fresh session also fails, degrade gracefully to rule-based (no 500).
func TestGetOutfit_RegenerateServerError_FreshSessionAlsoFails_RuleBased(t *testing.T) {
	ai := &scriptedAI{
		regenErr: recommendation.ErrAIServerError,
		startErr: errors.New("ai still down"),
	}
	svc := newTestService(aiEnabledPrefs(), ai)

	rec, err := svc.GetOutfit(context.Background(), "u1", testDate, "stale-sess", "", "")
	if err != nil {
		t.Fatalf("expected graceful fallback, got error: %v", err)
	}
	if ai.regenCalls != 1 || ai.startCalls != 1 {
		t.Fatalf("calls: regen=%d start=%d, want regen=1 start=1", ai.regenCalls, ai.startCalls)
	}
	if rec.Recommender != recommendation.RecommenderRuleBased {
		t.Errorf("recommender = %q, want rule_based", rec.Recommender)
	}
	if rec.SessionID != "" {
		t.Errorf("sessionID = %q, want empty for rule-based", rec.SessionID)
	}
	if len(rec.Items) == 0 {
		t.Error("expected rule-based items, got none")
	}
}

// Regression: a 404 must still trigger the existing fresh-session recovery.
func TestGetOutfit_RegenerateSessionNotFound_StartsFreshSession(t *testing.T) {
	ai := &scriptedAI{
		regenErr:       recommendation.ErrSessionNotFound,
		startSessionID: "fresh-sess",
		startRec:       recommendation.AIRec{TopID: "top-1", BottomID: "bottom-1", ShoesID: "shoes-1"},
	}
	svc := newTestService(aiEnabledPrefs(), ai)

	rec, err := svc.GetOutfit(context.Background(), "u1", testDate, "stale-sess", "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ai.startCalls != 1 {
		t.Fatalf("startCalls = %d, want 1 (404 should still recover)", ai.startCalls)
	}
	if rec.Recommender != recommendation.RecommenderAI || rec.SessionID != "fresh-sess" {
		t.Errorf("got recommender=%q session=%q, want AI/fresh-sess", rec.Recommender, rec.SessionID)
	}
}

// A non-recoverable error (e.g. a 4xx contract error) must NOT start a fresh
// session; it falls straight to the rule-based fallback.
func TestGetOutfit_RegenerateContractError_NoRetry_RuleBased(t *testing.T) {
	ai := &scriptedAI{
		regenErr: errors.New("ai: status 400: bad request"),
	}
	svc := newTestService(aiEnabledPrefs(), ai)

	rec, err := svc.GetOutfit(context.Background(), "u1", testDate, "stale-sess", "", "")
	if err != nil {
		t.Fatalf("expected graceful fallback, got error: %v", err)
	}
	if ai.regenCalls != 1 || ai.startCalls != 0 {
		t.Fatalf("calls: regen=%d start=%d, want regen=1 start=0 (no fresh session)", ai.regenCalls, ai.startCalls)
	}
	if rec.Recommender != recommendation.RecommenderRuleBased {
		t.Errorf("recommender = %q, want rule_based", rec.Recommender)
	}
}
