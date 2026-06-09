package postgres

import (
	"context"
	"errors"
	"time"

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

// ── Multi-calendar model (KAN-49) ────────────────────────────────────────────

func (r *CalendarRepository) SaveCalendar(ctx context.Context, cal *calendar.Calendar) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO calendars (id, user_id, name, source, ics_url, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		cal.ID, cal.UserID, cal.Name, cal.Source, cal.ICSURL, cal.CreatedAt,
	)
	return err
}

func (r *CalendarRepository) ListCalendars(ctx context.Context, userID string) ([]*calendar.Calendar, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, name, source, ics_url, created_at
		 FROM calendars
		 WHERE user_id = $1
		 ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cals []*calendar.Calendar
	for rows.Next() {
		c := &calendar.Calendar{}
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name, &c.Source, &c.ICSURL, &c.CreatedAt); err != nil {
			return nil, err
		}
		cals = append(cals, c)
	}
	return cals, rows.Err()
}

func (r *CalendarRepository) FindCalendar(ctx context.Context, id, userID string) (*calendar.Calendar, error) {
	c := &calendar.Calendar{}
	err := r.db.QueryRow(ctx,
		`SELECT id, user_id, name, source, ics_url, created_at
		 FROM calendars
		 WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&c.ID, &c.UserID, &c.Name, &c.Source, &c.ICSURL, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *CalendarRepository) DeleteCalendar(ctx context.Context, id, userID string) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM calendars WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}

// ReplaceCalendarEvents swaps the stored event snapshot for a calendar in one
// transaction: delete the old rows, insert the new ones.
func (r *CalendarRepository) ReplaceCalendarEvents(ctx context.Context, calendarID string, events []*calendar.Event) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM calendar_events WHERE calendar_id = $1`, calendarID); err != nil {
		return err
	}

	for _, e := range events {
		var endsAt *time.Time
		if !e.EndsAt.IsZero() {
			endsAt = &e.EndsAt
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO calendar_events (id, user_id, calendar_id, title, type, starts_at, ends_at, location, all_day)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			 ON CONFLICT (id, user_id) DO UPDATE SET
			   calendar_id = EXCLUDED.calendar_id,
			   title       = EXCLUDED.title,
			   type        = EXCLUDED.type,
			   starts_at   = EXCLUDED.starts_at,
			   ends_at     = EXCLUDED.ends_at,
			   location    = EXCLUDED.location,
			   all_day     = EXCLUDED.all_day`,
			e.ID, e.UserID, calendarID, e.Title, e.Type, e.StartsAt, endsAt, e.Location, e.AllDay,
		); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// FindEventsByDate returns the user's events that start within the given day
// [day 00:00, next day 00:00), in the day's location.
func (r *CalendarRepository) FindEventsByDate(ctx context.Context, userID string, day time.Time) ([]*calendar.Event, error) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.AddDate(0, 0, 1)

	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, calendar_id, title, type, starts_at, ends_at, location, all_day
		 FROM calendar_events
		 WHERE user_id = $1 AND starts_at >= $2 AND starts_at < $3
		 ORDER BY starts_at ASC`,
		userID, start, end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*calendar.Event
	for rows.Next() {
		e := &calendar.Event{}
		var endsAt *time.Time
		if err := rows.Scan(&e.ID, &e.UserID, &e.CalendarID, &e.Title, &e.Type, &e.StartsAt, &endsAt, &e.Location, &e.AllDay); err != nil {
			return nil, err
		}
		if endsAt != nil {
			e.EndsAt = *endsAt
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
