package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
)

var _ calendar.Repository = (*CalendarRepository)(nil)

type CalendarRepository struct {
	db *pgxpool.Pool
}

func NewCalendarRepository(db *pgxpool.Pool) *CalendarRepository {
	return &CalendarRepository{db: db}
}

func (r *CalendarRepository) FindConnection(ctx context.Context, userID string) (*calendar.CalendarConnection, error) {
	conn := &calendar.CalendarConnection{}
	err := r.db.QueryRow(ctx,
		`SELECT user_id, provider, token, expires_at FROM calendar_connections WHERE user_id = $1`,
		userID,
	).Scan(&conn.UserID, &conn.Provider, &conn.Token, &conn.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return conn, nil
}

func (r *CalendarRepository) SaveConnection(ctx context.Context, conn *calendar.CalendarConnection) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO calendar_connections (user_id, provider, token, expires_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id) DO UPDATE SET
		   provider   = EXCLUDED.provider,
		   token      = EXCLUDED.token,
		   expires_at = EXCLUDED.expires_at`,
		conn.UserID, conn.Provider, conn.Token, conn.ExpiresAt,
	)
	return err
}

func (r *CalendarRepository) DeleteConnection(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM calendar_connections WHERE user_id = $1`, userID)
	return err
}

// FindUpcomingEvents returns cached events stored after a calendar sync.
func (r *CalendarRepository) FindUpcomingEvents(ctx context.Context, userID string) ([]*calendar.Event, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, title, type, starts_at, location
		 FROM calendar_events
		 WHERE user_id = $1 AND starts_at >= now()
		 ORDER BY starts_at ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*calendar.Event
	for rows.Next() {
		e := &calendar.Event{}
		if err := rows.Scan(&e.ID, &e.UserID, &e.Title, &e.Type, &e.StartsAt, &e.Location); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
