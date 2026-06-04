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
	item.ID = uuid.New().String()
	item.UserID = userID
	item.CreatedAt = time.Now()
	if err := s.repo.Save(ctx, &item); err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) ListItems(ctx context.Context, userID, categoryStr string) ([]*ClothingItem, error) {
	items, err := s.repo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if categoryStr == "" {
		return items, nil
	}
	cat, err := ParseCategory(categoryStr)
	if err != nil {
		return nil, err
	}
	filtered := items[:0]
	for _, item := range items {
		if item.Category == cat {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

// IngestScan classifies the image, converts the AI string output to typed enums,
// persists the item, and returns it.
func (s *Service) IngestScan(ctx context.Context, userID string, imageBytes []byte, contentType string) (*ClothingItem, error) {
	result, err := s.classifier.Classify(ctx, imageBytes, contentType)
	if err != nil {
		return nil, fmt.Errorf("classify image: %w", err)
	}

	category, err := ParseCategory(result.Category)
	if err != nil {
		return nil, ErrInvalidClassification
	}
	subType, err := ParseSubType(result.SubType)
	if err != nil {
		return nil, ErrInvalidClassification
	}
	color, err := ParseColor(result.Color)
	if err != nil {
		return nil, ErrInvalidClassification
	}
	fit, err := ParseFit(result.Fit)
	if err != nil {
		return nil, ErrInvalidClassification
	}
	season, err := ParseSeason(result.Season)
	if err != nil {
		return nil, ErrInvalidClassification
	}

	item := ClothingItem{
		ID:        uuid.New().String(),
		UserID:    userID,
		Category:  category,
		SubType:   subType,
		Color:     color,
		Fit:       fit,
		Season:    season,
		CreatedAt: time.Now(),
	}
	if err := s.repo.Save(ctx, &item); err != nil {
		return nil, err
	}
	return &item, nil
}
