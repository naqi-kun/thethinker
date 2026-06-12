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

func (r *UserRepository) FindByID(ctx context.Context, id string) (*user.User, error) {
	u := &user.User{}
	err := r.db.QueryRow(ctx,
		`SELECT id, email, password_hash, created_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*user.User, error) {
	u := &user.User{}
	err := r.db.QueryRow(ctx,
		`SELECT id, email, password_hash, created_at FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepository) Save(ctx context.Context, u *user.User) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO users (id, email, password_hash, created_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (id) DO UPDATE SET
		   email         = EXCLUDED.email,
		   password_hash = EXCLUDED.password_hash`,
		u.ID, u.Email, u.PasswordHash, u.CreatedAt,
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
