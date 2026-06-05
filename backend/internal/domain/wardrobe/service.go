package wardrobe

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"path"
	"time"

	"github.com/google/uuid"
)

var ErrItemNotFound = errors.New("clothing item not found")

// ImageStore abstracts the object storage backend (GCS / S3 / etc.).
type ImageStore interface {
	Upload(ctx context.Context, objectName, contentType string, r io.Reader, size int64) (string, error)
	PublicURL(objectName string) string
}

type Service struct {
	repo       Repository
	classifier Classifier
	imageStore ImageStore
}

func NewService(repo Repository, classifier Classifier, imageStore ImageStore) *Service {
	return &Service{repo: repo, classifier: classifier, imageStore: imageStore}
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
		return nil, fmt.Errorf("wardrobe: list items: %w", err)
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

// UploadImage processes, stores, and links an image to an existing clothing item.
// imageData is the raw uploaded bytes; it will be resized and re-encoded to JPEG.
func (s *Service) UploadImage(ctx context.Context, itemID, userID string, imageData []byte) (*ClothingItem, error) {
	item, err := s.repo.FindByID(ctx, itemID)
	if err != nil {
		return nil, fmt.Errorf("wardrobe: find item: %w", err)
	}
	if item == nil {
		return nil, ErrNotFound
	}
	if item.UserID != userID {
		return nil, ErrForbidden
	}

	// Optimize: resize + compress to JPEG. A decode/encode failure means the
	// upload wasn't a usable image, so surface it as an invalid-input error.
	processed, err := processImage(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidImage, err)
	}

	objectName := path.Join("wardrobe", userID, itemID, time.Now().UTC().Format("20060102T150405")+"-"+uuid.NewString()+".jpg")
	imageURL, err := s.imageStore.Upload(ctx, objectName, "image/jpeg", bytes.NewReader(processed), int64(len(processed)))
	if err != nil {
		return nil, fmt.Errorf("wardrobe: upload image: %w", err)
	}

	if err := s.repo.UpdateImageURL(ctx, itemID, imageURL); err != nil {
		return nil, fmt.Errorf("wardrobe: update image url: %w", err)
	}

	item.ImageURL = imageURL
	return item, nil
}
