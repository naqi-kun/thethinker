package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
)

// stubExchanger satisfies googleExchanger.
type stubExchanger struct {
	identity user.GoogleIdentity
	token    calendar.GoogleToken
	err      error
}

func (s stubExchanger) Exchange(context.Context, string, string) (user.GoogleIdentity, calendar.GoogleToken, error) {
	return s.identity, s.token, s.err
}

// stubAuthenticator satisfies googleAuthenticator.
type stubAuthenticator struct {
	result *user.AuthResult
	err    error
}

func (s stubAuthenticator) AuthenticateGoogle(context.Context, user.GoogleIdentity) (*user.AuthResult, error) {
	return s.result, s.err
}

// stubConnector satisfies googleCalendarConnector and records whether it ran.
type stubConnector struct {
	called bool
	err    error
}

func (s *stubConnector) ConnectGoogle(context.Context, string, calendar.GoogleToken) (*calendar.Calendar, error) {
	s.called = true
	return &calendar.Calendar{}, s.err
}

func postGoogle(h *GoogleAuthHandler, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/auth/google", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.Authenticate(rec, req)
	return rec
}

func TestGoogleAuth_Success(t *testing.T) {
	conn := &stubConnector{}
	h := NewGoogleAuthHandler(
		stubExchanger{identity: user.GoogleIdentity{GoogleID: "sub-1", Email: "a@b.com"}},
		stubAuthenticator{result: &user.AuthResult{Token: "jwt-123", UserID: "user-1", IsNew: true}},
		conn,
	)

	rec := postGoogle(h, `{"code":"abc","redirect_uri":"http://localhost:5173/auth/google/callback"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"jwt-123"`) || !strings.Contains(rec.Body.String(), `"is_new":true`) {
		t.Errorf("body missing token/is_new: %s", rec.Body.String())
	}
	if !conn.called {
		t.Error("calendar ConnectGoogle was not invoked on successful sign-in")
	}
}

func TestGoogleAuth_BadJSON(t *testing.T) {
	h := NewGoogleAuthHandler(stubExchanger{}, stubAuthenticator{}, &stubConnector{})

	rec := postGoogle(h, `{`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestGoogleAuth_MissingFields(t *testing.T) {
	h := NewGoogleAuthHandler(stubExchanger{}, stubAuthenticator{}, &stubConnector{})

	// code present but redirect_uri missing -> 400.
	rec := postGoogle(h, `{"code":"abc"}`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestGoogleAuth_ExchangeFailure(t *testing.T) {
	h := NewGoogleAuthHandler(
		stubExchanger{err: errors.New("bad code")},
		stubAuthenticator{},
		&stubConnector{},
	)

	rec := postGoogle(h, `{"code":"abc","redirect_uri":"http://localhost/cb"}`)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestGoogleAuth_AuthenticateFailure(t *testing.T) {
	h := NewGoogleAuthHandler(
		stubExchanger{identity: user.GoogleIdentity{GoogleID: "sub-1"}},
		stubAuthenticator{err: errors.New("db down")},
		&stubConnector{},
	)

	rec := postGoogle(h, `{"code":"abc","redirect_uri":"http://localhost/cb"}`)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

// A calendar hiccup must not block sign-in: the response is still 200.
func TestGoogleAuth_CalendarFailureDoesNotBlockSignIn(t *testing.T) {
	conn := &stubConnector{err: errors.New("calendar unreachable")}
	h := NewGoogleAuthHandler(
		stubExchanger{identity: user.GoogleIdentity{GoogleID: "sub-1"}},
		stubAuthenticator{result: &user.AuthResult{Token: "jwt-123", UserID: "user-1"}},
		conn,
	)

	rec := postGoogle(h, `{"code":"abc","redirect_uri":"http://localhost/cb"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 despite calendar failure; body=%s", rec.Code, rec.Body.String())
	}
	if !conn.called {
		t.Error("expected calendar connect to be attempted")
	}
}
