package wardrobe

import "context"

type Repository interface {
	FindByUserID(ctx context.Context, userID string) ([]*ClothingItem, error)
	FindByID(ctx context.Context, id string) (*ClothingItem, error)
	Save(ctx context.Context, item *ClothingItem) error
	UpdateImageURL(ctx context.Context, id, imageURL string) error
	Delete(ctx context.Context, id string) error
}
