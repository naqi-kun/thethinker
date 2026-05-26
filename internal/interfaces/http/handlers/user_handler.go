package handlers

import "net/http"

type UserHandler struct {
	// TODO: svc *user.Service
}

func NewUserHandler( /* svc *user.Service */ ) *UserHandler {
	return &UserHandler{}
}

func (h *UserHandler) Register(w http.ResponseWriter, r *http.Request) {
	// TODO: decode body, call svc.Register, return JWT
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	// TODO: decode body, call svc.Login, return JWT
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *UserHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *UserHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
