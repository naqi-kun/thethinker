package token

import "testing"

func TestSignVerifyRoundTrip(t *testing.T) {
	const (
		secret = "test-secret"
		userID = "user-123"
	)

	tok, err := Sign(userID, secret)
	if err != nil {
		t.Fatalf("Sign returned error: %v", err)
	}
	if tok == "" {
		t.Fatal("Sign returned empty token")
	}

	got, err := Verify(tok, secret)
	if err != nil {
		t.Fatalf("Verify returned error: %v", err)
	}
	if got != userID {
		t.Errorf("Verify subject = %q, want %q", got, userID)
	}
}

func TestVerifyWrongSecret(t *testing.T) {
	tok, err := Sign("user-1", "right-secret")
	if err != nil {
		t.Fatalf("Sign returned error: %v", err)
	}
	if _, err := Verify(tok, "wrong-secret"); err == nil {
		t.Error("Verify with wrong secret: expected error, got nil")
	}
}

func TestVerifyMalformedToken(t *testing.T) {
	if _, err := Verify("not-a-jwt", "secret"); err == nil {
		t.Error("Verify with malformed token: expected error, got nil")
	}
}
