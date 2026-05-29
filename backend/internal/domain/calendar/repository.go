package calendar

import "context"

type Repository interface {
	FindConnection(ctx context.Context, userID string) (*CalendarConnection, error)
	SaveConnection(ctx context.Context, conn *CalendarConnection) error
	DeleteConnection(ctx context.Context, userID string) error
	FindUpcomingEvents(ctx context.Context, userID string) ([]*Event, error)
}
