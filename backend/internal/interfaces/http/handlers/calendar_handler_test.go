package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

// stubRepo implements calendar.Repository for handler tests.
type stubRepo struct {
	cals   []*calendar.Calendar
	events []*calendar.Event
}

func (r *stubRepo) SaveCalendar(_ context.Context, cal *calendar.Calendar) error {
	r.cals = append(r.cals, cal)
	return nil
}
func (r *stubRepo) ListCalendars(context.Context, string) ([]*calendar.Calendar, error) {
	return r.cals, nil
}
func (r *stubRepo) FindCalendar(_ context.Context, id, userID string) (*calendar.Calendar, error) {
	for _, c := range r.cals {
		if c.ID == id && c.UserID == userID {
			return c, nil
		}
	}
	return nil, nil
}
func (r *stubRepo) DeleteCalendar(_ context.Context, id, _ string) error {
	kept := r.cals[:0]
	for _, c := range r.cals {
		if c.ID != id {
			kept = append(kept, c)
		}
	}
	r.cals = kept
	return nil
}
func (r *stubRepo) ReplaceCalendarEvents(context.Context, string, []*calendar.Event) error {
	return nil
}
func (r *stubRepo) FindEventsByDate(context.Context, string, time.Time) ([]*calendar.Event, error) {
	return r.events, nil
}
func (r *stubRepo) SetEventIgnored(_ context.Context, userID, eventID string, ignored bool) (bool, error) {
	for _, e := range r.events {
		if e.ID == eventID {
			e.Ignored = ignored
			return true, nil
		}
	}
	return false, nil
}
func (r *stubRepo) FindConnection(context.Context, string) (*calendar.CalendarConnection, error) {
	return nil, nil
}
func (r *stubRepo) SaveConnection(context.Context, *calendar.CalendarConnection) error { return nil }
func (r *stubRepo) DeleteConnection(context.Context, string) error                     { return nil }
func (r *stubRepo) FindUpcomingEvents(context.Context, string) ([]*calendar.Event, error) {
	return nil, nil
}

type stubFetcher struct {
	events []*calendar.Event
	err    error
}

func (f *stubFetcher) FetchEvents(context.Context, string) ([]*calendar.Event, error) {
	return f.events, f.err
}

// stubGoogle satisfies calendar.GoogleCalendarClient; the ICS-focused handler
// tests never exercise the Google path.
type stubGoogle struct{}

func (stubGoogle) FetchEvents(_ context.Context, tok calendar.GoogleToken) ([]*calendar.Event, calendar.GoogleToken, error) {
	return nil, tok, nil
}

func newHandler(repo *stubRepo, fetcher *stubFetcher) *CalendarHandler {
	return NewCalendarHandler(calendar.NewService(repo, fetcher, stubGoogle{}))
}

func authed(req *http.Request, userID string) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID))
}

