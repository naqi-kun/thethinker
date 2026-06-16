package user_test

import (
	"context"
	"errors"
	"testing"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
)

// fakeRepo is an in-memory user.Repository for service tests.
type fakeRepo struct {
	byID     map[string]*user.User
	byEmail  map[string]*user.User
	byGoogle map[string]*user.User
	saved    []*user.User
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		byID:     map[string]*user.User{},
		byEmail:  map[string]*user.User{},
		byGoogle: map[string]*user.User{},
	}
}

func (r *fakeRepo) add(u *user.User) {
	r.byID[u.ID] = u
	if u.Email != "" {
		r.byEmail[u.Email] = u
	}
	if u.GoogleID != "" {
		r.byGoogle[u.GoogleID] = u
	}
}

func (r *fakeRepo) FindByID(_ context.Context, id string) (*user.User, error) {
	return r.byID[id], nil
}
func (r *fakeRepo) FindByEmail(_ context.Context, email string) (*user.User, error) {
	return r.byEmail[email], nil
}
func (r *fakeRepo) FindByGoogleID(_ context.Context, gid string) (*user.User, error) {
	return r.byGoogle[gid], nil
}
func (r *fakeRepo) Save(_ context.Context, u *user.User) error {
	r.saved = append(r.saved, u)
	r.add(u)
	return nil
}
func (r *fakeRepo) FindPreferences(_ context.Context, _ string) (*user.Preferences, error) {
	return nil, nil
}
func (r *fakeRepo) SavePreferences(_ context.Context, _ *user.Preferences) error { return nil }

const testSecret = "test-secret"

func TestAuthenticateGoogle_NewUser(t *testing.T) {
	repo := newFakeRepo()
	svc := user.NewService(repo, testSecret)

	res, err := svc.AuthenticateGoogle(context.Background(), user.GoogleIdentity{
		GoogleID: "g-123", Email: "new@example.com", Name: "New User",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.IsNew {
		t.Error("expected IsNew=true for a first-time Google sign-in")
	}
	if res.Token == "" || res.UserID == "" {
		t.Error("expected a token and user id")
	}
	if len(repo.saved) != 1 || repo.saved[0].GoogleID != "g-123" {
		t.Errorf("expected the new user persisted with google_id, got %+v", repo.saved)
	}
}

func TestAuthenticateGoogle_ExistingGoogleUser(t *testing.T) {
	repo := newFakeRepo()
	repo.add(&user.User{ID: "u1", Email: "x@example.com", GoogleID: "g-123"})
	svc := user.NewService(repo, testSecret)

	res, err := svc.AuthenticateGoogle(context.Background(), user.GoogleIdentity{
		GoogleID: "g-123", Email: "x@example.com",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.IsNew {
		t.Error("expected IsNew=false for a returning Google user")
	}
	if res.UserID != "u1" {
		t.Errorf("expected existing user id u1, got %s", res.UserID)
	}
	if len(repo.saved) != 0 {
		t.Error("expected no write for an already-linked user")
	}
}

func TestAuthenticateGoogle_LinksExistingEmailAccount(t *testing.T) {
	repo := newFakeRepo()
	repo.add(&user.User{ID: "u1", Email: "existing@example.com", PasswordHash: "hash"})
	svc := user.NewService(repo, testSecret)

	res, err := svc.AuthenticateGoogle(context.Background(), user.GoogleIdentity{
		GoogleID: "g-999", Email: "existing@example.com", Name: "Existing",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.IsNew {
		t.Error("linking an existing email account is not a new account")
	}
	if res.UserID != "u1" {
		t.Errorf("expected to reuse user u1, got %s", res.UserID)
	}
	if u := repo.byGoogle["g-999"]; u == nil || u.ID != "u1" {
		t.Error("expected the Google ID linked onto the existing account")
	}
}

func TestAuthenticateGoogle_RejectsEmptyGoogleID(t *testing.T) {
	svc := user.NewService(newFakeRepo(), testSecret)
	_, err := svc.AuthenticateGoogle(context.Background(), user.GoogleIdentity{Email: "x@example.com"})
	if !errors.Is(err, user.ErrInvalidCredentials) {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}
