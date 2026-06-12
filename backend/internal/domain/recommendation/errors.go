package recommendation

import "errors"

var (
	ErrEmptyWardrobe   = errors.New("no clothing items in wardrobe")
	ErrSessionNotFound = errors.New("recommendation session not found or expired")
	ErrHistoryEmpty    = errors.New("no outfit history found")
	ErrInvalidCursor   = errors.New("invalid history cursor")
)