func TestAddCalendar_Created(t *testing.T) {
	h := newHandler(&stubRepo{}, &stubFetcher{events: []*calendar.Event{{ID: "e1"}}})
	req := authed(httptest.NewRequest(http.MethodPost, "/calendars",
		strings.NewReader(`{"name":"Work","ics_url":"https://example.com/c.ics"}`)), "user-1")
	rec := httptest.NewRecorder()

	h.AddCalendar(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"source":"ics"`) {
		t.Errorf("body missing ics source: %s", rec.Body.String())
	}
}

func TestAddCalendar_InvalidURL(t *testing.T) {
	h := newHandler(&stubRepo{}, &stubFetcher{})
	req := authed(httptest.NewRequest(http.MethodPost, "/calendars",
		strings.NewReader(`{"ics_url":"not-a-url"}`)), "user-1")
	rec := httptest.NewRecorder()

	h.AddCalendar(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestAddCalendar_BadJSON(t *testing.T) {
	h := newHandler(&stubRepo{}, &stubFetcher{})
	req := authed(httptest.NewRequest(http.MethodPost, "/calendars", strings.NewReader(`{`)), "user-1")
	rec := httptest.NewRecorder()

	h.AddCalendar(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestAddCalendar_FetchFailure(t *testing.T) {
	h := newHandler(&stubRepo{}, &stubFetcher{err: errors.New("unreachable")})
	req := authed(httptest.NewRequest(http.MethodPost, "/calendars",
		strings.NewReader(`{"ics_url":"https://example.com/c.ics"}`)), "user-1")
	rec := httptest.NewRecorder()

	h.AddCalendar(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
}

func TestAddCalendar_Unauthorized(t *testing.T) {
	h := newHandler(&stubRepo{}, &stubFetcher{})
	req := httptest.NewRequest(http.MethodPost, "/calendars",
		strings.NewReader(`{"ics_url":"https://example.com/c.ics"}`)) // no user context
	rec := httptest.NewRecorder()

	h.AddCalendar(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestListCalendars(t *testing.T) {
	repo := &stubRepo{cals: []*calendar.Calendar{
		{ID: "c1", UserID: "user-1", Name: "Work", Source: calendar.SourceICS, CreatedAt: time.Now()},
	}}
	h := newHandler(repo, &stubFetcher{})
	req := authed(httptest.NewRequest(http.MethodGet, "/calendars", nil), "user-1")
	rec := httptest.NewRecorder()

	h.ListCalendars(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"Work"`) {
		t.Errorf("body missing calendar: %s", rec.Body.String())
	}
}

func TestRemoveCalendar(t *testing.T) {
	repo := &stubRepo{cals: []*calendar.Calendar{{ID: "c1", UserID: "user-1"}}}
	h := newHandler(repo, &stubFetcher{})

	req := authed(httptest.NewRequest(http.MethodDelete, "/calendars/c1", nil), "user-1")
	req.SetPathValue("id", "c1")
	rec := httptest.NewRecorder()

	h.RemoveCalendar(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}

	// Removing a non-existent calendar -> 404.
	req2 := authed(httptest.NewRequest(http.MethodDelete, "/calendars/missing", nil), "user-1")
	req2.SetPathValue("id", "missing")
	rec2 := httptest.NewRecorder()

	h.RemoveCalendar(rec2, req2)

	if rec2.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec2.Code)
	}
}

func TestTodayEvents(t *testing.T) {
	repo := &stubRepo{events: []*calendar.Event{
		{ID: "e1", Title: "Standup", StartsAt: time.Now(), AllDay: false},
	}}
	h := newHandler(repo, &stubFetcher{})
	req := authed(httptest.NewRequest(http.MethodGet, "/calendars/events", nil), "user-1")
	rec := httptest.NewRecorder()

	h.TodayEvents(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"Standup"`) {
		t.Errorf("body missing event: %s", rec.Body.String())
	}
}

func TestTodayEvents_BadDate(t *testing.T) {
	h := newHandler(&stubRepo{}, &stubFetcher{})
	req := authed(httptest.NewRequest(http.MethodGet, "/calendars/events?date=06-01-2025", nil), "user-1")
	rec := httptest.NewRecorder()

	h.TodayEvents(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestIgnoreEvent(t *testing.T) {
	repo := &stubRepo{events: []*calendar.Event{{ID: "e1", Title: "Standup"}}}
	h := newHandler(repo, &stubFetcher{})

	req := authed(httptest.NewRequest(http.MethodPost, "/calendars/events/e1/ignore", nil), "user-1")
	req.SetPathValue("id", "e1")
	rec := httptest.NewRecorder()

	h.IgnoreEvent(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if !repo.events[0].Ignored {
		t.Errorf("event was not marked ignored")
	}

	// Unknown event -> 404.
	req2 := authed(httptest.NewRequest(http.MethodPost, "/calendars/events/missing/ignore", nil), "user-1")
	req2.SetPathValue("id", "missing")
	rec2 := httptest.NewRecorder()

	h.IgnoreEvent(rec2, req2)

	if rec2.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec2.Code)
	}
}
