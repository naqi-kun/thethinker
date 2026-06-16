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

// CalendarConnection holds a user's OAuth tokens for a provider (one per user).
// Used by the Google integration (KAN-97) to refresh access without re-consent.
type CalendarConnection struct {
	UserID       string
	Provider     string // SourceGoogle | SourceApple
	Token        string // OAuth access token
	RefreshToken string // OAuth refresh token; used to mint new access tokens
	ExpiresAt    time.Time
}

// GoogleToken is the set of OAuth tokens needed to call the Google Calendar API.
// It crosses the domain↔infrastructure boundary: infrastructure mints/refreshes
// it, the service stores it.
type GoogleToken struct {
	AccessToken  string
	RefreshToken string
	Expiry       time.Time
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
