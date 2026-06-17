package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
)

// Narrow ports the Google sign-in flow orchestrates. Keeping them as interfaces
// here (rather than concrete services) keeps the handler testable and the
// dependency direction pointing at the domain.
type googleExchanger interface {
	Exchange(ctx context.Context, code, redirectURI string) (user.GoogleIdentity, calendar.GoogleToken, error)
}

type googleAuthenticator interface {
	AuthenticateGoogle(ctx context.Context, id user.GoogleIdentity) (*user.AuthResult, error)
}

type googleCalendarConnector interface {
	ConnectGoogle(ctx context.Context, userID string, tok calendar.GoogleToken) (*calendar.Calendar, error)
}

// GoogleAuthHandler implements POST /auth/google: exchange the code, sign the
// user in (creating their account on first use), then connect and sync their
// Google Calendar from the same consent (KAN-97).
type GoogleAuthHandler struct {
	exchanger googleExchanger
	users     googleAuthenticator
	calendars googleCalendarConnector
}

func NewGoogleAuthHandler(exchanger googleExchanger, users googleAuthenticator, calendars googleCalendarConnector) *GoogleAuthHandler {
	return &GoogleAuthHandler{exchanger: exchanger, users: users, calendars: calendars}
}

type googleAuthRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirect_uri"`
}

func (h *GoogleAuthHandler) Authenticate(w http.ResponseWriter, r *http.Request) {
	var req googleAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}
	if req.Code == "" || req.RedirectURI == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "code and redirect_uri are required")
		return
	}

	identity, tok, err := h.exchanger.Exchange(r.Context(), req.Code, req.RedirectURI)
	if err != nil {
		log.Printf("google auth: code exchange failed: %v", err)
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Google authentication failed")
		return
	}

	result, err := h.users.AuthenticateGoogle(r.Context(), identity)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "sign-in failed")
		return
	}

	// Connect + sync the Google Calendar is best-effort: a calendar hiccup must
	// not block sign-in. The user can re-sync later from the calendar screen.
	if _, err := h.calendars.ConnectGoogle(r.Context(), result.UserID, tok); err != nil {
		log.Printf("google auth: calendar connect/sync failed for user %s: %v", result.UserID, err)
	}

	writeJSON(w, http.StatusOK, authResponse{Token: result.Token, UserID: result.UserID, IsNew: result.IsNew})
}
