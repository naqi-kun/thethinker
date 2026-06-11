package postgres

import (
	"context"
	"errors"
	"time"

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

// scanRow reads the raw string values that pgx returns for enum columns and
// converts them to the typed enum values used by the domain.
func scanRow(
	id, userID, name, category, subType, color, fit, season, imageURL *string,
	lastWorn *time.Time,
	createdAt *time.Time,
) (*wardrobe.ClothingItem, error) {
	cat, err := wardrobe.ParseCategory(*category)
	if err != nil {
		return nil, err
	}
	sub, err := wardrobe.ParseSubType(*subType)
	if err != nil {
		return nil, err
	}
	col, err := wardrobe.ParseColor(*color)
	if err != nil {
		return nil, err
	}
	f, err := wardrobe.ParseFit(*fit)
	if err != nil {
		return nil, err
	}
	sea, err := wardrobe.ParseSeason(*season)
	if err != nil {
		return nil, err
	}
	return &wardrobe.ClothingItem{
		ID:        *id,
		UserID:    *userID,
		Name:      *name,
		Category:  cat,
		SubType:   sub,
		Color:     col,
		Fit:       f,
		Season:    sea,
		ImageURL:  *imageURL,
		LastWorn:  lastWorn,
		CreatedAt: *createdAt,
	}, nil
}

func (r *WardrobeRepository) FindByUserID(ctx context.Context, userID string) ([]*wardrobe.ClothingItem, error) {
	rows, err := queryFromContext(ctx, r.db).Query(ctx,
		`SELECT id, user_id, name, category, sub_type, color, fit, season, image_url, last_worn, created_at
		 FROM wardrobe_items WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*wardrobe.ClothingItem
	for rows.Next() {
		var (
			id, uid, name, category, subType, color, fit, season, imageURL string
			lastWorn                                                        *time.Time
			createdAt                                                       time.Time
		)
		if err := rows.Scan(&id, &uid, &name, &category, &subType, &color, &fit, &season, &imageURL, &lastWorn, &createdAt); err != nil {
			return nil, err
		}
		item, err := scanRow(&id, &uid, &name, &category, &subType, &color, &fit, &season, &imageURL, lastWorn, &createdAt)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *WardrobeRepository) FindByID(ctx context.Context, id string) (*wardrobe.ClothingItem, error) {
	var (
		rid, uid, name, category, subType, color, fit, season, imageURL string
		lastWorn                                                         *time.Time
		createdAt                                                        time.Time
	)
	err := queryFromContext(ctx, r.db).QueryRow(ctx,
		`SELECT id, user_id, name, category, sub_type, color, fit, season, image_url, last_worn, created_at
		 FROM wardrobe_items WHERE id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&rid, &uid, &name, &category, &subType, &color, &fit, &season, &imageURL, &lastWorn, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return scanRow(&rid, &uid, &name, &category, &subType, &color, &fit, &season, &imageURL, lastWorn, &createdAt)
}

func (r *WardrobeRepository) Save(ctx context.Context, item *wardrobe.ClothingItem) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO wardrobe_items (id, user_id, name, category, sub_type, color, fit, season, image_url, last_worn, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 ON CONFLICT (id) DO UPDATE SET
		   name      = EXCLUDED.name,
		   category  = EXCLUDED.category,
		   sub_type  = EXCLUDED.sub_type,
		   color     = EXCLUDED.color,
		   fit       = EXCLUDED.fit,
		   season    = EXCLUDED.season,
		   image_url = EXCLUDED.image_url,
		   last_worn = EXCLUDED.last_worn`,
		item.ID, item.UserID, item.Name,
		item.Category.String(), item.SubType.String(), item.Color.String(),
		item.Fit.String(), item.Season.String(),
		item.ImageURL, item.LastWorn, item.CreatedAt,
	)
	return err
}

func (r *WardrobeRepository) UpdateImageURL(ctx context.Context, id, imageURL string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE wardrobe_items SET image_url = $1 WHERE id = $2`,
		imageURL, id,
	)
	return err
}

func (r *WardrobeRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE wardrobe_items SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	return err
}

func (r *WardrobeRepository) MarkWorn(ctx context.Context, userID string, itemIDs []string, wornAt time.Time) error {
	_, err := queryFromContext(ctx, r.db).Exec(ctx,
		`UPDATE wardrobe_items SET last_worn = $1 WHERE user_id = $2 AND id::text = ANY($3) AND deleted_at IS NULL`,
		wornAt, userID, itemIDs,
	)
	return err
}
