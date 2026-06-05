package wardrobe

import "errors"

var (
	ErrNotFound     = errors.New("wardrobe: item not found")
	ErrForbidden    = errors.New("wardrobe: access denied")
	ErrInvalidImage = errors.New("wardrobe: invalid image file")
)
