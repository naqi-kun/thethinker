package workschedule

import (
	"context"
	"errors"
	"fmt"
	"regexp"
)

var ErrInvalidSchedule = errors.New("workschedule: invalid schedule")

var timeOfDayRe = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Get returns the user's schedule, falling back to the default if none is set.
func (s *Service) Get(ctx context.Context, userID string) (*Schedule, error) {
	sched, err := s.repo.Get(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("workschedule: get: %w", err)
	}
	if sched == nil {
		return DefaultSchedule(userID), nil
	}
	return sched, nil
}

// Save validates and persists the schedule.
func (s *Service) Save(ctx context.Context, schedule *Schedule) error {
	if !timeOfDayRe.MatchString(schedule.WorkStart) || !timeOfDayRe.MatchString(schedule.WorkEnd) {
		return fmt.Errorf("%w: work_start/work_end must be HH:MM", ErrInvalidSchedule)
	}
	for _, d := range schedule.WorkingDays {
		if d < 0 || d > 6 {
			return fmt.Errorf("%w: working_days must be 0–6", ErrInvalidSchedule)
		}
	}
	if err := s.repo.Save(ctx, schedule); err != nil {
		return fmt.Errorf("workschedule: save: %w", err)
	}
	return nil
}
