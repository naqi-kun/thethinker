# KAN-55 Outfit History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Outfit History feature — persistent storage of accepted outfits, a `GET /recommendations/history` endpoint with cursor pagination + date/time filters, and a React history page matching the Pencil design.

**Architecture:** Domain `AcceptedOutfit` aggregate + `OutfitHistoryRepository` interface live in `backend/internal/domain/recommendation/`; a context-based transaction helper in `postgres/tx.go` lets `WardrobeRepository.MarkWorn` and `OutfitHistoryRepository.Save` share a single DB transaction; the recommendation service gains `AcceptAndRecord` which atomically marks items worn and records history; the frontend adds a `features/history/` vertical slice using extracted `FlatLay` + `MetadataCard` shared components.

**Tech Stack:** Go 1.25, pgx/v5, golang-migrate, openapi-typescript, React + TypeScript, Tailwind v4, openapi-fetch

---

## File Map

| Action   | Path |
|----------|------|
| Modify   | `api/openapi.yaml` |
| Create   | `backend/internal/infrastructure/persistence/postgres/migrations/000006_outfit_history.up.sql` |
| Create   | `backend/internal/infrastructure/persistence/postgres/migrations/000006_outfit_history.down.sql` |
| Create   | `backend/internal/domain/recommendation/history.go` |
| Modify   | `backend/internal/domain/recommendation/errors.go` |
| Modify   | `backend/internal/domain/recommendation/service.go` |
| Create   | `backend/internal/infrastructure/persistence/postgres/tx.go` |
| Modify   | `backend/internal/infrastructure/persistence/postgres/wardrobe_repository.go` |
| Create   | `backend/internal/infrastructure/persistence/postgres/outfit_history_repository.go` |
| Modify   | `backend/internal/interfaces/http/handlers/recommendation_handler.go` |
| Create   | `backend/internal/interfaces/http/handlers/history_handler.go` |
| Modify   | `backend/cmd/api/main.go` |
| Create   | `frontend/src/shared/components/FlatLay.tsx` |
| Create   | `frontend/src/shared/components/MetadataCard.tsx` |
| Modify   | `frontend/src/features/outfit/components/OutfitPage.tsx` |
| Create   | `frontend/src/features/history/api.ts` |
| Create   | `frontend/src/features/history/components/HistoryPage.tsx` |
| Create   | `frontend/src/features/history/index.ts` |
| Modify   | `frontend/src/shared/components/TopNav.tsx` |
| Modify   | `frontend/src/app/App.tsx` |
| Modify   | `frontend/src/shared/api/types.ts` |

---

## Task 1: OpenAPI spec — add GET /recommendations/history

**Files:**
- Modify: `api/openapi.yaml`

- [ ] **Step 1: Add the endpoint after the existing accept route**

In `api/openapi.yaml`, after the `/recommendations/outfit/accept` block (around line 556), insert:

```yaml
  /recommendations/history:
    get:
      tags: [recommendations]
      summary: List accepted outfits, grouped by date (newest first)
      security:
        - bearerAuth: []
      parameters:
        - name: cursor
          in: query
          description: Opaque cursor returned by the previous page
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 50
        - name: range
          in: query
          schema:
            type: string
            enum: [week, month, season, all]
            default: week
        - name: time_of_day
          in: query
          schema:
            type: string
            enum: [morning, afternoon, evening]
      responses:
        '200':
          description: Paginated outfit history
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OutfitHistoryResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
```

- [ ] **Step 2: Add schemas before the existing `WeatherSnapshot` schema**

In `api/openapi.yaml` components/schemas section, add before `WeatherSnapshot:`:

```yaml
    OutfitHistoryResponse:
      type: object
      required: [entries]
      properties:
        entries:
          type: array
          items:
            $ref: '#/components/schemas/HistoryEntry'
        next_cursor:
          type: string
          nullable: true

    HistoryEntry:
      type: object
      required: [worn_on, outfits]
      properties:
        worn_on:
          type: string
          format: date
          example: '2026-06-11'
        outfits:
          type: array
          items:
            $ref: '#/components/schemas/AcceptedOutfit'

    AcceptedOutfit:
      type: object
      required: [id, worn_on, time_of_day, items]
      properties:
        id:
          type: string
        worn_on:
          type: string
          format: date
        occasion:
          type: string
        time_of_day:
          type: string
          enum: [morning, afternoon, evening]
        weather:
          $ref: '#/components/schemas/WeatherSnapshot'
        items:
          type: array
          items:
            $ref: '#/components/schemas/OutfitHistoryItem'

    OutfitHistoryItem:
      type: object
      required: [item_id, category, sub_type, color]
      properties:
        item_id:
          type: string
        image_url:
          type: string
        category:
          type: string
        sub_type:
          type: string
        color:
          type: string
        fit:
          type: string
        season:
          type: string
```

- [ ] **Step 3: Validate the spec**

```bash
cd /path/to/repo
npx @redocly/cli lint api/openapi.yaml
```

Expected: no errors.

- [ ] **Step 4: Regenerate the frontend types**

```bash
cd frontend
nvm use
npm run gen:api
```

Expected: `src/shared/api/schema.d.ts` updated with `OutfitHistoryResponse`, `HistoryEntry`, `AcceptedOutfit`, `OutfitHistoryItem`.

- [ ] **Step 5: Commit**

```bash
git add api/openapi.yaml frontend/src/shared/api/schema.d.ts
git commit -m "feat(api): add GET /recommendations/history endpoint and schemas"
```

---

## Task 2: Database migration 000006

**Files:**
- Create: `backend/internal/infrastructure/persistence/postgres/migrations/000006_outfit_history.up.sql`
- Create: `backend/internal/infrastructure/persistence/postgres/migrations/000006_outfit_history.down.sql`

- [ ] **Step 1: Write the up migration**

`backend/internal/infrastructure/persistence/postgres/migrations/000006_outfit_history.up.sql`:

