package ai

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
)

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
