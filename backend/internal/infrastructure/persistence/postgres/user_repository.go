package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
)

var _ user.Repository = (*UserRepository)(nil)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// userColumns is the shared projection; google_id is coalesced because it is
// nullable for email/password accounts.
const userColumns = `id, email, name, password_hash, COALESCE(google_id, ''), created_at`

func (r *UserRepository) FindByID(ctx context.Context, id string) (*user.User, error) {
	return r.findOne(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*user.User, error) {
	return r.findOne(ctx, `SELECT `+userColumns+` FROM users WHERE email = $1`, email)
}

func (r *UserRepository) FindByGoogleID(ctx context.Context, googleID string) (*user.User, error) {
	return r.findOne(ctx, `SELECT `+userColumns+` FROM users WHERE google_id = $1`, googleID)
}

func (r *UserRepository) findOne(ctx context.Context, query string, arg string) (*user.User, error) {
	u := &user.User{}
	err := r.db.QueryRow(ctx, query, arg).
		Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.GoogleID, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepository) Save(ctx context.Context, u *user.User) error {
	// NULLIF keeps google_id NULL (not "") for email/password accounts so the
	// UNIQUE constraint doesn't reject multiple non-Google users.
	_, err := r.db.Exec(ctx,
		`INSERT INTO users (id, email, name, password_hash, google_id, created_at)
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6)
		 ON CONFLICT (id) DO UPDATE SET
		   email         = EXCLUDED.email,
		   name          = EXCLUDED.name,
		   password_hash = EXCLUDED.password_hash,
		   google_id     = EXCLUDED.google_id`,
		u.ID, u.Email, u.Name, u.PasswordHash, u.GoogleID, u.CreatedAt,
	)
	return err
}

func (r *UserRepository) FindPreferences(ctx context.Context, userID string) (*user.Preferences, error) {
	p := &user.Preferences{UserID: userID, UseAI: true}
	var answersJSON []byte
	err := r.db.QueryRow(ctx,
		`SELECT styles, answers, use_ai FROM user_preferences WHERE user_id = $1`,
		userID,
	).Scan(&p.Styles, &answersJSON, &p.UseAI)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(answersJSON, &p.Answers); err != nil {
		return nil, err
	}
	return p, nil
}

func (r *UserRepository) SavePreferences(ctx context.Context, p *user.Preferences) error {
	answersJSON, err := json.Marshal(p.Answers)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(ctx,
		`INSERT INTO user_preferences (user_id, styles, answers, use_ai)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id) DO UPDATE SET
		   styles  = EXCLUDED.styles,
		   answers = EXCLUDED.answers,
		   use_ai  = EXCLUDED.use_ai`,
		p.UserID, p.Styles, answersJSON, p.UseAI,
	)
	return err
}
