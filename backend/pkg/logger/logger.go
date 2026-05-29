package logger

import (
	"log/slog"
	"os"
)

// New returns a structured JSON logger.
// TODO: swap with Datadog-compatible handler (dd-trace-go log injection) when wiring Datadog
func New() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, nil))
}
