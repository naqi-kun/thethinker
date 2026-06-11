package calendar

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"

	ics "github.com/arran4/golang-ical"

	domain "school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
)

const (
	icsRequestTimeout = 15 * time.Second
	maxICSBytes       = 5 << 20 // 5 MB
)

// ICSFetcher fetches and parses ICS (iCalendar) feeds over HTTP.
// It satisfies domain/calendar.ICSFetcher.
type ICSFetcher struct {
	client *http.Client
}

func NewICSFetcher() *ICSFetcher {
	return &ICSFetcher{
		client: &http.Client{Timeout: icsRequestTimeout},
	}
}

// FetchEvents downloads the feed at icsURL and maps its VEVENTs to domain events.
func (f *ICSFetcher) FetchEvents(ctx context.Context, icsURL string) ([]*domain.Event, error) {
	if err := guardURL(icsURL); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, icsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "text/calendar, text/plain, */*")

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch ics: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch ics: unexpected status %d", resp.StatusCode)
	}

	return parseEvents(io.LimitReader(resp.Body, maxICSBytes))
}

// parseEvents reads an ICS stream and maps its VEVENTs to domain events.
// Split out from FetchEvents so it is testable without network access.
func parseEvents(r io.Reader) ([]*domain.Event, error) {
	cal, err := ics.ParseCalendar(r)
	if err != nil {
		return nil, fmt.Errorf("parse ics: %w", err)
	}

	var events []*domain.Event
	for _, ev := range cal.Events() {
		e := toEvent(ev)
		if e == nil {
			continue
		}
		events = append(events, e)
	}
	return events, nil
}

// toEvent maps a parsed VEVENT to a domain event, or nil if it has no usable
// start time / UID.
func toEvent(ev *ics.VEvent) *domain.Event {
	uid := propValue(ev, ics.ComponentPropertyUniqueId)
	if uid == "" {
		return nil
	}

	dtStart := ev.GetProperty(ics.ComponentPropertyDtStart)
	allDay := dtStart != nil && dtStart.GetValueType() == ics.ValueDataTypeDate

	var start, end time.Time
	var err error
	if allDay {
		start, err = ev.GetAllDayStartAt()
		if err == nil {
			end, _ = ev.GetAllDayEndAt()
		}
	} else {
		start, err = ev.GetStartAt()
		if err == nil {
			end, _ = ev.GetEndAt()
		}
	}
	if err != nil || start.IsZero() {
		return nil
	}

	return &domain.Event{
		ID:       uid,
		Title:    propValue(ev, ics.ComponentPropertySummary),
		StartsAt: start.UTC(),
		EndsAt:   end.UTC(),
		Location: propValue(ev, ics.ComponentPropertyLocation),
		AllDay:   allDay,
	}
}

func propValue(ev *ics.VEvent, p ics.ComponentProperty) string {
	if prop := ev.GetProperty(p); prop != nil {
		return prop.Value
	}
	return ""
}

// guardURL is a basic SSRF guard: only http/https, and reject hosts that
// resolve solely to loopback/private/link-local addresses. Full hardening
// (redirect re-validation, DNS-rebinding protection) is a follow-up.
func guardURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid url: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("unsupported scheme %q", u.Scheme)
	}
	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("missing host")
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		// Let the HTTP client surface a clearer network error.
		return nil
	}
	for _, ip := range ips {
		if !isBlockedIP(ip) {
			return nil // at least one public address — allow
		}
	}
	return fmt.Errorf("host resolves only to private addresses")
}

func isBlockedIP(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}
