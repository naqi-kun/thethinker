package calendar

import "time"

// Calendar source discriminators. ICS is the supported method today; the
// OAuth-based providers are reserved for follow-up work (KAN-49 sub-tasks).
const (
	SourceICS    = "ics"
	SourceGoogle = "google"
	SourceApple  = "apple"
)

// Calendar is a single calendar a user has added. A user may have many.
type Calendar struct {
	ID        string
	UserID    string
	Name      string
	Source    string // SourceICS | SourceGoogle | SourceApple
	ICSURL    string // populated when Source == SourceICS
	CreatedAt time.Time
}

// CalendarConnection is the legacy single OAuth connection (provider + token).
// Retained for the not-yet-implemented /calendar/connect flow.
type CalendarConnection struct {
	UserID    string
	Provider  string // "google" | "apple"
	Token     string // OAuth access token
	ExpiresAt time.Time
}

type Event struct {
	ID         string
	UserID     string
	CalendarID string
	Title      string
	Type       string // "meeting" | "casual" | "sport" | etc.
	StartsAt   time.Time
	EndsAt     time.Time
	Location   string
	AllDay     bool
	Ignored    bool
}
