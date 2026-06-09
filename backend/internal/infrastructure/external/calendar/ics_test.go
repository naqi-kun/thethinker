package calendar

import (
	"strings"
	"testing"
)

const sampleICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:evt-timed-1
SUMMARY:Team standup
LOCATION:Room 4
DTSTART:20250601T090000Z
DTEND:20250601T093000Z
END:VEVENT
BEGIN:VEVENT
UID:evt-allday-1
SUMMARY:Company holiday
DTSTART;VALUE=DATE:20250601
DTEND;VALUE=DATE:20250602
END:VEVENT
BEGIN:VEVENT
SUMMARY:No UID is skipped
DTSTART:20250601T120000Z
END:VEVENT
END:VCALENDAR`

func TestParseEvents(t *testing.T) {
	events, err := parseEvents(strings.NewReader(sampleICS))
	if err != nil {
		t.Fatalf("parseEvents: unexpected error %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("parsed %d events, want 2 (UID-less event skipped)", len(events))
	}

	byID := map[string]bool{}
	for _, e := range events {
		byID[e.ID] = true
	}
	if !byID["evt-timed-1"] || !byID["evt-allday-1"] {
		t.Fatalf("missing expected events, got %v", byID)
	}

	for _, e := range events {
		switch e.ID {
		case "evt-timed-1":
			if e.Title != "Team standup" {
				t.Errorf("timed Title = %q, want Team standup", e.Title)
			}
			if e.Location != "Room 4" {
				t.Errorf("timed Location = %q, want Room 4", e.Location)
			}
			if e.AllDay {
				t.Errorf("timed event marked all-day")
			}
			if e.StartsAt.IsZero() || e.EndsAt.IsZero() {
				t.Errorf("timed event missing start/end: %+v", e)
			}
			if h := e.StartsAt.UTC().Hour(); h != 9 {
				t.Errorf("timed start hour = %d, want 9", h)
			}
		case "evt-allday-1":
			if !e.AllDay {
				t.Errorf("all-day event not marked all-day")
			}
			if e.Title != "Company holiday" {
				t.Errorf("all-day Title = %q, want Company holiday", e.Title)
			}
		}
	}
}

func TestParseEvents_Invalid(t *testing.T) {
	if _, err := parseEvents(strings.NewReader("not an ics file")); err == nil {
		t.Errorf("parseEvents(garbage): expected error, got nil")
	}
}

func TestGuardURL(t *testing.T) {
	bad := []string{
		"ftp://example.com/cal.ics", // bad scheme
		"http://localhost/cal.ics",  // loopback
		"http://127.0.0.1/cal.ics",  // loopback IP
		"://missing-scheme",         // unparseable
	}
	for _, raw := range bad {
		if err := guardURL(raw); err == nil {
			t.Errorf("guardURL(%q): expected error, got nil", raw)
		}
	}

	// A well-formed public URL should pass the guard (DNS may or may not
	// resolve in CI; guardURL allows through on lookup failure).
	if err := guardURL("https://example.com/cal.ics"); err != nil {
		t.Errorf("guardURL(public): unexpected error %v", err)
	}
}
