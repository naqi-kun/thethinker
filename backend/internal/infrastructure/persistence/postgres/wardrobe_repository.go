package postgres

import (
	"context"
	"errors"
	"log"
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

// wardrobeRow holds the raw string values pgx returns for a wardrobe_items row,
// before the enum columns are parsed into typed domain values.
type wardrobeRow struct {
	id, userID, name, category, subType, color, fit, season, pattern, status, imageURL, description string
	lastWorn                                                                                        *time.Time
	createdAt                                                                                       time.Time
}

// toClothingItem converts the raw enum strings into the typed enum values used
// by the domain. It returns ErrInvalidClassification (wrapped) if any stored
// enum value is unrecognized.
func (row wardrobeRow) toClothingItem() (*wardrobe.ClothingItem, error) {
	cat, err := wardrobe.ParseCategory(row.category)
	if err != nil {
		return nil, err
	}
	sub, err := wardrobe.ParseSubType(row.subType)
	if err != nil {
		return nil, err
	}
	col, err := wardrobe.ParseColor(row.color)
	if err != nil {
		return nil, err
	}
	f, err := wardrobe.ParseFit(row.fit)
	if err != nil {
		return nil, err
	}
	sea, err := wardrobe.ParseSeason(row.season)
	if err != nil {
		return nil, err
	}
	pat, err := wardrobe.ParsePattern(row.pattern)
	if err != nil {
		return nil, err
	}
	st, err := wardrobe.ParseStatus(row.status)
	if err != nil {
		return nil, err
	}
	return &wardrobe.ClothingItem{
		ID:          row.id,
		UserID:      row.userID,
		Name:        row.name,
		Category:    cat,
		SubType:     sub,
		Color:       col,
		Fit:         f,
		Season:      sea,
		Pattern:     pat,
		Status:      st,
		ImageURL:    row.imageURL,
		Description: row.description,
		LastWorn:    row.lastWorn,
		CreatedAt:   row.createdAt,
	}, nil
}

// collectItems maps scanned rows to domain items, skipping (and logging) any row
// whose stored enum values are unrecognized. A single malformed row — e.g. a
// classifier emitting "dark grey" or "slim-fit" — must not fail the entire
// wardrobe read, so bad rows are dropped rather than aborting the scan. Always
// returns a non-nil slice so an all-bad wardrobe serializes as [] rather than null.
func collectItems(userID string, rows []wardrobeRow) []*wardrobe.ClothingItem {
	items := make([]*wardrobe.ClothingItem, 0, len(rows))
	for _, row := range rows {
		item, err := row.toClothingItem()
		if err != nil {
			log.Printf("wardrobe: skipping malformed item %s for user %s: %v", row.id, userID, err)
			continue
		}
		items = append(items, item)
	}
	return items
}

func (r *WardrobeRepository) FindByUserID(ctx context.Context, userID string) ([]*wardrobe.ClothingItem, error) {
	rows, err := queryFromContext(ctx, r.db).Query(ctx,
		`SELECT id, user_id, name, category, sub_type, color, fit, season, pattern, status, image_url, description, last_worn, created_at
		 FROM wardrobe_items WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rawRows []wardrobeRow
	for rows.Next() {
		var row wardrobeRow
		if err := rows.Scan(&row.id, &row.userID, &row.name, &row.category, &row.subType, &row.color, &row.fit, &row.season, &row.pattern, &row.status, &row.imageURL, &row.description, &row.lastWorn, &row.createdAt); err != nil {
			return nil, err
		}
		rawRows = append(rawRows, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return collectItems(userID, rawRows), nil
}

func (r *WardrobeRepository) FindByID(ctx context.Context, id string) (*wardrobe.ClothingItem, error) {
	var row wardrobeRow
	err := queryFromContext(ctx, r.db).QueryRow(ctx,
		`SELECT id, user_id, name, category, sub_type, color, fit, season, pattern, status, image_url, description, last_worn, created_at
		 FROM wardrobe_items WHERE id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&row.id, &row.userID, &row.name, &row.category, &row.subType, &row.color, &row.fit, &row.season, &row.pattern, &row.status, &row.imageURL, &row.description, &row.lastWorn, &row.createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return row.toClothingItem()
}

func (r *WardrobeRepository) Save(ctx context.Context, item *wardrobe.ClothingItem) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO wardrobe_items (id, user_id, name, category, sub_type, color, fit, season, pattern, status, image_url, description, last_worn, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		 ON CONFLICT (id) DO UPDATE SET
		   name        = EXCLUDED.name,
		   category    = EXCLUDED.category,
		   sub_type    = EXCLUDED.sub_type,
		   color       = EXCLUDED.color,
		   fit         = EXCLUDED.fit,
		   season      = EXCLUDED.season,
		   pattern     = EXCLUDED.pattern,
		   status      = EXCLUDED.status,
		   image_url   = EXCLUDED.image_url,
		   description = EXCLUDED.description,
		   last_worn   = EXCLUDED.last_worn`,
		item.ID, item.UserID, item.Name,
		item.Category.String(), item.SubType.String(), item.Color.String(),
		item.Fit.String(), item.Season.String(), item.Pattern.String(), item.Status.String(),
		item.ImageURL, item.Description, item.LastWorn, item.CreatedAt,
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

func (r *WardrobeRepository) UpdateStatus(ctx context.Context, id string, status wardrobe.Status) error {
	_, err := r.db.Exec(ctx,
		`UPDATE wardrobe_items SET status = $1 WHERE id = $2 AND deleted_at IS NULL`,
		status.String(), id,
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
		`UPDATE wardrobe_items SET last_worn = $1, status = 'worn' WHERE user_id = $2 AND id::text = ANY($3) AND deleted_at IS NULL`,
		wornAt, userID, itemIDs,
	)
	return err
}
