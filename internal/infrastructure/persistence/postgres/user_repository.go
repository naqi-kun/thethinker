package postgres

import (
	"context"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
)

// compile-time interface check
var _ user.Repository = (*UserRepository)(nil)

type UserRepository struct {
	// TODO: db *pgxpool.Pool
}

func NewUserRepository( /* db *pgxpool.Pool */ ) *UserRepository {
	return &UserRepository{}
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (*user.User, error) {
	panic("not implemented")
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*user.User, error) {
	panic("not implemented")
}

func (r *UserRepository) Save(ctx context.Context, u *user.User) error {
	panic("not implemented")
}

func (r *UserRepository) FindPreferences(ctx context.Context, userID string) (*user.Preferences, error) {
	panic("not implemented")
}

func (r *UserRepository) SavePreferences(ctx context.Context, p *user.Preferences) error {
	panic("not implemented")
}
