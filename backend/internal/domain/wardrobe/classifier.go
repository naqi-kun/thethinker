package wardrobe

import "context"

// ClassifyResult holds the AI model's output for a single clothing image.
// All fields map directly to ClothingItem fields.
type ClassifyResult struct {
	Category        string
	SubType         string
	Color           string
	Fit             string
	Season          string
	Description     string
	ConfidenceScore float64
}

// Classifier is the domain port for the AI image classification service.
// Implementations live in internal/infrastructure/external/classifier/.
type Classifier interface {
	Classify(ctx context.Context, imageBytes []byte, contentType string) (*ClassifyResult, error)
}
