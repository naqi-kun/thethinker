package user

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"school-gitlab.xsolla.dev/team3/thethinker/pkg/token"
)

var ErrEmailTaken = errors.New("email already registered")
var ErrInvalidCredentials = errors.New("invalid email or password")
var ErrInvalidName = errors.New("name must be 1–100 characters")

const maxNameLen = 100

type AuthResult struct {
	Token  string
	UserID string
	IsNew  bool // true when this call created a new account (drives onboarding)
}

type Service struct {
	repo      Repository
	jwtSecret string
}

func NewService(repo Repository, jwtSecret string) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret}
}

func (s *Service) Register(ctx context.Context, email, password string) (*AuthResult, error) {
	existing, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	u := &User{
		ID:           uuid.New().String(),
		Email:        email,
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
	}
	if err := s.repo.Save(ctx, u); err != nil {
		return nil, err
	}

	tok, err := token.Sign(u.ID, s.jwtSecret)
	if err != nil {
		return nil, err
	}
	return &AuthResult{Token: tok, UserID: u.ID}, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	u, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	tok, err := token.Sign(u.ID, s.jwtSecret)
	if err != nil {
		return nil, err
	}
	return &AuthResult{Token: tok, UserID: u.ID}, nil
}

// AuthenticateGoogle signs a user in from a verified Google identity, creating
// the account on first use. Lookup order: by Google ID, then by email (linking
// Google to a pre-existing email/password account), else create a new account.
func (s *Service) AuthenticateGoogle(ctx context.Context, id GoogleIdentity) (*AuthResult, error) {
	if id.GoogleID == "" {
		return nil, ErrInvalidCredentials
	}

	u, err := s.repo.FindByGoogleID(ctx, id.GoogleID)
	if err != nil {
		return nil, err
	}

	isNew := false
	switch {
	case u != nil:
		// Already linked — nothing to persist.
	default:
		// No Google link yet: adopt an existing email account or create one.
		u, err = s.repo.FindByEmail(ctx, id.Email)
		if err != nil {
			return nil, err
		}
		if u != nil {
			u.GoogleID = id.GoogleID
			if u.Name == "" {
				u.Name = id.Name
			}
		} else {
			isNew = true
			u = &User{
				ID:        uuid.New().String(),
				Email:     id.Email,
				Name:      id.Name,
				GoogleID:  id.GoogleID,
				CreatedAt: time.Now(),
			}
		}
		if err := s.repo.Save(ctx, u); err != nil {
			return nil, err
		}
	}

	tok, err := token.Sign(u.ID, s.jwtSecret)
	if err != nil {
		return nil, err
	}
	return &AuthResult{Token: tok, UserID: u.ID, IsNew: isNew}, nil
}

// GetProfile returns the authenticated user's account profile.
func (s *Service) GetProfile(ctx context.Context, userID string) (*User, error) {
	u, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrInvalidCredentials
	}
	return u, nil
}

// UpdateProfile updates the user's editable display name and returns the
// updated profile. The name is trimmed; empty or over-long names are rejected.
func (s *Service) UpdateProfile(ctx context.Context, userID, name string) (*User, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxNameLen {
		return nil, ErrInvalidName
	}

	u, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrInvalidCredentials
	}

	u.Name = name
	if err := s.repo.Save(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// GetPreferences returns the user's style preferences, or an empty struct if
// none have been saved yet (e.g. a new user who skipped onboarding).
func (s *Service) GetPreferences(ctx context.Context, userID string) (*Preferences, error) {
	p, err := s.repo.FindPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return &Preferences{UserID: userID, Styles: []string{}, Answers: map[string]string{}}, nil
	}
	return p, nil
}

// SavePreferences upserts the user's style preferences.
func (s *Service) SavePreferences(ctx context.Context, p *Preferences) error {
	if p.Answers == nil {
		p.Answers = map[string]string{}
	}
	return s.repo.SavePreferences(ctx, p)
}
