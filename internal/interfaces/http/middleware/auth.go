package middleware

import "net/http"

// Auth validates the JWT Bearer token on protected routes.
// TODO: implement JWT parsing and inject userID into request context
// TODO: consider using Datadog trace context propagation here
func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO: extract Authorization header, validate JWT, set userID in ctx
		next.ServeHTTP(w, r)
	})
}
