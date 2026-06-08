package handlers_test

import (
	"context"
	"net/http"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

// withUserID injects a userID into the request context, simulating the auth middleware.
func withUserID(r *http.Request, userID string) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}
