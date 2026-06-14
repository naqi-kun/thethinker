package wardrobe

import (
	"context"
	"time"
)

type Repository interface {
	FindByUserID(ctx context.Context, userID string) ([]*ClothingItem, error)
	FindByID(ctx context.Context, id string) (*ClothingItem, error)
	Save(ctx context.Context, item *ClothingItem) error
	UpdateImageURL(ctx context.Context, id, imageURL string) error
	UpdateStatus(ctx context.Context, id string, status Status) error
	Delete(ctx context.Context, id string) error
	MarkWorn(ctx context.Context, userID string, itemIDs []string, wornAt time.Time) error
}
