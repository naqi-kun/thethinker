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

// AddItem persists a new clothing item for the given user.
// Callers are responsible for constructing item via the Parse* helpers so that
// all enum fields hold intentional values — zero values are valid (e.g. CategoryFormal)
// and cannot be distinguished from an uninitialized struct at this layer.
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
		return nil, fmt.Errorf("wardrobe: list items: %w", err)
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

func (s *Service) MarkItemsWorn(ctx context.Context, userID string, itemIDs []string) error {
	return s.repo.MarkWorn(ctx, userID, itemIDs, time.Now())
}

// UpdateItem replaces the editable fields of an existing item owned by userID.
func (s *Service) UpdateItem(ctx context.Context, itemID, userID string, fields ClothingItem) (*ClothingItem, error) {
	existing, err := s.repo.FindByID(ctx, itemID)
	if err != nil {
		return nil, fmt.Errorf("wardrobe: find item: %w", err)
	}
	if existing == nil {
		return nil, ErrNotFound
	}
	if existing.UserID != userID {
		return nil, ErrForbidden
	}
	existing.Category = fields.Category
	existing.SubType = fields.SubType
	existing.Color = fields.Color
	existing.Fit = fields.Fit
	existing.Season = fields.Season
	if err := s.repo.Save(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// ClassifyOnly runs the AI classifier and returns its raw result without saving anything.
// Use this for the review step before the user confirms the item.
func (s *Service) ClassifyOnly(ctx context.Context, imageBytes []byte, contentType string) (*ClassifyResult, error) {
	result, err := s.classifier.Classify(ctx, imageBytes, contentType)
	if err != nil {
		return nil, fmt.Errorf("classify image: %w", err)
	}
	return result, nil
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
		return nil, err
	}
	subType, err := ParseSubType(result.SubType)
	if err != nil {
		return nil, err
	}
	color, err := ParseColor(result.Color)
	if err != nil {
		return nil, err
	}
	fit, err := ParseFit(result.Fit)
	if err != nil {
		return nil, err
	}
	season, err := ParseSeason(result.Season)
	if err != nil {
		return nil, err
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

	// Best-effort: store the scanned image so it appears in the wardrobe.
	// Process to JPEG first for consistency; if either step fails, continue without an image URL.
	if processed, err := processImage(bytes.NewReader(imageBytes)); err == nil {
		objectName := path.Join("wardrobe", userID, item.ID, "scan-"+uuid.NewString()+".jpg")
		if imageURL, err := s.imageStore.Upload(ctx, objectName, "image/jpeg", bytes.NewReader(processed), int64(len(processed))); err == nil {
			item.ImageURL = imageURL
		}
	}

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
