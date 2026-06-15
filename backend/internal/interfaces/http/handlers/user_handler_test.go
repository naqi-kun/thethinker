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
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type mockUserSvc struct {
	register        func(ctx context.Context, email, password string) (*user.AuthResult, error)
	login           func(ctx context.Context, email, password string) (*user.AuthResult, error)
	getProfile      func(ctx context.Context, userID string) (*user.User, error)
	updateProfile   func(ctx context.Context, userID, name string) (*user.User, error)
	getPreferences  func(ctx context.Context, userID string) (*user.Preferences, error)
	savePreferences func(ctx context.Context, p *user.Preferences) error
}

func (m *mockUserSvc) Register(ctx context.Context, email, password string) (*user.AuthResult, error) {
	return m.register(ctx, email, password)
}

func (m *mockUserSvc) Login(ctx context.Context, email, password string) (*user.AuthResult, error) {
	return m.login(ctx, email, password)
}

func (m *mockUserSvc) GetProfile(ctx context.Context, userID string) (*user.User, error) {
	if m.getProfile != nil {
		return m.getProfile(ctx, userID)
	}
	return &user.User{ID: userID, Email: "dev@thethinker.com"}, nil
}

func (m *mockUserSvc) UpdateProfile(ctx context.Context, userID, name string) (*user.User, error) {
	if m.updateProfile != nil {
		return m.updateProfile(ctx, userID, name)
	}
	return &user.User{ID: userID, Email: "dev@thethinker.com", Name: name}, nil
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

func TestGetMe(t *testing.T) {
	t.Run("happy path returns 200 with the authenticated user's email", func(t *testing.T) {
		svc := &mockUserSvc{
			getProfile: func(_ context.Context, userID string) (*user.User, error) {
				return &user.User{ID: userID, Email: "real.user@thethinker.com"}, nil
			},
		}
		h := handlers.NewUserHandler(svc)

		req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
		req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))
		rr := httptest.NewRecorder()
		h.GetMe(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d (body: %s)", rr.Code, http.StatusOK, rr.Body.String())
		}
		if !strings.Contains(rr.Body.String(), "real.user@thethinker.com") {
			t.Errorf("body = %s, want it to contain the user's email", rr.Body.String())
		}
	})

	t.Run("missing user context returns 401", func(t *testing.T) {
		h := handlers.NewUserHandler(&mockUserSvc{})

		req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
		rr := httptest.NewRecorder()
		h.GetMe(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
		}
	})

	t.Run("service error returns 500", func(t *testing.T) {
		svc := &mockUserSvc{
			getProfile: func(_ context.Context, _ string) (*user.User, error) {
				return nil, errors.New("db unavailable")
			},
		}
		h := handlers.NewUserHandler(svc)

		req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
		req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))
		rr := httptest.NewRecorder()
		h.GetMe(rr, req)

		if rr.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d", rr.Code, http.StatusInternalServerError)
		}
	})
}

func TestUpdateMe(t *testing.T) {
	t.Run("happy path returns 200 with the updated name", func(t *testing.T) {
		svc := &mockUserSvc{
			updateProfile: func(_ context.Context, userID, name string) (*user.User, error) {
				return &user.User{ID: userID, Email: "real.user@thethinker.com", Name: name}, nil
			},
		}
		h := handlers.NewUserHandler(svc)

		req := httptest.NewRequest(http.MethodPut, "/users/me",
			strings.NewReader(`{"name":"Jane Doe"}`))
		req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))
		rr := httptest.NewRecorder()
		h.UpdateMe(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d (body: %s)", rr.Code, http.StatusOK, rr.Body.String())
		}
		if !strings.Contains(rr.Body.String(), "Jane Doe") {
			t.Errorf("body = %s, want it to contain the updated name", rr.Body.String())
		}
	})

	t.Run("invalid name returns 400", func(t *testing.T) {
		svc := &mockUserSvc{
			updateProfile: func(_ context.Context, _, _ string) (*user.User, error) {
				return nil, user.ErrInvalidName
			},
		}
		h := handlers.NewUserHandler(svc)

		req := httptest.NewRequest(http.MethodPut, "/users/me", strings.NewReader(`{"name":""}`))
		req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))
		rr := httptest.NewRecorder()
		h.UpdateMe(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
		}
	})

	t.Run("missing user context returns 401", func(t *testing.T) {
		h := handlers.NewUserHandler(&mockUserSvc{})

		req := httptest.NewRequest(http.MethodPut, "/users/me", strings.NewReader(`{"name":"X"}`))
		rr := httptest.NewRecorder()
		h.UpdateMe(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
		}
	})
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
