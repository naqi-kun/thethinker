package calendar

import "time"

type CalendarConnection struct {
	UserID    string
	Provider  string // "google" | "apple"
	Token     string // OAuth access token
	ExpiresAt time.Time
}

type Event struct {
	ID       string
	UserID   string
	Title    string
	Type     string // "meeting" | "casual" | "sport" | etc.
	StartsAt time.Time
	Location string
}
