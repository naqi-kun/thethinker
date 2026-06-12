package postgres

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
)

var _ recommendation.OutfitHistoryRepository = (*OutfitHistoryRepository)(nil)

type OutfitHistoryRepository struct {
	db *pgxpool.Pool
}

func NewOutfitHistoryRepository(db *pgxpool.Pool) *OutfitHistoryRepository {
	return &OutfitHistoryRepository{db: db}
}

func (r *OutfitHistoryRepository) Save(ctx context.Context, outfit *recommendation.AcceptedOutfit) error {
	q := queryFromContext(ctx, r.db)

	var wsJSON []byte
	if outfit.WeatherSnapshot != nil {
		var err error
		wsJSON, err = json.Marshal(outfit.WeatherSnapshot)
		if err != nil {
			return err
		}
	}

	var historyID string
	err := q.QueryRow(ctx,
		`INSERT INTO outfit_history (user_id, session_id, occasion, worn_on, time_of_day, weather_snapshot, created_at)
		 VALUES ($1, NULLIF($2,''), NULLIF($3,''), $4, $5, $6, $7)
		 RETURNING id`,
		outfit.UserID,
		outfit.SessionID,
		outfit.Occasion,
		outfit.WornOn.UTC().Truncate(24*time.Hour),
		string(outfit.TimeOfDay),
		wsJSON,
		outfit.CreatedAt,
	).Scan(&historyID)
	if err != nil {
		return err
	}

	outfit.ID = historyID

	for _, item := range outfit.Items {
		_, err := q.Exec(ctx,
			`INSERT INTO outfit_history_items
			 (outfit_history_id, item_id, image_url, category, sub_type, color, fit, season)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 ON CONFLICT DO NOTHING`,
			historyID, item.ItemID, item.ImageURL,
			item.Category, item.SubType, item.Color, item.Fit, item.Season,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *OutfitHistoryRepository) List(
	ctx context.Context,
	userID string,
	cursor string,
	limit int,
	filter recommendation.HistoryFilter,
) ([]*recommendation.AcceptedOutfit, string, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	args := []any{userID}
	where := `WHERE h.user_id = $1`

	// The cursor encodes "worn_on|id" so pagination follows the
	// (worn_on DESC, id DESC) sort; ids are random UUIDs and carry no
	// chronological meaning on their own.
	if cursor != "" {
		wornOn, id, ok := strings.Cut(cursor, "|")
		if !ok {
			return nil, "", recommendation.ErrInvalidCursor
		}
		if _, err := time.Parse("2006-01-02", wornOn); err != nil {
			return nil, "", recommendation.ErrInvalidCursor
		}
		if _, err := uuid.Parse(id); err != nil {
			return nil, "", recommendation.ErrInvalidCursor
		}
		args = append(args, wornOn)
		where += ` AND (h.worn_on, h.id) < ($` + itoa(len(args)) + `::date`
		args = append(args, id)
		where += `, $` + itoa(len(args)) + `::uuid)`
	}

	switch filter.Range {
	case "week":
		args = append(args, 7)
		where += ` AND h.worn_on >= CURRENT_DATE - INTERVAL '1 day' * $` + itoa(len(args))
	case "month":
		args = append(args, 30)
		where += ` AND h.worn_on >= CURRENT_DATE - INTERVAL '1 day' * $` + itoa(len(args))
	case "season":
		args = append(args, currentSeasonStart())
		where += ` AND h.worn_on >= $` + itoa(len(args))
	}

	if filter.TimeOfDay != "" {
		args = append(args, filter.TimeOfDay)
		where += ` AND h.time_of_day = $` + itoa(len(args))
	}

	args = append(args, limit+1)
	limitClause := `LIMIT $` + itoa(len(args))

	historySQL := `
		SELECT h.id, h.session_id, h.occasion, h.worn_on, h.time_of_day, h.weather_snapshot, h.created_at
		FROM outfit_history h
		` + where + `
		ORDER BY h.worn_on DESC, h.id DESC
		` + limitClause

	rows, err := r.db.Query(ctx, historySQL, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	type row struct {
		id        string
		sessionID *string
		occasion  *string
		wornOn    time.Time
		tod       string
		wsJSON    []byte
		createdAt time.Time
	}
	var rawRows []row
	for rows.Next() {
		var rv row
		if err := rows.Scan(&rv.id, &rv.sessionID, &rv.occasion, &rv.wornOn, &rv.tod, &rv.wsJSON, &rv.createdAt); err != nil {
			return nil, "", err
		}
		rawRows = append(rawRows, rv)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}

	var nextCursor string
	if len(rawRows) > limit {
		last := rawRows[limit-1]
		nextCursor = last.wornOn.Format("2006-01-02") + "|" + last.id
		rawRows = rawRows[:limit]
	}

	if len(rawRows) == 0 {
		return nil, "", nil
	}

	ids := make([]string, len(rawRows))
	for i, rv := range rawRows {
		ids[i] = rv.id
	}

	itemRows, err := r.db.Query(ctx,
		`SELECT outfit_history_id, item_id, image_url, category, sub_type, color, fit, season
		 FROM outfit_history_items WHERE outfit_history_id = ANY($1)`,
		ids,
	)
	if err != nil {
		return nil, "", err
	}
	defer itemRows.Close()

	itemsByOutfit := make(map[string][]*recommendation.AcceptedOutfitItem)
	for itemRows.Next() {
		var outfitID, itemID, imageURL, category, subType, color, fit, season string
		if err := itemRows.Scan(&outfitID, &itemID, &imageURL, &category, &subType, &color, &fit, &season); err != nil {
			return nil, "", err
		}
		itemsByOutfit[outfitID] = append(itemsByOutfit[outfitID], &recommendation.AcceptedOutfitItem{
			ItemID:   itemID,
			ImageURL: imageURL,
			Category: category,
			SubType:  subType,
			Color:    color,
			Fit:      fit,
			Season:   season,
		})
	}
	if err := itemRows.Err(); err != nil {
		return nil, "", err
	}

	outfits := make([]*recommendation.AcceptedOutfit, 0, len(rawRows))
	for _, rv := range rawRows {
		o := &recommendation.AcceptedOutfit{
			ID:        rv.id,
			UserID:    userID,
			WornOn:    rv.wornOn,
			TimeOfDay: recommendation.TimeOfDay(rv.tod),
			CreatedAt: rv.createdAt,
			Items:     itemsByOutfit[rv.id],
		}
		if rv.sessionID != nil {
			o.SessionID = *rv.sessionID
		}
		if rv.occasion != nil {
			o.Occasion = *rv.occasion
		}
		if len(rv.wsJSON) > 0 {
			var ws recommendation.WeatherSnapshot
			if err := json.Unmarshal(rv.wsJSON, &ws); err == nil {
				o.WeatherSnapshot = &ws
			}
		}
		outfits = append(outfits, o)
	}

	return outfits, nextCursor, nil
}

func itoa(n int) string {
	buf := make([]byte, 0, 3)
	if n == 0 {
		return "0"
	}
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}

func currentSeasonStart() time.Time {
	now := time.Now().UTC()
	month := now.Month()
	var startMonth time.Month
	switch {
	case month >= time.March && month <= time.May:
		startMonth = time.March
	case month >= time.June && month <= time.August:
		startMonth = time.June
	case month >= time.September && month <= time.November:
		startMonth = time.September
	default:
		startMonth = time.December
		if month < time.March {
			return time.Date(now.Year()-1, startMonth, 1, 0, 0, 0, 0, time.UTC)
		}
	}
	return time.Date(now.Year(), startMonth, 1, 0, 0, 0, 0, time.UTC)
}
