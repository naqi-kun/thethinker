package user

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"school-gitlab.xsolla.dev/team3/thethinker/pkg/token"
)

var ErrEmailTaken = errors.New("email already registered")
var ErrInvalidCredentials = errors.New("invalid email or password")

type AuthResult struct {
	Token  string
	UserID string
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
