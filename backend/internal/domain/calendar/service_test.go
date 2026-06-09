package calendar

import (
	"context"
	"errors"
	"testing"
	"time"
)

// fakeRepo implements Repository for tests. Only the multi-calendar methods are
// exercised; the legacy connection methods are no-ops.
type fakeRepo struct {
	calendars []*Calendar
	events    map[string][]*Event // keyed by calendarID
	saveErr   error
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{events: map[string][]*Event{}}
}

func (r *fakeRepo) SaveCalendar(_ context.Context, cal *Calendar) error {
	if r.saveErr != nil {
		return r.saveErr
	}
	r.calendars = append(r.calendars, cal)
	return nil
}

func (r *fakeRepo) ListCalendars(_ context.Context, userID string) ([]*Calendar, error) {
	var out []*Calendar
	for _, c := range r.calendars {
		if c.UserID == userID {
			out = append(out, c)
		}
	}
	return out, nil
}

func (r *fakeRepo) FindCalendar(_ context.Context, id, userID string) (*Calendar, error) {
	for _, c := range r.calendars {
		if c.ID == id && c.UserID == userID {
			return c, nil
		}
	}
	return nil, nil
}

func (r *fakeRepo) DeleteCalendar(_ context.Context, id, userID string) error {
	kept := r.calendars[:0]
	for _, c := range r.calendars {
		if c.ID == id && c.UserID == userID {
			continue
		}
		kept = append(kept, c)
	}
	r.calendars = kept
	delete(r.events, id)
	return nil
}

func (r *fakeRepo) ReplaceCalendarEvents(_ context.Context, calendarID string, events []*Event) error {
	r.events[calendarID] = events
	return nil
}

func (r *fakeRepo) FindEventsByDate(_ context.Context, userID string, day time.Time) ([]*Event, error) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.AddDate(0, 0, 1)
	var out []*Event
	for _, evs := range r.events {
		for _, e := range evs {
			if e.UserID == userID && !e.StartsAt.Before(start) && e.StartsAt.Before(end) {
				out = append(out, e)
			}
		}
	}
	return out, nil
}

func (r *fakeRepo) FindConnection(context.Context, string) (*CalendarConnection, error) { return nil, nil }
func (r *fakeRepo) SaveConnection(context.Context, *CalendarConnection) error           { return nil }
func (r *fakeRepo) DeleteConnection(context.Context, string) error                      { return nil }
func (r *fakeRepo) FindUpcomingEvents(context.Context, string) ([]*Event, error)        { return nil, nil }

type fakeFetcher struct {
	events []*Event
	err    error
}

func (f *fakeFetcher) FetchEvents(context.Context, string) ([]*Event, error) {
	return f.events, f.err
}

func TestAddCalendar_Success(t *testing.T) {
	repo := newFakeRepo()
	fetcher := &fakeFetcher{events: []*Event{{ID: "e1", Title: "Standup"}}}
	svc := NewService(repo, fetcher)

	cal, err := svc.AddCalendar(context.Background(), "user-1", "Work", "https://example.com/cal.ics")
	if err != nil {
		t.Fatalf("AddCalendar: unexpected error %v", err)
	}
	if cal.Source != SourceICS {
		t.Errorf("Source = %q, want %q", cal.Source, SourceICS)
	}
	if cal.Name != "Work" {
		t.Errorf("Name = %q, want Work", cal.Name)
	}
	if len(repo.calendars) != 1 {
		t.Errorf("calendars saved = %d, want 1", len(repo.calendars))
	}
	stored := repo.events[cal.ID]
	if len(stored) != 1 || stored[0].UserID != "user-1" || stored[0].CalendarID != cal.ID {
		t.Errorf("stored events not tagged with user/calendar: %+v", stored)
	}
}

func TestAddCalendar_DefaultName(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, &fakeFetcher{})

	cal, err := svc.AddCalendar(context.Background(), "user-1", "  ", "https://example.com/team-events.ics")
	if err != nil {
		t.Fatalf("AddCalendar: unexpected error %v", err)
	}
	if cal.Name != "team-events" {
		t.Errorf("default Name = %q, want team-events", cal.Name)
	}
}

func TestAddCalendar_InvalidURL(t *testing.T) {
	svc := NewService(newFakeRepo(), &fakeFetcher{})
	for _, raw := range []string{"", "   ", "ftp://x/y.ics", "not-a-url", "file:///etc/passwd"} {
		if _, err := svc.AddCalendar(context.Background(), "user-1", "", raw); !errors.Is(err, ErrInvalidICSURL) {
			t.Errorf("AddCalendar(%q): error = %v, want ErrInvalidICSURL", raw, err)
		}
	}
}

func TestAddCalendar_FetchFailure(t *testing.T) {
	svc := NewService(newFakeRepo(), &fakeFetcher{err: errors.New("boom")})
	_, err := svc.AddCalendar(context.Background(), "user-1", "", "https://example.com/cal.ics")
	if !errors.Is(err, ErrFetchFailed) {
		t.Errorf("error = %v, want ErrFetchFailed", err)
	}
}

func TestRemoveCalendar(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, &fakeFetcher{})
	cal, _ := svc.AddCalendar(context.Background(), "user-1", "Work", "https://example.com/cal.ics")

	// Wrong owner -> not found.
	if err := svc.RemoveCalendar(context.Background(), "user-2", cal.ID); !errors.Is(err, ErrCalendarNotFound) {
		t.Errorf("RemoveCalendar(wrong owner): error = %v, want ErrCalendarNotFound", err)
	}
	// Unknown id -> not found.
	if err := svc.RemoveCalendar(context.Background(), "user-1", "nope"); !errors.Is(err, ErrCalendarNotFound) {
		t.Errorf("RemoveCalendar(unknown): error = %v, want ErrCalendarNotFound", err)
	}
	// Correct owner -> removed.
	if err := svc.RemoveCalendar(context.Background(), "user-1", cal.ID); err != nil {
		t.Errorf("RemoveCalendar: unexpected error %v", err)
	}
	if len(repo.calendars) != 0 {
		t.Errorf("calendars remaining = %d, want 0", len(repo.calendars))
	}
}

func TestEventsForDate_Filters(t *testing.T) {
	repo := newFakeRepo()
	day := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	repo.events["c1"] = []*Event{
		{ID: "today", UserID: "user-1", StartsAt: day.Add(9 * time.Hour)},
		{ID: "tomorrow", UserID: "user-1", StartsAt: day.Add(30 * time.Hour)},
		{ID: "other-user", UserID: "user-2", StartsAt: day.Add(10 * time.Hour)},
	}
	svc := NewService(repo, &fakeFetcher{})

	got, err := svc.EventsForDate(context.Background(), "user-1", day)
	if err != nil {
		t.Fatalf("EventsForDate: unexpected error %v", err)
	}
	if len(got) != 1 || got[0].ID != "today" {
		t.Errorf("EventsForDate = %+v, want only the 'today' event", got)
	}
}
