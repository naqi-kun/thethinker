package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type userSvc interface {
	Register(ctx context.Context, email, password string) (*user.AuthResult, error)
	Login(ctx context.Context, email, password string) (*user.AuthResult, error)
	GetPreferences(ctx context.Context, userID string) (*user.Preferences, error)
	SavePreferences(ctx context.Context, p *user.Preferences) error
}

type UserHandler struct {
	svc userSvc
}

func NewUserHandler(svc userSvc) *UserHandler {
	return &UserHandler{svc: svc}
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token  string `json:"token"`
	UserID string `json:"user_id"`
}

type preferencesRequest struct {
	Styles  []string          `json:"styles"`
	Answers map[string]string `json:"answers"`
}

type preferencesResponse struct {
	Styles  []string          `json:"styles"`
	Answers map[string]string `json:"answers"`
}

func (h *UserHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "email and password are required")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "password must be at least 8 characters")
		return
	}

	result, err := h.svc.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, user.ErrEmailTaken) {
			writeError(w, http.StatusConflict, "CONFLICT", "email already registered")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "registration failed")
		return
	}

	writeJSON(w, http.StatusCreated, authResponse{Token: result.Token, UserID: result.UserID})
}

func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "email and password are required")
		return
	}

	result, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, user.ErrInvalidCredentials) {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid email or password")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "login failed")
		return
	}

	writeJSON(w, http.StatusOK, authResponse{Token: result.Token, UserID: result.UserID})
}

func (h *UserHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	prefs, err := h.svc.GetPreferences(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get preferences")
		return
	}

	styles := prefs.Styles
	if styles == nil {
		styles = []string{}
	}
	answers := prefs.Answers
	if answers == nil {
		answers = map[string]string{}
	}

	writeJSON(w, http.StatusOK, preferencesResponse{Styles: styles, Answers: answers})
}

func (h *UserHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	var req preferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}

	prefs := &user.Preferences{
		UserID:  userID,
		Styles:  req.Styles,
		Answers: req.Answers,
	}
	if err := h.svc.SavePreferences(r.Context(), prefs); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to save preferences")
		return
	}

	styles := prefs.Styles
	if styles == nil {
		styles = []string{}
	}
	answers := prefs.Answers
	if answers == nil {
		answers = map[string]string{}
	}

	writeJSON(w, http.StatusOK, preferencesResponse{Styles: styles, Answers: answers})
}
