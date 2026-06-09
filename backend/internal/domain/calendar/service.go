package calendar

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ICSFetcher retrieves and parses an ICS (iCalendar) feed into events.
// The implementation lives in infrastructure; the domain depends only on this
// interface so it stays free of infra imports (DDD boundary rules).
type ICSFetcher interface {
	FetchEvents(ctx context.Context, icsURL string) ([]*Event, error)
}

type Service struct {
	repo    Repository
	fetcher ICSFetcher
}

func NewService(repo Repository, fetcher ICSFetcher) *Service {
	return &Service{repo: repo, fetcher: fetcher}
}

// AddCalendar validates the ICS URL, fetches its events, and persists both the
// calendar and a snapshot of its events.
func (s *Service) AddCalendar(ctx context.Context, userID, name, icsURL string) (*Calendar, error) {
	icsURL = strings.TrimSpace(icsURL)
	if !validICSURL(icsURL) {
		return nil, ErrInvalidICSURL
	}

	events, err := s.fetcher.FetchEvents(ctx, icsURL)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrFetchFailed, err)
	}

	if strings.TrimSpace(name) == "" {
		name = defaultCalendarName(icsURL)
	}

	cal := &Calendar{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      name,
		Source:    SourceICS,
		ICSURL:    icsURL,
		CreatedAt: time.Now(),
	}
	if err := s.repo.SaveCalendar(ctx, cal); err != nil {
		return nil, fmt.Errorf("calendar: save calendar: %w", err)
	}

	for _, e := range events {
		e.UserID = userID
		e.CalendarID = cal.ID
	}
	if err := s.repo.ReplaceCalendarEvents(ctx, cal.ID, events); err != nil {
		return nil, fmt.Errorf("calendar: store events: %w", err)
	}

	return cal, nil
}

func (s *Service) ListCalendars(ctx context.Context, userID string) ([]*Calendar, error) {
	return s.repo.ListCalendars(ctx, userID)
}

// RemoveCalendar deletes a calendar the user owns. Its events cascade away.
func (s *Service) RemoveCalendar(ctx context.Context, userID, id string) error {
	cal, err := s.repo.FindCalendar(ctx, id, userID)
	if err != nil {
		return fmt.Errorf("calendar: find: %w", err)
	}
	if cal == nil {
		return ErrCalendarNotFound
	}
	return s.repo.DeleteCalendar(ctx, id, userID)
}

// EventsForDate returns the user's events for a single day across all calendars.
func (s *Service) EventsForDate(ctx context.Context, userID string, day time.Time) ([]*Event, error) {
	return s.repo.FindEventsByDate(ctx, userID, day)
}

func validICSURL(raw string) bool {
	if raw == "" {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	return u.Host != ""
}

// defaultCalendarName derives a readable name from the URL's last path segment.
func defaultCalendarName(icsURL string) string {
	u, err := url.Parse(icsURL)
	if err != nil {
		return "Calendar"
	}
	seg := u.Host
	if base := strings.Trim(u.Path, "/"); base != "" {
		parts := strings.Split(base, "/")
		seg = strings.TrimSuffix(parts[len(parts)-1], ".ics")
	}
	if seg == "" {
		return "Calendar"
	}
	return seg
}
