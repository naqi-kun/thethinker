package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

// StartSession must forward every styling-relevant attribute to the AI service.
// pattern and description in particular carry nuance the coarse enums lose, so a
// dropped field silently degrades recommendations rather than erroring (regression
// guard: pattern was added to the domain but initially not sent on the wire).
func TestRecommendClient_StartSessionSendsItemAttributes(t *testing.T) {
	var body startRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_, _ = w.Write([]byte(`{"session_id":"s1","recommendation":{}}`))
	}))
	defer srv.Close()

	items := []*wardrobe.ClothingItem{{
		ID:          "item-1",
		SubType:     wardrobe.SubTypeShirt,
		Category:    wardrobe.CategoryCasual,
		Color:       wardrobe.ColorBlue,
		Fit:         wardrobe.FitRegular,
		Season:      wardrobe.SeasonAll,
		Pattern:     wardrobe.PatternPlaid,
		Description: "blue flannel plaid shirt",
	}}

	_, _, err := NewRecommendClient(srv.URL).StartSession(context.Background(), items, recommendation.RecBrief{})
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}

	if len(body.WardrobeItems) != 1 {
		t.Fatalf("expected 1 wardrobe item on the wire, got %d", len(body.WardrobeItems))
	}
	got := body.WardrobeItems[0]
	if got.Pattern != "plaid" {
		t.Errorf("pattern not forwarded: got %q, want %q", got.Pattern, "plaid")
	}
	if got.Description != "blue flannel plaid shirt" {
		t.Errorf("description not forwarded: got %q", got.Description)
	}
}

// The AI client must translate HTTP status codes into the domain error vocabulary
// so the recommendation service can decide whether a fresh session may help.
func TestRecommendClient_StatusErrorMapping(t *testing.T) {
	cases := []struct {
		name     string
		status   int
		sentinel error // expected errors.Is target; nil means "generic, neither sentinel"
	}{
		{"404 maps to session-not-found", http.StatusNotFound, recommendation.ErrSessionNotFound},
		{"500 maps to ai-server-error", http.StatusInternalServerError, recommendation.ErrAIServerError},
		{"503 maps to ai-server-error", http.StatusServiceUnavailable, recommendation.ErrAIServerError},
		{"400 stays generic (not recoverable)", http.StatusBadRequest, nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte("body"))
			}))
			defer srv.Close()

			_, regenErr := NewRecommendClient(srv.URL).Regenerate(context.Background(), "sess")
			if regenErr == nil {
				t.Fatalf("status %d: expected an error", tc.status)
			}
			if tc.sentinel == nil {
				if errors.Is(regenErr, recommendation.ErrSessionNotFound) ||
					errors.Is(regenErr, recommendation.ErrAIServerError) {
					t.Errorf("status %d mapped to a recoverable sentinel, want generic: %v", tc.status, regenErr)
				}
				return
			}
			if !errors.Is(regenErr, tc.sentinel) {
				t.Errorf("status %d: got %v, want errors.Is(%v)", tc.status, regenErr, tc.sentinel)
			}
		})
	}
}
