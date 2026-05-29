package handlers

import "net/http"

type CalendarHandler struct {
	// TODO: svc *calendar.Service
}

func NewCalendarHandler( /* svc *calendar.Service */ ) *CalendarHandler {
	return &CalendarHandler{}
}

func (h *CalendarHandler) Connect(w http.ResponseWriter, r *http.Request) {
	// TODO: decode provider + auth_code, call svc.Connect, return connection info
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *CalendarHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	// TODO: call svc.Disconnect, return 204
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
