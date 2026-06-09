package workschedule

import "context"

type Repository interface {
	// Get returns the user's schedule, or nil if they haven't set one.
	Get(ctx context.Context, userID string) (*Schedule, error)
	Save(ctx context.Context, schedule *Schedule) error
}
