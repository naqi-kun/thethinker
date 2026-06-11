package wardrobe

import "context"

// BgRemover is the domain port for the background removal service.
// Implementations live in internal/infrastructure/external/classifier/.
// RemoveBackground returns PNG bytes with a transparent background.
// Callers must handle errors gracefully — the service is best-effort.
type BgRemover interface {
	RemoveBackground(ctx context.Context, imageBytes []byte) ([]byte, error)
}
