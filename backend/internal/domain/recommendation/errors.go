package recommendation

import "errors"

var (
	ErrEmptyWardrobe   = errors.New("no clothing items in wardrobe")
	ErrSessionNotFound = errors.New("recommendation session not found or expired")
	// ErrAIServerError marks a 5xx from the AI service. Unlike a hard 4xx, a 5xx
	// on a regenerate (e.g. the AI restarted and lost the session) is recoverable
	// by starting a fresh session, so the domain treats it like a stale session.
	ErrAIServerError = errors.New("ai service returned a server error")
	ErrHistoryEmpty  = errors.New("no outfit history found")
	ErrInvalidCursor = errors.New("invalid history cursor")
)