```sql
ALTER TABLE wardrobe_items
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE TYPE time_of_day AS ENUM ('morning', 'afternoon', 'evening');

CREATE TABLE outfit_history (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id       TEXT,
    occasion         TEXT,
    worn_on          DATE        NOT NULL,
    time_of_day      time_of_day NOT NULL,
    weather_snapshot JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outfit_history_user_id_id ON outfit_history (user_id, id DESC);

CREATE TABLE outfit_history_items (
    outfit_history_id UUID NOT NULL REFERENCES outfit_history(id) ON DELETE CASCADE,
    item_id           UUID NOT NULL REFERENCES wardrobe_items(id),
    image_url         TEXT NOT NULL DEFAULT '',
    category          TEXT NOT NULL,
    sub_type          TEXT NOT NULL,
    color             TEXT NOT NULL,
    fit               TEXT NOT NULL DEFAULT '',
    season            TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (outfit_history_id, item_id)
);
```

- [ ] **Step 2: Write the down migration**

`backend/internal/infrastructure/persistence/postgres/migrations/000006_outfit_history.down.sql`:

```sql
DROP TABLE IF EXISTS outfit_history_items;
DROP TABLE IF EXISTS outfit_history;
DROP TYPE IF EXISTS time_of_day;
ALTER TABLE wardrobe_items DROP COLUMN IF EXISTS deleted_at;
```

- [ ] **Step 3: Verify the migration files are picked up**

```bash
cd backend
ls internal/infrastructure/persistence/postgres/migrations/ | sort
```

Expected: `000006_outfit_history.up.sql` and `000006_outfit_history.down.sql` appear in order after `000005`.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/infrastructure/persistence/postgres/migrations/
git commit -m "feat(db): add outfit_history tables and soft-delete column on wardrobe_items"
```

---

## Task 3: Domain layer — history entities, repository interface, Transactor

**Files:**
- Create: `backend/internal/domain/recommendation/history.go`
- Modify: `backend/internal/domain/recommendation/errors.go`

- [ ] **Step 1: Create `history.go`**

`backend/internal/domain/recommendation/history.go`:

```go
package recommendation

import (
	"context"
	"time"
)

type TimeOfDay string

const (
	TimeOfDayMorning   TimeOfDay = "morning"
	TimeOfDayAfternoon TimeOfDay = "afternoon"
	TimeOfDayEvening   TimeOfDay = "evening"
)

func DeriveTimeOfDay(t time.Time) TimeOfDay {
	h := t.UTC().Hour()
	switch {
	case h < 12:
		return TimeOfDayMorning
	case h < 17:
		return TimeOfDayAfternoon
	default:
		return TimeOfDayEvening
	}
}

type WeatherSnapshot struct {
	Temperature float64 `json:"temperature"`
	FeelsLike   float64 `json:"feels_like"`
	Description string  `json:"description"`
}

type AcceptedOutfitItem struct {
	ItemID   string
	ImageURL string
	Category string
	SubType  string
	Color    string
	Fit      string
	Season   string
}

type AcceptedOutfit struct {
	ID              string
	UserID          string
	SessionID       string
	Occasion        string
	WornOn          time.Time
	TimeOfDay       TimeOfDay
	WeatherSnapshot *WeatherSnapshot
	Items           []*AcceptedOutfitItem
	CreatedAt       time.Time
}

type HistoryFilter struct {
	Range     string // week | month | season | all — empty means "all"
	TimeOfDay string // morning | afternoon | evening — empty means all
}

type Transactor interface {
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type OutfitHistoryRepository interface {
	Save(ctx context.Context, outfit *AcceptedOutfit) error
	List(ctx context.Context, userID string, cursor string, limit int, filter HistoryFilter) ([]*AcceptedOutfit, string, error)
}
```

- [ ] **Step 2: Add `ErrHistoryEmpty` to errors.go**

In `backend/internal/domain/recommendation/errors.go`, add one line:

```go
var (
	ErrEmptyWardrobe   = errors.New("no clothing items in wardrobe")
	ErrSessionNotFound = errors.New("recommendation session not found or expired")
	ErrHistoryEmpty    = errors.New("no outfit history found")
)
```

- [ ] **Step 3: Build to verify compilation**

```bash
cd backend && go build ./internal/domain/recommendation/...
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/domain/recommendation/history.go backend/internal/domain/recommendation/errors.go
git commit -m "feat(domain): add AcceptedOutfit aggregate, OutfitHistoryRepository interface, Transactor"
```

---

## Task 4: Postgres transaction helper

**Files:**
- Create: `backend/internal/infrastructure/persistence/postgres/tx.go`

- [ ] **Step 1: Create `tx.go`**

`backend/internal/infrastructure/persistence/postgres/tx.go`:

```go
package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
)

var _ recommendation.Transactor = (*Transactor)(nil)

type txKeyType struct{}

var txKey = txKeyType{}

type dbQuerier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func queryFromContext(ctx context.Context, pool *pgxpool.Pool) dbQuerier {
	if tx, ok := ctx.Value(txKey).(pgx.Tx); ok {
		return tx
	}
	return pool
}

type Transactor struct {
	db *pgxpool.Pool
}

func NewTransactor(db *pgxpool.Pool) *Transactor {
	return &Transactor{db: db}
}

