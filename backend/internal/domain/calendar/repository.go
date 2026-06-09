package calendar

import (
	"context"
	"time"
)

type Repository interface {
	// Multi-calendar model (KAN-49).
	SaveCalendar(ctx context.Context, cal *Calendar) error
	ListCalendars(ctx context.Context, userID string) ([]*Calendar, error)
	FindCalendar(ctx context.Context, id, userID string) (*Calendar, error)
	DeleteCalendar(ctx context.Context, id, userID string) error
	ReplaceCalendarEvents(ctx context.Context, calendarID string, events []*Event) error
	FindEventsByDate(ctx context.Context, userID string, day time.Time) ([]*Event, error)

	// Legacy single OAuth connection (not yet implemented end-to-end).
	FindConnection(ctx context.Context, userID string) (*CalendarConnection, error)
	SaveConnection(ctx context.Context, conn *CalendarConnection) error
	DeleteConnection(ctx context.Context, userID string) error
	FindUpcomingEvents(ctx context.Context, userID string) ([]*Event, error)
}
