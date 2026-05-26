package postgres

import (
	"context"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

var _ wardrobe.Repository = (*WardrobeRepository)(nil)

type WardrobeRepository struct {
	// TODO: db *pgxpool.Pool
}

func NewWardrobeRepository( /* db *pgxpool.Pool */ ) *WardrobeRepository {
	return &WardrobeRepository{}
}

func (r *WardrobeRepository) FindByUserID(ctx context.Context, userID string) ([]*wardrobe.ClothingItem, error) {
	panic("not implemented")
}

func (r *WardrobeRepository) FindByID(ctx context.Context, id string) (*wardrobe.ClothingItem, error) {
	panic("not implemented")
}

func (r *WardrobeRepository) Save(ctx context.Context, item *wardrobe.ClothingItem) error {
	panic("not implemented")
}

func (r *WardrobeRepository) Delete(ctx context.Context, id string) error {
	panic("not implemented")
}
