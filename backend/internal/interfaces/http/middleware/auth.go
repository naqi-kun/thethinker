package middleware

import (
	"context"
	"net/http"
	"strings"

	"school-gitlab.xsolla.dev/team3/thethinker/pkg/token"
)

type contextKey string

const UserIDKey contextKey = "userID"

// Auth returns a middleware that validates the Bearer JWT on protected routes.
func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				writeUnauthorized(w, "missing or malformed token")
				return
			}

			userID, err := token.Verify(strings.TrimPrefix(authHeader, "Bearer "), jwtSecret)
			if err != nil {
				writeUnauthorized(w, "invalid or expired token")
				return
			}

			next.ServeHTTP(w, r.WithContext(
				context.WithValue(r.Context(), UserIDKey, userID),
			))
		})
	}
}

// GetUserID extracts the authenticated user's ID from the request context.
func GetUserID(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(UserIDKey).(string)
	return id, ok
}

func writeUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	w.Write([]byte(`{"code":"UNAUTHORIZED","message":"` + message + `"}`))
}
