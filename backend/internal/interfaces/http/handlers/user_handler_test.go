package handlers_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/handlers"
)

type mockUserSvc struct {
	register        func(ctx context.Context, email, password string) (*user.AuthResult, error)
	login           func(ctx context.Context, email, password string) (*user.AuthResult, error)
	getPreferences  func(ctx context.Context, userID string) (*user.Preferences, error)
	savePreferences func(ctx context.Context, p *user.Preferences) error
}

func (m *mockUserSvc) Register(ctx context.Context, email, password string) (*user.AuthResult, error) {
	return m.register(ctx, email, password)
}

func (m *mockUserSvc) Login(ctx context.Context, email, password string) (*user.AuthResult, error) {
	return m.login(ctx, email, password)
}

func (m *mockUserSvc) GetPreferences(ctx context.Context, userID string) (*user.Preferences, error) {
	if m.getPreferences != nil {
		return m.getPreferences(ctx, userID)
	}
	return &user.Preferences{UserID: userID, Styles: []string{}, Answers: map[string]string{}}, nil
}

func (m *mockUserSvc) SavePreferences(ctx context.Context, p *user.Preferences) error {
	if m.savePreferences != nil {
		return m.savePreferences(ctx, p)
	}
	return nil
}

func authResult() *user.AuthResult {
	return &user.AuthResult{Token: "tok-abc", UserID: "user-123"}
}

func TestRegister(t *testing.T) {
	validBody := `{"email":"dev@thethinker.com","password":"password123"}`

	tests := []struct {
		name       string
		body       string
		svcResult  *user.AuthResult
		svcErr     error
		wantStatus int
	}{
		{
			name:       "happy path returns 201 with token",
			body:       validBody,
			svcResult:  authResult(),
			wantStatus: http.StatusCreated,
		},
		{
			name:       "invalid JSON returns 400",
			body:       `not-json`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing email returns 400",
			body:       `{"email":"","password":"password123"}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing password returns 400",
			body:       `{"email":"dev@thethinker.com","password":""}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "short password returns 400",
			body:       `{"email":"dev@thethinker.com","password":"short"}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "duplicate email returns 409",
			body:       validBody,
			svcErr:     user.ErrEmailTaken,
			wantStatus: http.StatusConflict,
		},
		{
			name:       "service error returns 500",
			body:       validBody,
			svcErr:     errors.New("db unavailable"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, svcErr := tc.svcResult, tc.svcErr
			svc := &mockUserSvc{
				register: func(_ context.Context, _, _ string) (*user.AuthResult, error) {
					return result, svcErr
				},
			}
			h := handlers.NewUserHandler(svc)

			req := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			h.Register(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", rr.Code, tc.wantStatus, rr.Body.String())
			}
		})
	}
}

func TestLogin(t *testing.T) {
	validBody := `{"email":"dev@thethinker.com","password":"password123"}`

	tests := []struct {
		name       string
		body       string
		svcResult  *user.AuthResult
		svcErr     error
		wantStatus int
	}{
		{
			name:       "happy path returns 200 with token",
			body:       validBody,
			svcResult:  authResult(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid JSON returns 400",
			body:       `not-json`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing email returns 400",
			body:       `{"email":"","password":"password123"}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing password returns 400",
			body:       `{"email":"dev@thethinker.com","password":""}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "wrong credentials returns 401",
			body:       validBody,
			svcErr:     user.ErrInvalidCredentials,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "service error returns 500",
			body:       validBody,
			svcErr:     errors.New("db unavailable"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, svcErr := tc.svcResult, tc.svcErr
			svc := &mockUserSvc{
				login: func(_ context.Context, _, _ string) (*user.AuthResult, error) {
					return result, svcErr
				},
			}
			h := handlers.NewUserHandler(svc)

			req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			h.Login(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", rr.Code, tc.wantStatus, rr.Body.String())
			}
		})
	}
}
