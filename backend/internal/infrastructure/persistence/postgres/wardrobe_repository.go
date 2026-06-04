package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

var _ wardrobe.Repository = (*WardrobeRepository)(nil)

type WardrobeRepository struct {
	db *pgxpool.Pool
}

func NewWardrobeRepository(db *pgxpool.Pool) *WardrobeRepository {
	return &WardrobeRepository{db: db}
}

func (r *WardrobeRepository) FindByUserID(ctx context.Context, userID string) ([]*wardrobe.ClothingItem, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, category, sub_type, color, fit, season, image_url, last_worn, created_at
		 FROM wardrobe_items WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*wardrobe.ClothingItem
	for rows.Next() {
		item := &wardrobe.ClothingItem{}
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Category, &item.SubType,
			&item.Color, &item.Fit, &item.Season, &item.ImageURL,
			&item.LastWorn, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *WardrobeRepository) FindByID(ctx context.Context, id string) (*wardrobe.ClothingItem, error) {
	item := &wardrobe.ClothingItem{}
	err := r.db.QueryRow(ctx,
		`SELECT id, user_id, category, sub_type, color, fit, season, image_url, last_worn, created_at
		 FROM wardrobe_items WHERE id = $1`,
		id,
	).Scan(
		&item.ID, &item.UserID, &item.Category, &item.SubType,
		&item.Color, &item.Fit, &item.Season, &item.ImageURL,
		&item.LastWorn, &item.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (r *WardrobeRepository) Save(ctx context.Context, item *wardrobe.ClothingItem) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO wardrobe_items (id, user_id, category, sub_type, color, fit, season, image_url, last_worn, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (id) DO UPDATE SET
		   category  = EXCLUDED.category,
		   sub_type  = EXCLUDED.sub_type,
		   color     = EXCLUDED.color,
		   fit       = EXCLUDED.fit,
		   season    = EXCLUDED.season,
		   image_url = EXCLUDED.image_url,
		   last_worn = EXCLUDED.last_worn`,
		item.ID, item.UserID, item.Category, item.SubType,
		item.Color, item.Fit, item.Season, item.ImageURL,
		item.LastWorn, item.CreatedAt,
	)
	return err
}

func (r *WardrobeRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM wardrobe_items WHERE id = $1`, id)
	return err
}
