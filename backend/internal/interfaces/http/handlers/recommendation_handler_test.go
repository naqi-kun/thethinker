package handlers_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/handlers"
)

type mockRecommendationSvc struct {
	outfit    *recommendation.OutfitRecommendation
	err       error
	acceptErr error
}

func (m *mockRecommendationSvc) GetOutfit(_ context.Context, _ string, _ time.Time, _, _, _ string) (*recommendation.OutfitRecommendation, error) {
	return m.outfit, m.err
}

func (m *mockRecommendationSvc) AcceptAndRecord(_ context.Context, _, _ string, _ []string) error {
	return m.acceptErr
}

func TestAcceptOutfit(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		injectUser bool
		svcErr     error
		wantStatus int
	}{
		{
			name:       "happy path returns 204",
			body:       `{"item_ids":["id-1","id-2"]}`,
			injectUser: true,
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "missing auth context returns 401",
			body:       `{"item_ids":["id-1"]}`,
			injectUser: false,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid JSON returns 400",
			body:       `not-json`,
			injectUser: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "empty item_ids returns 400",
			body:       `{"item_ids":[]}`,
			injectUser: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "service error returns 500",
			body:       `{"item_ids":["id-1"]}`,
			injectUser: true,
			svcErr:     errors.New("db unavailable"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h := handlers.NewRecommendationHandler(&mockRecommendationSvc{acceptErr: tc.svcErr})

			req := httptest.NewRequest(http.MethodPost, "/recommendations/outfit/accept",
				strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			if tc.injectUser {
				req = withUserID(req, "user-123")
			}

			rr := httptest.NewRecorder()
			h.AcceptOutfit(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", rr.Code, tc.wantStatus, rr.Body.String())
			}
		})
	}
}

func TestGetOutfit(t *testing.T) {
	validOutfit := &recommendation.OutfitRecommendation{
		SessionID: "sess-1",
		UserID:    "user-123",
		Date:      time.Now(),
		Items:     nil,
		Occasion:  "casual",
		CreatedAt: time.Now(),
	}

	tests := []struct {
		name       string
		injectUser bool
		outfit     *recommendation.OutfitRecommendation
		svcErr     error
		wantStatus int
	}{
		{
			name:       "happy path returns 200",
			injectUser: true,
			outfit:     validOutfit,
			wantStatus: http.StatusOK,
		},
		{
			name:       "missing auth context returns 401",
			injectUser: false,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "empty wardrobe returns 404",
			injectUser: true,
			svcErr:     recommendation.ErrEmptyWardrobe,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "service error returns 500",
			injectUser: true,
			svcErr:     errors.New("db unavailable"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := &mockRecommendationSvc{outfit: tc.outfit, err: tc.svcErr}
			h := handlers.NewRecommendationHandler(svc)

			req := httptest.NewRequest(http.MethodGet, "/recommendations/outfit", nil)
			if tc.injectUser {
				req = withUserID(req, "user-123")
			}

			rr := httptest.NewRecorder()
			h.GetOutfit(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", rr.Code, tc.wantStatus, rr.Body.String())
			}
		})
	}
}