func (t *Transactor) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	tx, err := t.db.Begin(ctx)
	if err != nil {
		return err
	}
	txCtx := context.WithValue(ctx, txKey, tx)
	if err := fn(txCtx); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	return tx.Commit(ctx)
}
```

- [ ] **Step 2: Build to verify**

```bash
cd backend && go build ./internal/infrastructure/persistence/postgres/...
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/infrastructure/persistence/postgres/tx.go
git commit -m "feat(infra): add context-based transaction helper for pgx"
```

---

## Task 5: Update wardrobe repository — soft delete + tx-aware queries

**Files:**
- Modify: `backend/internal/infrastructure/persistence/postgres/wardrobe_repository.go`

- [ ] **Step 1: Make `FindByUserID` filter soft-deleted items and use tx from context**

Replace the `FindByUserID` method body:

```go
func (r *WardrobeRepository) FindByUserID(ctx context.Context, userID string) ([]*wardrobe.ClothingItem, error) {
	rows, err := queryFromContext(ctx, r.db).Query(ctx,
		`SELECT id, user_id, category, sub_type, color, fit, season, image_url, last_worn, created_at
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
			id, uid, category, subType, color, fit, season, imageURL string
			lastWorn                                                  *time.Time
			createdAt                                                 time.Time
		)
		if err := rows.Scan(&id, &uid, &category, &subType, &color, &fit, &season, &imageURL, &lastWorn, &createdAt); err != nil {
			return nil, err
		}
		item, err := scanRow(&id, &uid, &category, &subType, &color, &fit, &season, &imageURL, lastWorn, &createdAt)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
```

- [ ] **Step 2: Make `FindByID` filter soft-deleted items and use tx from context**

Replace `FindByID`:

```go
func (r *WardrobeRepository) FindByID(ctx context.Context, id string) (*wardrobe.ClothingItem, error) {
	var (
		rid, uid, category, subType, color, fit, season, imageURL string
		lastWorn                                                   *time.Time
		createdAt                                                  time.Time
	)
	err := queryFromContext(ctx, r.db).QueryRow(ctx,
		`SELECT id, user_id, category, sub_type, color, fit, season, image_url, last_worn, created_at
		 FROM wardrobe_items WHERE id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&rid, &uid, &category, &subType, &color, &fit, &season, &imageURL, &lastWorn, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return scanRow(&rid, &uid, &category, &subType, &color, &fit, &season, &imageURL, lastWorn, &createdAt)
}
```

- [ ] **Step 3: Change `Delete` to soft delete**

Replace `Delete`:

```go
func (r *WardrobeRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE wardrobe_items SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	return err
}
```

- [ ] **Step 4: Make `MarkWorn` use tx from context**

Replace `MarkWorn`:

```go
func (r *WardrobeRepository) MarkWorn(ctx context.Context, userID string, itemIDs []string, wornAt time.Time) error {
	_, err := queryFromContext(ctx, r.db).Exec(ctx,
		`UPDATE wardrobe_items SET last_worn = $1 WHERE user_id = $2 AND id::text = ANY($3) AND deleted_at IS NULL`,
		wornAt, userID, itemIDs,
	)
	return err
}
```

- [ ] **Step 5: Build to verify**

```bash
cd backend && go build ./internal/infrastructure/persistence/postgres/...
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/infrastructure/persistence/postgres/wardrobe_repository.go
git commit -m "feat(infra): soft-delete wardrobe items, filter deleted_at IS NULL, tx-aware queries"
```

---

## Task 6: Outfit history postgres repository

**Files:**
- Create: `backend/internal/infrastructure/persistence/postgres/outfit_history_repository.go`

- [ ] **Step 1: Create the repository**

`backend/internal/infrastructure/persistence/postgres/outfit_history_repository.go`:

```go
package postgres

import (
	"context"
	"encoding/json"
	"time"

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

	// Build WHERE clauses
	args := []any{userID}
	where := `WHERE h.user_id = $1`

	// cursor
	if cursor != "" {
		args = append(args, cursor)
		where += ` AND h.id < $` + itoa(len(args))
	}

	// range filter
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

	// time_of_day filter
	if filter.TimeOfDay != "" {
		args = append(args, filter.TimeOfDay)
		where += ` AND h.time_of_day = $` + itoa(len(args))
	}

	args = append(args, limit+1) // fetch one extra to detect next page
	limitClause := `LIMIT $` + itoa(len(args))

	historySQL := `
		SELECT h.id, h.session_id, h.occasion, h.worn_on, h.time_of_day, h.weather_snapshot, h.created_at
		FROM outfit_history h
		` + where + `
		ORDER BY h.id DESC
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
		nextCursor = rawRows[limit-1].id
		rawRows = rawRows[:limit]
	}

	if len(rawRows) == 0 {
		return nil, "", nil
	}

	// Collect IDs to load items
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
```

- [ ] **Step 2: Build to verify**

```bash
cd backend && go build ./internal/infrastructure/persistence/postgres/...
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/infrastructure/persistence/postgres/outfit_history_repository.go
git commit -m "feat(infra): implement OutfitHistoryRepository with cursor pagination and range filters"
```

---

## Task 7: Update recommendation service — add AcceptAndRecord

**Files:**
- Modify: `backend/internal/domain/recommendation/service.go`

- [ ] **Step 1: Add `historyRepo` and `transactor` fields to `Service`**

In `service.go`, replace the `Service` struct and `NewService`:

```go
type Service struct {
	wardrobeRepo  wardrobe.Repository
	calendarRepo  calendar.Repository
	weatherSvc    *weather.Service
	aiRecommender AIRecommender
	historyRepo   OutfitHistoryRepository
	transactor    Transactor
}

func NewService(
	wardrobeRepo wardrobe.Repository,
	calendarRepo calendar.Repository,
	weatherSvc *weather.Service,
	aiRecommender AIRecommender,
	historyRepo OutfitHistoryRepository,
	transactor Transactor,
) *Service {
	return &Service{
		wardrobeRepo:  wardrobeRepo,
		calendarRepo:  calendarRepo,
		weatherSvc:    weatherSvc,
		aiRecommender: aiRecommender,
		historyRepo:   historyRepo,
		transactor:    transactor,
	}
}
```

- [ ] **Step 2: Add `AcceptAndRecord` method at the end of `service.go`**

```go
// AcceptAndRecord atomically marks the given items as worn and records an
// AcceptedOutfit in outfit_history. It replaces the separate MarkItemsWorn +
// AcceptSession calls on the accept path.
func (s *Service) AcceptAndRecord(ctx context.Context, userID, sessionID string, itemIDs []string) error {
	now := time.Now().UTC()

	// Snapshot each item's current state before the transaction.
	var historyItems []*AcceptedOutfitItem
	for _, id := range itemIDs {
		item, err := s.wardrobeRepo.FindByID(ctx, id)
		if err != nil || item == nil {
			continue // soft-deleted or missing — skip defensively
		}
		historyItems = append(historyItems, &AcceptedOutfitItem{
			ItemID:   item.ID,
			ImageURL: item.ImageURL,
			Category: item.Category.String(),
			SubType:  item.SubType.String(),
			Color:    item.Color.String(),
			Fit:      item.Fit.String(),
			Season:   item.Season.String(),
		})
	}

	var ws *WeatherSnapshot
	if cond, err := s.weatherSvc.GetConditions(ctx, ""); err == nil {
		ws = &WeatherSnapshot{
			Temperature: float64(cond.Temperature),
			FeelsLike:   float64(cond.FeelsLike),
			Description: cond.Description,
		}
	}

	outfit := &AcceptedOutfit{
		UserID:          userID,
		SessionID:       sessionID,
		WornOn:          now.Truncate(24 * time.Hour),
		TimeOfDay:       DeriveTimeOfDay(now),
		WeatherSnapshot: ws,
		Items:           historyItems,
		CreatedAt:       now,
	}

	if err := s.transactor.InTransaction(ctx, func(ctx context.Context) error {
		if err := s.wardrobeRepo.MarkWorn(ctx, userID, itemIDs, now); err != nil {
			return err
		}
		return s.historyRepo.Save(ctx, outfit)
	}); err != nil {
		return err
	}

	// Signal AI — non-fatal; session may have already expired.
	if sessionID != "" {
		_ = s.aiRecommender.Accept(ctx, sessionID)
	}

	return nil
}
```

- [ ] **Step 3: Build the domain package**

```bash
cd backend && go build ./internal/domain/recommendation/...
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/domain/recommendation/service.go
git commit -m "feat(domain): add AcceptAndRecord — atomic mark-worn + history insert in one transaction"
```

---

## Task 8: Update recommendation handler, add history handler, wire main.go

**Files:**
- Modify: `backend/internal/interfaces/http/handlers/recommendation_handler.go`
- Create: `backend/internal/interfaces/http/handlers/history_handler.go`
- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Update the `recommendationSvc` interface in the handler**

In `recommendation_handler.go`, replace the `recommendationSvc` interface and `wardrobeAccepter` interface, and remove the now-redundant `wardrobeSvc` field:

```go
type recommendationSvc interface {
	GetOutfit(ctx context.Context, userID string, date time.Time, sessionID string) (*recommendation.OutfitRecommendation, error)
	AcceptAndRecord(ctx context.Context, userID, sessionID string, itemIDs []string) error
}

type RecommendationHandler struct {
	svc recommendationSvc
}

func NewRecommendationHandler(svc recommendationSvc) *RecommendationHandler {
	return &RecommendationHandler{svc: svc}
}
```

- [ ] **Step 2: Replace the `AcceptOutfit` handler body**

```go
func (h *RecommendationHandler) AcceptOutfit(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	var req acceptOutfitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.ItemIDs) == 0 {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "item_ids is required")
		return
	}

	if err := h.svc.AcceptAndRecord(r.Context(), userID, req.SessionID, req.ItemIDs); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to accept outfit")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 3: Create `history_handler.go`**

`backend/internal/interfaces/http/handlers/history_handler.go`:

```go
package handlers

import (
	"context"
	"net/http"
	"strconv"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type historyRepo interface {
	List(ctx context.Context, userID string, cursor string, limit int, filter recommendation.HistoryFilter) ([]*recommendation.AcceptedOutfit, string, error)
}

type HistoryHandler struct {
	repo historyRepo
}

func NewHistoryHandler(repo historyRepo) *HistoryHandler {
	return &HistoryHandler{repo: repo}
}

type historyItemResponse struct {
	ItemID   string `json:"item_id"`
	ImageURL string `json:"image_url,omitempty"`
	Category string `json:"category"`
	SubType  string `json:"sub_type"`
	Color    string `json:"color"`
	Fit      string `json:"fit,omitempty"`
	Season   string `json:"season,omitempty"`
}

type weatherResponse struct {
	Temperature float64 `json:"temperature"`
	FeelsLike   float64 `json:"feels_like"`
	Description string  `json:"description"`
}

type acceptedOutfitResponse struct {
	ID        string               `json:"id"`
	WornOn    string               `json:"worn_on"`
	Occasion  string               `json:"occasion,omitempty"`
	TimeOfDay string               `json:"time_of_day"`
	Weather   *weatherResponse     `json:"weather,omitempty"`
	Items     []historyItemResponse `json:"items"`
}

type historyEntryResponse struct {
	WornOn  string                   `json:"worn_on"`
	Outfits []acceptedOutfitResponse `json:"outfits"`
}

type outfitHistoryResponse struct {
	Entries    []historyEntryResponse `json:"entries"`
	NextCursor *string                `json:"next_cursor"`
}

func (h *HistoryHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	cursor := r.URL.Query().Get("cursor")
	rangeVal := r.URL.Query().Get("range")
	if rangeVal == "" {
		rangeVal = "week"
	}
	todVal := r.URL.Query().Get("time_of_day")

	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}

	outfits, nextCursor, err := h.repo.List(r.Context(), userID, cursor, limit, recommendation.HistoryFilter{
		Range:     rangeVal,
		TimeOfDay: todVal,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list history")
		return
	}

	// Group by worn_on date
	type group struct {
		date    string
		outfits []acceptedOutfitResponse
	}
	var groups []group
	dateIndex := map[string]int{}

	for _, o := range outfits {
		date := o.WornOn.UTC().Format("2006-01-02")

		items := make([]historyItemResponse, len(o.Items))
		for i, it := range o.Items {
			items[i] = historyItemResponse{
				ItemID:   it.ItemID,
				ImageURL: it.ImageURL,
				Category: it.Category,
				SubType:  it.SubType,
				Color:    it.Color,
				Fit:      it.Fit,
				Season:   it.Season,
			}
		}

		ao := acceptedOutfitResponse{
			ID:        o.ID,
			WornOn:    date,
			Occasion:  o.Occasion,
			TimeOfDay: string(o.TimeOfDay),
			Items:     items,
		}
		if o.WeatherSnapshot != nil {
			ao.Weather = &weatherResponse{
				Temperature: o.WeatherSnapshot.Temperature,
				FeelsLike:   o.WeatherSnapshot.FeelsLike,
				Description: o.WeatherSnapshot.Description,
			}
		}

		if idx, ok := dateIndex[date]; ok {
			groups[idx].outfits = append(groups[idx].outfits, ao)
		} else {
			dateIndex[date] = len(groups)
			groups = append(groups, group{date: date, outfits: []acceptedOutfitResponse{ao}})
		}
	}

	entries := make([]historyEntryResponse, len(groups))
	for i, g := range groups {
		entries[i] = historyEntryResponse{WornOn: g.date, Outfits: g.outfits}
	}

	resp := outfitHistoryResponse{Entries: entries}
	if nextCursor != "" {
		resp.NextCursor = &nextCursor
	}

	writeJSON(w, http.StatusOK, resp)
}
```

- [ ] **Step 4: Update `main.go`**

In `main.go`:
1. Add `historyRepo := postgres.NewOutfitHistoryRepository(db)` after `workScheduleRepo`
2. Add `transactor := postgres.NewTransactor(db)` on the next line
3. Update `recommendSvc` construction:

```go
historyRepo := postgres.NewOutfitHistoryRepository(db)
transactor := postgres.NewTransactor(db)

// services
recommendSvc := recommendation.NewService(wardrobeRepo, calendarRepo, weatherSvc, aiRecommendClient, historyRepo, transactor)
```

4. Update handler construction (remove `wardrobeSvc`):

```go
recommendHandler := handlers.NewRecommendationHandler(recommendSvc)
historyHandler := handlers.NewHistoryHandler(historyRepo)
```

5. Add the history route after the existing recommend routes:

```go
mux.Handle("GET /recommendations/history", auth(http.HandlerFunc(historyHandler.List)))
```

- [ ] **Step 5: Build everything**

```bash
cd backend && go build ./...
```

Expected: no errors.

- [ ] **Step 6: Run existing tests to check no regressions**

```bash
cd backend && go test ./...
```

Expected: all tests pass (the handler tests for `AcceptOutfit` will need updating — see Task 9).

- [ ] **Step 7: Commit**

```bash
git add backend/internal/interfaces/http/handlers/recommendation_handler.go \
        backend/internal/interfaces/http/handlers/history_handler.go \
        backend/cmd/api/main.go
git commit -m "feat(api): wire AcceptAndRecord into accept handler, add GET /recommendations/history"
```

---

## Task 9: Fix recommendation handler tests

**Files:**
- Modify: `backend/internal/interfaces/http/handlers/recommendation_handler_test.go`

- [ ] **Step 1: Read the existing test file**

```bash
cat backend/internal/interfaces/http/handlers/recommendation_handler_test.go
```

- [ ] **Step 2: Update the mock to match the new interface**

The `wardrobeAccepter` mock is no longer needed. Replace it with a mock that implements `AcceptAndRecord`:

In the test file, find the `mockWardrobeAccepter` and the `mockRecommendationSvc`, then:
- Remove `mockWardrobeAccepter` entirely
- Add `AcceptAndRecord` to the recommendation service mock:

```go
func (m *mockRecommendationSvc) AcceptAndRecord(_ context.Context, _, _ string, _ []string) error {
    return m.acceptErr
}
```

- Remove the `acceptErr` field if it lives on `mockWardrobeAccepter` and move it to `mockRecommendationSvc`
- Update all calls to `NewRecommendationHandler(svc, wardrobeMock)` to `NewRecommendationHandler(svc)`

- [ ] **Step 3: Run the handler tests**

```bash
cd backend && go test ./internal/interfaces/http/handlers/... -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/interfaces/http/handlers/recommendation_handler_test.go
git commit -m "fix(test): update recommendation handler tests for AcceptAndRecord interface"
```

---

## Task 10: Extract FlatLay and MetadataCard shared components

**Files:**
- Create: `frontend/src/shared/components/FlatLay.tsx`
- Create: `frontend/src/shared/components/MetadataCard.tsx`
- Modify: `frontend/src/features/outfit/components/OutfitPage.tsx`

- [ ] **Step 1: Create `FlatLay.tsx`**

`frontend/src/shared/components/FlatLay.tsx`:

```tsx
import type { ClothingItem } from '../api/types';

const FLAT_LAY_SLOTS = [
  { top: '4%', left: '4%', rotate: -8 },
  { top: '6%', left: '53%', rotate: 6 },
  { top: '44%', left: '22%', rotate: -5 },
  { top: '40%', left: '56%', rotate: 9 },
  { top: '66%', left: '5%', rotate: 4 },
  { top: '63%', left: '51%', rotate: -7 },
  { top: '22%', left: '29%', rotate: -3 },
  { top: '76%', left: '30%', rotate: 5 },
];

interface FlatLayProps {
  items: ClothingItem[];
  selectedItemId?: string | null;
  onSelectItem?: (item: ClothingItem | null) => void;
  compact?: boolean;
}

export default function FlatLay({ items, selectedItemId, onSelectItem, compact = false }: FlatLayProps) {
  const hasSelection = selectedItemId != null;

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="h-20 w-16 shrink-0 overflow-hidden rounded-xl"
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.sub_type}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-linen/60">
                <p className="text-xs capitalize text-muted-foreground">{item.sub_type}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-cream"
      style={{ aspectRatio: '3/4' }}
      onClick={() => onSelectItem?.(null)}
    >
      {items.map((item, i) => {
        const slot = FLAT_LAY_SLOTS[i % FLAT_LAY_SLOTS.length];
        const isSelected = selectedItemId === item.id;
        return (
          <button
            key={item.id}
            className="absolute overflow-hidden rounded-xl transition-all duration-200"
            style={{
              top: slot.top,
              left: slot.left,
              width: '42%',
              transform: `rotate(${slot.rotate}deg)`,
              opacity: hasSelection && !isSelected ? 0.35 : 1,
              outline: isSelected ? '2.5px solid #c1714a' : 'none',
              outlineOffset: '2px',
              zIndex: isSelected ? 10 : i + 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectItem?.(isSelected ? null : item);
            }}
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.sub_type}
                className="h-36 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-36 w-full flex-col items-center justify-center gap-1 bg-linen/60">
                <p className="text-xs font-medium capitalize text-espresso">{item.sub_type}</p>
                <p className="text-xs capitalize text-muted-foreground">{item.color}</p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `MetadataCard.tsx`**

`frontend/src/shared/components/MetadataCard.tsx`:

```tsx
import { X } from 'lucide-react';
import type { ClothingItem } from '../api/types';

interface MetadataCardProps {
  item: ClothingItem;
  onClose?: () => void;
  onSwap?: () => void;
}

export default function MetadataCard({ item, onClose, onSwap }: MetadataCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-cream p-4 shadow-sm">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.sub_type}
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linen/80">
          <span className="text-xs capitalize text-muted-foreground">{item.sub_type[0]}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 font-medium capitalize text-espresso">{item.sub_type}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">{item.color}</span>
          <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">{item.category}</span>
          {item.season && item.season !== 'all' && (
            <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
              {item.season.replace(/_/g, ' ')}
            </span>
          )}
          {item.fit && (
            <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">{item.fit}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        {onSwap && (
          <button
            onClick={onSwap}
            className="rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-cream"
          >
            Swap
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `OutfitPage.tsx` to use the shared components**

In `OutfitPage.tsx`:
1. Add imports at the top:
```tsx
import FlatLay from '../../../shared/components/FlatLay';
import MetadataCard from '../../../shared/components/MetadataCard';
```

2. Remove the `FLAT_LAY_SLOTS` constant and the inline flat-lay `<div>`.

3. Replace the flat-lay `<div>` block (lines ~261–309) with:
```tsx
<div className="mb-4">
  <FlatLay
    items={displayItems}
    selectedItemId={selectedItem?.id}
    onSelectItem={setSelectedItem}
  />
</div>
```

4. Replace the item metadata card `<div>` block (lines ~312–368) with:
```tsx
{selectedItem && (
  <div className="mb-4">
    <MetadataCard
      item={selectedItem}
      onClose={() => setSelectedItem(null)}
      onSwap={() => {
        setSwappingItem(selectedItem);
        setSelectedItem(null);
      }}
    />
  </div>
)}
```

- [ ] **Step 4: Type-check the frontend**

```bash
cd frontend && nvm use && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/components/FlatLay.tsx \
        frontend/src/shared/components/MetadataCard.tsx \
        frontend/src/features/outfit/components/OutfitPage.tsx
git commit -m "refactor(frontend): extract FlatLay and MetadataCard to shared components"
```

---

## Task 11: History feature slice

**Files:**
- Create: `frontend/src/features/history/api.ts`
- Create: `frontend/src/features/history/components/HistoryPage.tsx`
- Create: `frontend/src/features/history/index.ts`
- Modify: `frontend/src/shared/api/types.ts`
- Modify: `frontend/src/shared/components/TopNav.tsx`
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: Add history types to `types.ts`**

In `frontend/src/shared/api/types.ts`, add:

```ts
export type OutfitHistoryResponse = components['schemas']['OutfitHistoryResponse'];
export type HistoryEntry = components['schemas']['HistoryEntry'];
export type AcceptedOutfit = components['schemas']['AcceptedOutfit'];
export type OutfitHistoryItem = components['schemas']['OutfitHistoryItem'];
```

- [ ] **Step 2: Create `features/history/api.ts`**

`frontend/src/features/history/api.ts`:

```ts
import { client } from '../../shared/api/client';
import type { OutfitHistoryResponse } from '../../shared/api/types';

interface ListHistoryParams {
  cursor?: string;
  limit?: number;
  range?: 'week' | 'month' | 'season' | 'all';
  time_of_day?: 'morning' | 'afternoon' | 'evening';
}

export async function listHistory(params: ListHistoryParams = {}): Promise<OutfitHistoryResponse> {
  const query: Record<string, string> = {};
  if (params.cursor) query.cursor = params.cursor;
  if (params.limit) query.limit = String(params.limit);
  if (params.range) query.range = params.range;
  if (params.time_of_day) query.time_of_day = params.time_of_day;

  const { data, error } = await client.GET('/recommendations/history', { params: { query } });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Create `HistoryPage.tsx`**

`frontend/src/features/history/components/HistoryPage.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Shirt } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';
import FlatLay from '../../../shared/components/FlatLay';
import type { HistoryEntry, OutfitHistoryItem, AcceptedOutfit } from '../../../shared/api/types';
import type { ClothingItem } from '../../../shared/api/types';
import { listHistory } from '../api';

type RangeFilter = 'week' | 'month' | 'season' | 'all';
type TodFilter = '' | 'morning' | 'afternoon' | 'evening';

function toClothingItem(item: OutfitHistoryItem): ClothingItem {
  return {
    id: item.item_id,
    user_id: '',
    image_url: item.image_url ?? '',
    category: item.category as ClothingItem['category'],
    sub_type: item.sub_type,
    color: item.color as ClothingItem['color'],
    fit: (item.fit ?? '') as ClothingItem['fit'],
    season: (item.season ?? '') as ClothingItem['season'],
  };
}

function deriveHashtags(outfit: AcceptedOutfit): string[] {
  const tags: string[] = [];
  if (outfit.occasion) tags.push(outfit.occasion);
  const seasons = [...new Set(outfit.items.map((i) => i.season).filter(Boolean))].filter(
    (s) => s !== 'all',
  );
  seasons.forEach((s) => tags.push((s as string).replace(/_/g, '-')));
  const cats = [...new Set(outfit.items.map((i) => i.category))];
  cats.forEach((c) => tags.push(c));
  return [...new Set(tags)].slice(0, 5);
}

function formatWornOn(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeFilter>('week');
  const [tod, setTod] = useState<TodFilter>('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    (cursor?: string) => {
      const isFirstPage = !cursor;
      isFirstPage ? setLoading(true) : setLoadingMore(true);
      setError(null);

      listHistory({ range, time_of_day: tod || undefined, cursor })
        .then((res) => {
          setEntries((prev) => (isFirstPage ? res.entries : [...prev, ...res.entries]));
          setNextCursor(res.next_cursor ?? null);
        })
        .catch(() => setError('Unable to load outfit history. Please try again.'))
        .finally(() => {
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [range, tod],
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen-safe bg-background pb-10">
      <TopNav />

      <main className="mx-auto max-w-xl px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-terracotta">
            Your Atelier Journal
          </p>
          <h1 className="mb-1 font-serif text-3xl font-normal text-espresso">Outfit History</h1>
          <p className="text-sm text-muted-foreground">Every look you've worn, beautifully kept.</p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Range */}
          <div className="flex rounded-full border border-sand bg-linen p-1 gap-1">
            {(['week', 'month', 'season', 'all'] as RangeFilter[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 rounded-full py-1.5 text-xs font-medium capitalize transition-colors ${
                  range === r
                    ? 'bg-terracotta text-cream shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Time of day */}
          <div className="flex gap-2">
            {(['', 'morning', 'afternoon', 'evening'] as TodFilter[]).map((t) => (
              <button
                key={t || 'all'}
                onClick={() => setTod(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  tod === t
                    ? 'border-terracotta bg-terracotta/10 text-terracotta'
                    : 'border-sand bg-cream text-muted-foreground hover:text-foreground'
                }`}
              >
                {t || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-linen" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="mb-4 text-sm text-destructive">{error}</p>
            <button onClick={() => load()} className="btn-outline btn-sm gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Shirt className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 font-medium">No outfits recorded yet</p>
            <p className="mb-6 text-sm text-muted-foreground">
              Accept your first outfit suggestion to start your history.
            </p>
            <button onClick={() => navigate('/outfit')} className="btn-primary btn-sm">
              Get Today's Outfit
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry, ei) => (
              <section key={entry.worn_on}>
                {ei === 0 ? null : (
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-terracotta">
                    {formatWornOn(entry.worn_on)}
                  </p>
                )}
                {entry.outfits.map((outfit) => {
                  const clothingItems = outfit.items.map(toClothingItem);
                  const hashtags = deriveHashtags(outfit);
                  const isHero = ei === 0 && entry.outfits.indexOf(outfit) === 0;

                  if (isHero) {
                    return (
                      <div
                        key={outfit.id}
                        className="mb-4 overflow-hidden rounded-2xl border border-sand bg-linen p-4"
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Most Recent
                            </p>
                            <p className="font-serif text-xl text-espresso">
                              {formatWornOn(entry.worn_on)}
                            </p>
                          </div>
                          <span className="rounded-full border border-green-600 bg-green-50 px-3 py-1 text-xs text-green-700">
                            Saved
                          </span>
                        </div>
                        <div className="mb-3 flex gap-2">
                          <span className="rounded-full border border-terracotta bg-terracotta/10 px-3 py-1 text-xs capitalize text-terracotta">
                            {outfit.time_of_day}
                          </span>
                          {outfit.weather && (
                            <span className="rounded-full border border-sand bg-cream px-3 py-1 text-xs text-muted-foreground">
                              {outfit.weather.temperature}°C · {outfit.weather.description}
                            </span>
                          )}
                          {outfit.occasion && (
                            <span className="rounded-full border border-sand bg-cream px-3 py-1 text-xs text-muted-foreground">
                              {outfit.occasion}
                            </span>
                          )}
                        </div>
                        <FlatLay items={clothingItems} compact />
                        {hashtags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {hashtags.map((tag) => (
                              <span key={tag} className="text-xs text-muted-foreground">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const thumb = clothingItems[0];
                  return (
                    <div
                      key={outfit.id}
                      className="flex items-center gap-3 rounded-2xl border border-sand bg-linen p-3"
                    >
                      <div className="h-[90px] w-[76px] shrink-0 overflow-hidden rounded-xl">
                        {thumb?.image_url ? (
                          <img
                            src={thumb.image_url}
                            alt={thumb.sub_type}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-sand/40">
                            <Shirt className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="font-serif text-lg text-espresso">
                          {formatWornOn(entry.worn_on)}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-terracotta bg-terracotta/10 px-2.5 py-0.5 text-xs capitalize text-terracotta">
                            {outfit.time_of_day}
                          </span>
                          {outfit.weather && (
                            <span className="rounded-full border border-sand bg-cream px-2.5 py-0.5 text-xs text-muted-foreground">
                              {outfit.weather.temperature}°C
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {hashtags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs text-muted-foreground">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}

            {nextCursor && (
              <button
                onClick={() => load(nextCursor)}
                disabled={loadingMore}
                className="btn-outline btn-sm w-full"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create `features/history/index.ts`**

`frontend/src/features/history/index.ts`:

```ts
export { default as HistoryPage } from './components/HistoryPage';
```

- [ ] **Step 5: Add History to `TopNav.tsx`**

In `TopNav.tsx`, update the `navItems` array:

```ts
const navItems = [
  { to: '/wardrobe', label: 'Wardrobe' },
  { to: '/outfit', label: 'Outfit' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/history', label: 'History' },
];
```

- [ ] **Step 6: Add `/history` route to `App.tsx`**

In `App.tsx`, add the import and route:

```tsx
import { HistoryPage } from '../features/history';
```

Add inside `<Routes>`:

```tsx
<Route
  path="/history"
  element={
    <ProtectedRoute>
      <HistoryPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 7: Type-check and lint**

```bash
cd frontend && nvm use && npm run build && npm run lint
```

Expected: no TypeScript errors, no lint errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/history/ \
        frontend/src/shared/components/TopNav.tsx \
        frontend/src/app/App.tsx \
        frontend/src/shared/api/types.ts
git commit -m "feat(frontend): add outfit history page with filters, pagination, and design-matched layout"
```

---

## Task 12: Tests

**Files:**
- Create: `backend/internal/infrastructure/persistence/postgres/outfit_history_repository_test.go`
- Modify: `backend/internal/domain/recommendation/service_test.go`

- [ ] **Step 1: Write a failing test for `DeriveTimeOfDay`**

In `backend/internal/domain/recommendation/service_test.go`, add:

```go
func TestDeriveTimeOfDay(t *testing.T) {
    cases := []struct {
        hour int
        want recommendation.TimeOfDay
    }{
        {6, recommendation.TimeOfDayMorning},
        {11, recommendation.TimeOfDayMorning},
        {12, recommendation.TimeOfDayAfternoon},
        {16, recommendation.TimeOfDayAfternoon},
        {17, recommendation.TimeOfDayEvening},
        {23, recommendation.TimeOfDayEvening},
    }
    for _, tc := range cases {
        t := time.Date(2026, 6, 11, tc.hour, 0, 0, 0, time.UTC)
        got := recommendation.DeriveTimeOfDay(t)
        if got != tc.want {
            t.Errorf("hour %d: got %q, want %q", tc.hour, got, tc.want)
        }
    }
}
```

- [ ] **Step 2: Run that test to verify it passes**

```bash
cd backend && go test ./internal/domain/recommendation/... -run TestDeriveTimeOfDay -v
```

Expected: PASS.

- [ ] **Step 3: Write a failing integration test for `AcceptAndRecord`**

Add to `service_test.go` (using the existing mock pattern from the file):

```go
func TestAcceptAndRecord_EmptyItemIDs(t *testing.T) {
    // Verify AcceptAndRecord returns nil for empty itemIDs without panicking.
    // Uses a stub transactor that runs fn immediately without a real DB.
    svc := recommendation.NewService(
        &stubWardrobeRepo{},
        &stubCalendarRepo{},
        weather.NewService(),
        &stubAIRecommender{},
        &stubHistoryRepo{},
        &stubTransactor{},
    )
    err := svc.AcceptAndRecord(context.Background(), "user-1", "", []string{})
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
}
```

You'll need to add `stubHistoryRepo` and `stubTransactor` structs to the test file:

```go
type stubHistoryRepo struct{}

func (s *stubHistoryRepo) Save(_ context.Context, _ *recommendation.AcceptedOutfit) error {
    return nil
}

func (s *stubHistoryRepo) List(_ context.Context, _ string, _ string, _ int, _ recommendation.HistoryFilter) ([]*recommendation.AcceptedOutfit, string, error) {
    return nil, "", nil
}

type stubTransactor struct{}

func (s *stubTransactor) InTransaction(_ context.Context, fn func(context.Context) error) error {
    return fn(context.Background())
}
```

- [ ] **Step 4: Run the test**

```bash
cd backend && go test ./internal/domain/recommendation/... -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/domain/recommendation/service_test.go
git commit -m "test(domain): add DeriveTimeOfDay and AcceptAndRecord unit tests"
```

---

## Task 13: Pre-MR gate

- [ ] **Step 1: Invoke `pre-mr-check` skill**

Use the `pre-mr-check` skill to run the full lint/test/build gate.

- [ ] **Step 2: Verify backend builds and all tests pass**

```bash
cd backend && go vet ./... && go test ./...
```

Expected: no vet warnings, all tests green.

- [ ] **Step 3: Verify frontend builds cleanly**

```bash
cd frontend && nvm use && npm run lint && npm run format:check && npm run build
```

Expected: no errors.

- [ ] **Step 4: Validate the OpenAPI spec one final time**

```bash
npx @redocly/cli lint api/openapi.yaml
```

Expected: no errors.

---

## Self-Review Checklist

**Spec coverage:**
- ✓ `GET /recommendations/history` with cursor + range + time_of_day filters
- ✓ `outfit_history` + `outfit_history_items` tables (migration 006)
- ✓ `deleted_at` soft delete on `wardrobe_items` + all active-wardrobe queries filter it
- ✓ Single transaction wrapping MarkWorn + history insert
- ✓ Weather snapshot stored from stub at accept time
- ✓ `worn_on` = UTC date of `now()` at accept time
- ✓ `time_of_day` derived server-side from UTC hour
- ✓ `outfit_history_items` stores snapshot fields (not live FK-joined at read time)
- ✓ Cursor pagination on `id DESC`
- ✓ `season` filter uses meteorological season start date
- ✓ Frontend: `features/history/` vertical slice
- ✓ Frontend: `FlatLay` + `MetadataCard` extracted to shared, both `OutfitPage` and `HistoryPage` use them
- ✓ History page: empty state with CTA to `/outfit`
- ✓ History page: loading skeleton
- ✓ History page: error + retry
- ✓ History page: hero card for most recent entry, compact list for earlier entries
- ✓ History page: hashtags derived at render time
- ✓ Nav item `History` added to `TopNav` + protected route in `App.tsx`
- ✓ `session_id` stored as nullable on `outfit_history`
- ✓ `outfit_history_items.item_id` FK to `wardrobe_items` (safe because soft delete — rows never hard deleted)

**Type consistency:** `AcceptedOutfit` struct matches between domain (Go), OpenAPI spec, and frontend types. `OutfitHistoryItem` fields match migration column names. `Transactor.InTransaction` signature consistent between interface and implementation.
