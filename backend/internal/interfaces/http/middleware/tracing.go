package middleware

import (
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

// Tracing wraps a handler with OTel HTTP instrumentation, recording each
// inbound request as a span with method, route, and status code attributes.
func Tracing(handler http.Handler) http.Handler {
	return otelhttp.NewHandler(handler, "http.server")
}
