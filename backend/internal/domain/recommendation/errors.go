package recommendation

import "errors"

var (
	ErrEmptyWardrobe   = errors.New("no clothing items in wardrobe")
	ErrSessionNotFound = errors.New("recommendation session not found or expired")
)
