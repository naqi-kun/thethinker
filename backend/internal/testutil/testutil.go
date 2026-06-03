// Package testutil provides shared test helpers for the backend test suite.
package testutil

import "testing"

// AssertNoError fails the test if err is non-nil.
func AssertNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// AssertError fails the test if err is nil.
func AssertError(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("expected an error but got nil")
	}
}
