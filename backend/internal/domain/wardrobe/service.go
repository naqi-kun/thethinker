package wardrobe

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var ErrItemNotFound = errors.New("clothing item not found")

type Service struct {
	repo       Repository
	classifier Classifier
}

func NewService(repo Repository, classifier Classifier) *Service {
	return &Service{repo: repo, classifier: classifier}
}

func (s *Service) AddItem(ctx context.Context, userID string, item ClothingItem) (*ClothingItem, error) {
	if err := item.Validate(); err != nil {
		return nil, err
	}
	item.ID = uuid.New().String()
	item.UserID = userID
	item.CreatedAt = time.Now()
	if err := s.repo.Save(ctx, &item); err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) ListItems(ctx context.Context, userID, category string) ([]*ClothingItem, error) {
	items, err := s.repo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if category == "" {
		return items, nil
	}
	filtered := items[:0]
	for _, item := range items {
		if item.Category == category {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

// IngestScan classifies the provided image bytes via the AI service,
// creates a ClothingItem, persists it, and returns the saved item.
func (s *Service) IngestScan(ctx context.Context, userID string, imageBytes []byte, contentType string) (*ClothingItem, error) {
	result, err := s.classifier.Classify(ctx, imageBytes, contentType)
	if err != nil {
		return nil, fmt.Errorf("classify image: %w", err)
	}

	item := ClothingItem{
		Category: result.Category,
		SubType:  result.SubType,
		Color:    result.Color,
		Fit:      result.Fit,
		Season:   result.Season,
		ImageURL: "",
	}
	if err := item.Validate(); err != nil {
		return nil, err
	}
	item.ID = uuid.New().String()
	item.UserID = userID
	item.CreatedAt = time.Now()

	if err := s.repo.Save(ctx, &item); err != nil {
		return nil, err
	}
	return &item, nil
}
