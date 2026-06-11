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
	bgRemover  BgRemover // optional; nil disables background removal
}

func NewService(repo Repository, classifier Classifier, imageStore ImageStore, bgRemover BgRemover) *Service {
	return &Service{repo: repo, classifier: classifier, imageStore: imageStore, bgRemover: bgRemover}
}

// removeBackground is a best-effort helper. It calls the AI service to strip
// the background and returns PNG bytes. On any failure it returns nil so the
// caller falls back to the original image without failing the upload.
func (s *Service) removeBackground(ctx context.Context, imageBytes []byte) []byte {
	if s.bgRemover == nil {
		return nil
	}
	result, err := s.bgRemover.RemoveBackground(ctx, imageBytes)
	if err != nil {
		return nil
	}
	return result
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

func (s *Service) DeleteItem(ctx context.Context, itemID, userID string) error {
	item, err := s.repo.FindByID(ctx, itemID)
	if err != nil {
		return fmt.Errorf("wardrobe: find item: %w", err)
	}
	if item == nil {
		return ErrNotFound
	}
	if item.UserID != userID {
		return ErrForbidden
	}
	return s.repo.Delete(ctx, itemID)
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
	existing.Name = fields.Name
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
	// Try background removal first; fall back to JPEG if the AI service is unavailable.
	if pngBytes := s.removeBackground(ctx, imageBytes); pngBytes != nil {
		objectName := path.Join("wardrobe", userID, item.ID, "scan-"+uuid.NewString()+".png")
		if imageURL, err := s.imageStore.Upload(ctx, objectName, "image/png", bytes.NewReader(pngBytes), int64(len(pngBytes))); err == nil {
			item.ImageURL = imageURL
		}
	} else if processed, err := processImage(bytes.NewReader(imageBytes)); err == nil {
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

	// Validate the upload is a real image by attempting a JPEG decode/encode.
	// This surfaces invalid uploads as a user-facing error before we hit the AI service.
	if _, err := processImage(bytes.NewReader(imageData)); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidImage, err)
	}

	// Try background removal — returns a transparent PNG. Fall back to JPEG on failure.
	var (
		imageURL    string
		uploadErr   error
		objectName  string
	)
	if pngBytes := s.removeBackground(ctx, imageData); pngBytes != nil {
		objectName = path.Join("wardrobe", userID, itemID, time.Now().UTC().Format("20060102T150405")+"-"+uuid.NewString()+".png")
		imageURL, uploadErr = s.imageStore.Upload(ctx, objectName, "image/png", bytes.NewReader(pngBytes), int64(len(pngBytes)))
	}
	if imageURL == "" {
		// bg removal unavailable or upload failed — store original as JPEG
		processed, _ := processImage(bytes.NewReader(imageData))
		objectName = path.Join("wardrobe", userID, itemID, time.Now().UTC().Format("20060102T150405")+"-"+uuid.NewString()+".jpg")
		imageURL, uploadErr = s.imageStore.Upload(ctx, objectName, "image/jpeg", bytes.NewReader(processed), int64(len(processed)))
	}
	if uploadErr != nil {
		return nil, fmt.Errorf("wardrobe: upload image: %w", uploadErr)
	}

	if err := s.repo.UpdateImageURL(ctx, itemID, imageURL); err != nil {
		return nil, fmt.Errorf("wardrobe: update image url: %w", err)
	}

	item.ImageURL = imageURL
	return item, nil
}
