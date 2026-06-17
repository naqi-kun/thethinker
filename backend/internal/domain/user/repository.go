package user

import "context"

type Repository interface {
	FindByID(ctx context.Context, id string) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByGoogleID(ctx context.Context, googleID string) (*User, error)
	Save(ctx context.Context, u *User) error
	FindPreferences(ctx context.Context, userID string) (*Preferences, error)
	SavePreferences(ctx context.Context, p *Preferences) error
}
