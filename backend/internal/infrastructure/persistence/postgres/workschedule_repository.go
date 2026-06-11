package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/workschedule"
)

var _ workschedule.Repository = (*WorkScheduleRepository)(nil)

type WorkScheduleRepository struct {
	db *pgxpool.Pool
}

func NewWorkScheduleRepository(db *pgxpool.Pool) *WorkScheduleRepository {
	return &WorkScheduleRepository{db: db}
}

func (r *WorkScheduleRepository) Get(ctx context.Context, userID string) (*workschedule.Schedule, error) {
	var days []int16
	var start, end string
	var holidays []time.Time

	err := r.db.QueryRow(ctx,
		`SELECT working_days, work_start, work_end, holidays
		 FROM work_schedules WHERE user_id = $1`,
		userID,
	).Scan(&days, &start, &end, &holidays)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	weekdays := make([]time.Weekday, len(days))
	for i, d := range days {
		weekdays[i] = time.Weekday(d)
	}
	return &workschedule.Schedule{
		UserID:      userID,
		WorkingDays: weekdays,
		WorkStart:   start,
		WorkEnd:     end,
		Holidays:    holidays,
	}, nil
}

func (r *WorkScheduleRepository) Save(ctx context.Context, s *workschedule.Schedule) error {
	days := make([]int16, len(s.WorkingDays))
	for i, d := range s.WorkingDays {
		days[i] = int16(d)
	}
	holidays := s.Holidays
	if holidays == nil {
		holidays = []time.Time{}
	}

	_, err := r.db.Exec(ctx,
		`INSERT INTO work_schedules (user_id, working_days, work_start, work_end, holidays)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (user_id) DO UPDATE SET
		   working_days = EXCLUDED.working_days,
		   work_start   = EXCLUDED.work_start,
		   work_end     = EXCLUDED.work_end,
		   holidays     = EXCLUDED.holidays`,
		s.UserID, days, s.WorkStart, s.WorkEnd, holidays,
	)
	return err
}
