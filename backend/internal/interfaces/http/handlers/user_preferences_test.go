package handlers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/handlers"
)

// These tests pin the partial-update merge semantics of PUT /users/me/preferences:
// fields omitted from the request body must keep their stored values instead of
// being overwritten with zero values (KAN-67 toggle regression).

func putPreferences(t *testing.T, svc *mockUserSvc, body string) *httptest.ResponseRecorder {
	t.Helper()
	h := handlers.NewUserHandler(svc)
	req := httptest.NewRequest(http.MethodPut, "/users/me/preferences", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, "user-123")
	rr := httptest.NewRecorder()
	h.UpdatePreferences(rr, req)
	return rr
}

func TestUpdatePreferences_UseAIOnly_PreservesStylesAndAnswers(t *testing.T) {
	existing := &user.Preferences{
		UserID:  "user-123",
		Styles:  []string{"casual", "formal"},
		Answers: map[string]string{"location": "Kuala Lumpur"},
		UseAI:   true,
	}
	var saved *user.Preferences
	svc := &mockUserSvc{
		getPreferences: func(_ context.Context, _ string) (*user.Preferences, error) {
			return existing, nil
		},
		savePreferences: func(_ context.Context, p *user.Preferences) error {
			saved = p
			return nil
		},
	}

	rr := putPreferences(t, svc, `{"use_ai":false}`)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if saved == nil {
		t.Fatal("SavePreferences was never called")
	}
	if saved.UseAI != false {
		t.Errorf("UseAI = %v, want false", saved.UseAI)
	}
	if len(saved.Styles) != 2 || saved.Styles[0] != "casual" {
		t.Errorf("Styles = %v, want existing [casual formal] preserved", saved.Styles)
	}
	if saved.Answers["location"] != "Kuala Lumpur" {
		t.Errorf("Answers = %v, want existing location preserved", saved.Answers)
	}
}

func TestUpdatePreferences_OmittedUseAI_KeepsStoredValue(t *testing.T) {
	existing := &user.Preferences{
		UserID: "user-123",
		Styles: []string{"casual"},
		UseAI:  false, // user previously disabled AI
	}
	var saved *user.Preferences
	svc := &mockUserSvc{
		getPreferences: func(_ context.Context, _ string) (*user.Preferences, error) {
			return existing, nil
		},
		savePreferences: func(_ context.Context, p *user.Preferences) error {
			saved = p
			return nil
		},
	}

	rr := putPreferences(t, svc, `{"styles":["formal"],"answers":{"location":"KL"}}`)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if saved.UseAI != false {
		t.Errorf("UseAI = %v, want stored false preserved when omitted", saved.UseAI)
	}
	if len(saved.Styles) != 1 || saved.Styles[0] != "formal" {
		t.Errorf("Styles = %v, want [formal] from request", saved.Styles)
	}
}

func TestUpdatePreferences_NoExistingPrefs_DefaultsAndNoPanic(t *testing.T) {
	var saved *user.Preferences
	svc := &mockUserSvc{
		getPreferences: func(_ context.Context, _ string) (*user.Preferences, error) {
			return nil, nil // new user: no prefs row yet
		},
		savePreferences: func(_ context.Context, p *user.Preferences) error {
			saved = p
			return nil
		},
	}

	rr := putPreferences(t, svc, `{"use_ai":false}`)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if saved == nil {
		t.Fatal("SavePreferences was never called")
	}
	if saved.UseAI != false {
		t.Errorf("UseAI = %v, want false from request", saved.UseAI)
	}

	var resp struct {
		UseAI   bool              `json:"use_ai"`
		Styles  []string          `json:"styles"`
		Answers map[string]string `json:"answers"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid response JSON: %v", err)
	}
	if resp.Styles == nil || resp.Answers == nil {
		t.Errorf("response must not have null styles/answers: %s", rr.Body.String())
	}
}

func TestUpdatePreferences_OmittedUseAI_NewUser_DefaultsTrue(t *testing.T) {
	var saved *user.Preferences
	svc := &mockUserSvc{
		getPreferences: func(_ context.Context, _ string) (*user.Preferences, error) {
			return nil, nil
		},
		savePreferences: func(_ context.Context, p *user.Preferences) error {
			saved = p
			return nil
		},
	}

	rr := putPreferences(t, svc, `{"styles":["casual"]}`)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rr.Code, rr.Body.String())
	}
	if saved.UseAI != true {
		t.Errorf("UseAI = %v, want default true for new user", saved.UseAI)
	}
}
