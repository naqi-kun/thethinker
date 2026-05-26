package postgres

import (
	"context"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
)

var _ calendar.Repository = (*CalendarRepository)(nil)

type CalendarRepository struct {
	// TODO: db *pgxpool.Pool
}

func NewCalendarRepository( /* db *pgxpool.Pool */ ) *CalendarRepository {
	return &CalendarRepository{}
}

func (r *CalendarRepository) FindConnection(ctx context.Context, userID string) (*calendar.CalendarConnection, error) {
	panic("not implemented")
}

func (r *CalendarRepository) SaveConnection(ctx context.Context, conn *calendar.CalendarConnection) error {
	panic("not implemented")
}

func (r *CalendarRepository) DeleteConnection(ctx context.Context, userID string) error {
	panic("not implemented")
}

func (r *CalendarRepository) FindUpcomingEvents(ctx context.Context, userID string) ([]*calendar.Event, error) {
	panic("not implemented")
}
