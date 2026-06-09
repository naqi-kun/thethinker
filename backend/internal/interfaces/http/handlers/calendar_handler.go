package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type CalendarHandler struct {
	svc *calendar.Service
}

func NewCalendarHandler(svc *calendar.Service) *CalendarHandler {
	return &CalendarHandler{svc: svc}
}

type addCalendarRequest struct {
	Name   string `json:"name"`
	ICSURL string `json:"ics_url"`
}

type calendarResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Source    string `json:"source"`
	CreatedAt string `json:"created_at"`
}

type calendarEventResponse struct {
	ID       string  `json:"id"`
	Title    string  `json:"title"`
	StartsAt string  `json:"starts_at"`
	EndsAt   *string `json:"ends_at"`
	Location string  `json:"location,omitempty"`
	AllDay   bool    `json:"all_day"`
}

func toCalendarResponse(c *calendar.Calendar) calendarResponse {
	return calendarResponse{
		ID:        c.ID,
		Name:      c.Name,
		Source:    c.Source,
		CreatedAt: c.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func toCalendarEventResponse(e *calendar.Event) calendarEventResponse {
	resp := calendarEventResponse{
		ID:       e.ID,
		Title:    e.Title,
		StartsAt: e.StartsAt.UTC().Format(time.RFC3339),
		Location: e.Location,
		AllDay:   e.AllDay,
	}
	if !e.EndsAt.IsZero() {
		s := e.EndsAt.UTC().Format(time.RFC3339)
		resp.EndsAt = &s
	}
	return resp
}

func (h *CalendarHandler) ListCalendars(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	cals, err := h.svc.ListCalendars(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list calendars")
		return
	}

	resp := make([]calendarResponse, len(cals))
	for i, c := range cals {
		resp[i] = toCalendarResponse(c)
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *CalendarHandler) AddCalendar(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	var req addCalendarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}

	cal, err := h.svc.AddCalendar(r.Context(), userID, req.Name, req.ICSURL)
	if err != nil {
		switch {
		case errors.Is(err, calendar.ErrInvalidICSURL):
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid ICS URL")
		case errors.Is(err, calendar.ErrFetchFailed):
			writeError(w, http.StatusBadGateway, "ICS_FETCH_FAILED", "could not fetch or parse the ICS feed")
		default:
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to add calendar")
		}
		return
	}

	writeJSON(w, http.StatusCreated, toCalendarResponse(cal))
}

func (h *CalendarHandler) RemoveCalendar(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "calendar id is required")
		return
	}

	if err := h.svc.RemoveCalendar(r.Context(), userID, id); err != nil {
		if errors.Is(err, calendar.ErrCalendarNotFound) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "calendar not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to remove calendar")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *CalendarHandler) TodayEvents(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	day := time.Now()
	if dateStr := r.URL.Query().Get("date"); dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "date must be in YYYY-MM-DD format")
			return
		}
		day = parsed
	}

	events, err := h.svc.EventsForDate(r.Context(), userID, day)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list events")
		return
	}

	resp := make([]calendarEventResponse, len(events))
	for i, e := range events {
		resp[i] = toCalendarEventResponse(e)
	}
	writeJSON(w, http.StatusOK, resp)
}

// Connect / Disconnect back the legacy OAuth (/calendar/connect) flow, which is
// out of scope for the ICS slice (KAN-49) and remains unimplemented.

func (h *CalendarHandler) Connect(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "OAuth calendar connect is not implemented yet")
}

func (h *CalendarHandler) Disconnect(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "OAuth calendar disconnect is not implemented yet")
}
