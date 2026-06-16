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

// GoogleCalendarClient fetches events from the Google Calendar API using stored
// OAuth tokens. The implementation lives in infrastructure. Because the access
// token may be refreshed during the call, the (possibly updated) token is
// returned so the service can persist it.
type GoogleCalendarClient interface {
	FetchEvents(ctx context.Context, tok GoogleToken) ([]*Event, GoogleToken, error)
}

type Service struct {
	repo    Repository
	fetcher ICSFetcher
	google  GoogleCalendarClient
}

func NewService(repo Repository, fetcher ICSFetcher, google GoogleCalendarClient) *Service {
	return &Service{repo: repo, fetcher: fetcher, google: google}
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

// ConnectGoogle stores a user's Google OAuth tokens, ensures they have a Google
// calendar entry, and syncs its events. It is idempotent — signing in again
// refreshes the stored tokens and re-syncs the existing calendar rather than
// creating duplicates. Called after a successful Google sign-in (KAN-97).
func (s *Service) ConnectGoogle(ctx context.Context, userID string, tok GoogleToken) (*Calendar, error) {
	// Google only returns a refresh token on the first consent. If a later
	// sign-in omits it, keep the one we already stored so sync keeps working.
	if tok.RefreshToken == "" {
		if existing, err := s.repo.FindConnection(ctx, userID); err == nil && existing != nil {
			tok.RefreshToken = existing.RefreshToken
		}
	}

	conn := &CalendarConnection{
		UserID:       userID,
		Provider:     SourceGoogle,
		Token:        tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		ExpiresAt:    tok.Expiry,
	}
	if err := s.repo.SaveConnection(ctx, conn); err != nil {
		return nil, fmt.Errorf("calendar: save google connection: %w", err)
	}

	cal, err := s.findGoogleCalendar(ctx, userID)
	if err != nil {
		return nil, err
	}
	if cal == nil {
		cal = &Calendar{
			ID:        uuid.New().String(),
			UserID:    userID,
			Name:      "Google Calendar",
			Source:    SourceGoogle,
			CreatedAt: time.Now(),
		}
		if err := s.repo.SaveCalendar(ctx, cal); err != nil {
			return nil, fmt.Errorf("calendar: save google calendar: %w", err)
		}
	}

	if err := s.syncGoogleEvents(ctx, userID, cal, tok); err != nil {
		return nil, err
	}
	return cal, nil
}

// SyncCalendar re-fetches events for a calendar the user owns, from its source
// (Google API or ICS feed), and replaces the stored snapshot.
func (s *Service) SyncCalendar(ctx context.Context, userID, calendarID string) (*Calendar, error) {
	cal, err := s.repo.FindCalendar(ctx, calendarID, userID)
	if err != nil {
		return nil, fmt.Errorf("calendar: find: %w", err)
	}
	if cal == nil {
		return nil, ErrCalendarNotFound
	}

	switch cal.Source {
	case SourceGoogle:
		conn, err := s.repo.FindConnection(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("calendar: find google connection: %w", err)
		}
		if conn == nil || conn.Provider != SourceGoogle {
			return nil, fmt.Errorf("%w: no google connection", ErrFetchFailed)
		}
		tok := GoogleToken{AccessToken: conn.Token, RefreshToken: conn.RefreshToken, Expiry: conn.ExpiresAt}
		if err := s.syncGoogleEvents(ctx, userID, cal, tok); err != nil {
			return nil, err
		}
	default: // SourceICS
		events, err := s.fetcher.FetchEvents(ctx, cal.ICSURL)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrFetchFailed, err)
		}
		if err := s.storeEvents(ctx, userID, cal, events); err != nil {
			return nil, err
		}
	}
	return cal, nil
}

// syncGoogleEvents fetches the user's Google Calendar events and stores them,
// persisting a refreshed access token when the client returns one.
func (s *Service) syncGoogleEvents(ctx context.Context, userID string, cal *Calendar, tok GoogleToken) error {
	events, newTok, err := s.google.FetchEvents(ctx, tok)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrFetchFailed, err)
	}
	if newTok.AccessToken != "" && newTok.AccessToken != tok.AccessToken {
		refresh := newTok.RefreshToken
		if refresh == "" {
			refresh = tok.RefreshToken // Google omits it on refresh; keep the original
		}
		_ = s.repo.SaveConnection(ctx, &CalendarConnection{
			UserID:       userID,
			Provider:     SourceGoogle,
			Token:        newTok.AccessToken,
			RefreshToken: refresh,
			ExpiresAt:    newTok.Expiry,
		})
	}
	return s.storeEvents(ctx, userID, cal, events)
}

func (s *Service) storeEvents(ctx context.Context, userID string, cal *Calendar, events []*Event) error {
	for _, e := range events {
		e.UserID = userID
		e.CalendarID = cal.ID
	}
	if err := s.repo.ReplaceCalendarEvents(ctx, cal.ID, events); err != nil {
		return fmt.Errorf("calendar: store events: %w", err)
	}
	return nil
}

func (s *Service) findGoogleCalendar(ctx context.Context, userID string) (*Calendar, error) {
	cals, err := s.repo.ListCalendars(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("calendar: list: %w", err)
	}
	for _, c := range cals {
		if c.Source == SourceGoogle {
			return c, nil
		}
	}
	return nil, nil
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

// EventsForDate returns the user's (non-ignored) events for a single day across
// all calendars.
func (s *Service) EventsForDate(ctx context.Context, userID string, day time.Time) ([]*Event, error) {
	return s.repo.FindEventsByDate(ctx, userID, day)
}

// IgnoreEvent hides an event (or un-hides it) for the user. Returns
// ErrEventNotFound if no such event belongs to the user.
func (s *Service) IgnoreEvent(ctx context.Context, userID, eventID string, ignored bool) error {
	found, err := s.repo.SetEventIgnored(ctx, userID, eventID, ignored)
	if err != nil {
		return fmt.Errorf("calendar: set ignored: %w", err)
	}
	if !found {
		return ErrEventNotFound
	}
	return nil
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
