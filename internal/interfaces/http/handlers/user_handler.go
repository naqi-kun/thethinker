package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
)

type UserHandler struct {
	svc *user.Service
}

func NewUserHandler(svc *user.Service) *UserHandler {
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
	// TODO: implement — KAN-14
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *UserHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	// TODO: implement — KAN-14
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
