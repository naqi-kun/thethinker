package recommendation

import "errors"

var (
	ErrEmptyWardrobe   = errors.New("no clothing items in wardrobe")
	ErrSessionNotFound = errors.New("recommendation session not found or expired")
	// ErrAIServerError marks a 5xx from the AI service. Unlike a hard 4xx, a 5xx
	// on a regenerate (e.g. the AI restarted and lost the session) is recoverable
	// by starting a fresh session, so the domain treats it like a stale session.
	ErrAIServerError = errors.New("ai service returned a server error")
	// ErrAIUnavailable marks a transport-level failure reaching the AI service
	// (connection refused, EOF, timeout) — typically a cold-start race where the
	// container is up but uvicorn isn't accepting connections yet. Unlike a 4xx
	// contract error it's transient, so the domain retries before falling back.
	ErrAIUnavailable = errors.New("ai service unavailable")
	ErrHistoryEmpty  = errors.New("no outfit history found")
	ErrInvalidCursor = errors.New("invalid history cursor")
)
