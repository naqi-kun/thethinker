package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/seeds"
)

// seedDB is the subset of pgxpool.Pool the seed needs; an interface so tests
// can run the seed against a fake without a live Postgres.
type seedDB interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

// audience controls which test user(s) receive a seed item.
type audience int

const (
	unisex audience = iota // both users
	mens                   // dev@thethinker.com only
	womens                 // jane@thethinker.com only
)

// seedMeta holds the curated classification for one seed image. The Gemini
// free tier allows only 20 requests/day — far less than one seed run — so
// seed items are classified from their filename instead of through the AI.
// Background removal and GCS upload still run through the normal upload
// pipeline (wardrobeSvc.UploadImage), identical to a real user upload.
type seedMeta struct {
	subType  string
	category string
	color    string
	fit      string
	season   string
	audience audience
}

// imageMeta maps each filename stem under backend/seeds/images/ to its
// metadata, curated by looking at the actual image. Men's items seed only the
// dev account, women's only jane's; unisex items go to both.
var imageMeta = map[string]seedMeta{
	"shirt":      {"shirt", "formal", "light blue", "slim", "all", mens},
	"t-shirt":    {"t-shirt", "casual", "orange", "regular", "all", unisex},
	"sweatshirt": {"sweater", "casual", "grey", "relaxed", "autumn_winter", unisex},
	"hoodie":     {"hoodie", "casual", "beige", "oversized", "all", unisex},
	"jacket":     {"jacket", "casual", "grey", "regular", "all", mens},
	"coat":       {"coat", "formal", "navy blue", "relaxed", "autumn_winter", mens},
	"blazer":     {"blazer", "formal", "grey", "regular", "all", mens},
	"suit":       {"suit", "formal", "navy blue", "slim", "all", mens},
	"pants":      {"pants", "casual", "beige", "relaxed", "all", womens},
	"jeans":      {"jeans", "casual", "grey", "relaxed", "all", unisex},
	"shorts":     {"shorts", "casual", "light blue", "regular", "spring_summer", unisex},
	"skirt":      {"skirt", "casual", "olive", "regular", "spring_summer", womens},
	"dress":      {"dress", "casual", "multicolor", "regular", "spring_summer", womens},
	"shoes":      {"shoes", "formal", "black", "regular", "all", mens},
	"sneakers":   {"sneakers", "casual", "beige", "regular", "all", unisex},
	"boots":      {"boots", "casual", "black", "regular", "autumn_winter", unisex},
}

// DevSeedHandler populates the database with deterministic test data.
// Only active when GCS_EMULATOR_HOST is set (dev environment guard).
type DevSeedHandler struct {
	db          seedDB
	wardrobeSvc wardrobeSvc
}

func NewDevSeedHandler(db seedDB, svc wardrobeSvc) *DevSeedHandler {
	return &DevSeedHandler{db: db, wardrobeSvc: svc}
}

func (h *DevSeedHandler) Seed(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("GCS_EMULATOR_HOST") == "" {
		http.Error(w, "seed endpoint not available outside dev environment", http.StatusForbidden)
		return
	}

	// Background removal across 32 items takes a couple of minutes; extend this
	// connection's write deadline past the server-wide WriteTimeout (120s),
	// which would otherwise drop the connection mid-seed.
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Now().Add(10 * time.Minute))

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Minute)
	defer cancel()

	msg, err := h.runSeed(ctx)
	if err != nil {
		log.Printf("seed: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintln(w, msg)
}

func (h *DevSeedHandler) runSeed(ctx context.Context) (string, error) {
	const user1 = "00000000-0000-0000-0000-000000000001"
	const user2 = "00000000-0000-0000-0000-000000000002"

	itemIDs := map[string]map[string]string{
		user1: {},
		user2: {},
	}

	// Bg removal needs the AI service; fail fast with a clear message instead
	// of seeding a wardrobe of images with backgrounds still in place.
	if err := checkAIServiceReady(); err != nil {
		return "", err
	}

	if _, err := h.db.Exec(ctx,
		`TRUNCATE wardrobe_items, user_preferences, users RESTART IDENTITY CASCADE`); err != nil {
		return "", fmt.Errorf("truncate: %w", err)
	}

	if _, err := h.db.Exec(ctx, `
		INSERT INTO users (id, email, password_hash) VALUES
		($1, 'dev@thethinker.com',  crypt('password123', gen_salt('bf', 10))),
		($2, 'jane@thethinker.com', crypt('password123', gen_salt('bf', 10)))`,
		user1, user2,
	); err != nil {
		return "", fmt.Errorf("insert users: %w", err)
	}

	if _, err := h.db.Exec(ctx, `
		INSERT INTO user_preferences (user_id, styles, answers) VALUES
		($1, ARRAY['casual','business_casual'], '{"climate":"temperate","occasion":"work"}'),
		($2, ARRAY['formal','classic'],         '{"climate":"temperate","occasion":"formal"}')`,
		user1, user2,
	); err != nil {
		return "", fmt.Errorf("insert preferences: %w", err)
	}

	entries, err := seeds.FS.ReadDir("images")
	if err != nil {
		return "", fmt.Errorf("read seed images: %w", err)
	}

	perUser := map[string]int{}
	failed := 0
	var firstErr error

	for _, entry := range entries {
		stem := strings.TrimSuffix(entry.Name(), ".jpg")
		meta, ok := imageMeta[stem]
		if !ok {
			return "", fmt.Errorf("no metadata for seed image %q — add it to imageMeta in seed_handler.go", entry.Name())
		}

		item, err := buildItem(meta)
		if err != nil {
			return "", fmt.Errorf("metadata for %s: %w", entry.Name(), err)
		}

		data, err := seeds.FS.ReadFile("images/" + entry.Name())
		if err != nil {
			return "", fmt.Errorf("read %s: %w", entry.Name(), err)
		}

		var recipients []string
		switch meta.audience {
		case mens:
			recipients = []string{user1}
		case womens:
			recipients = []string{user2}
		default:
			recipients = []string{user1, user2}
		}

		for _, userID := range recipients {
			if err := ctx.Err(); err != nil {
				return "", fmt.Errorf("seed canceled after %d items: %w", perUser[user1]+perUser[user2], err)
			}
			saved, err := h.wardrobeSvc.AddItem(ctx, userID, item)
			if err == nil {
				// Same path as a real user upload: validate → bg removal → GCS.
				_, err = h.wardrobeSvc.UploadImage(ctx, saved.ID, userID, data)
			}
			if err != nil {
				log.Printf("seed: %s for %s: %v", entry.Name(), userID, err)
				failed++
				if firstErr == nil {
					firstErr = fmt.Errorf("%s: %w", entry.Name(), err)
				}
				continue
			}
			perUser[userID]++
			itemIDs[userID][meta.subType] = saved.ID
		}
	}

	count := perUser[user1] + perUser[user2]
	if failed > 0 {
		return "", fmt.Errorf("%d item(s) failed (%d seeded), first error: %w", failed, count, firstErr)
	}

	histCount, err := h.seedHistory(ctx, user1, itemIDs[user1])
	if err != nil {
		return "", fmt.Errorf("seed history: %w", err)
	}

	return fmt.Sprintf(
		"seed complete — 2 users, %d wardrobe items, %d outfit history entries\n\nLogin credentials:\n  dev@thethinker.com  / password123 (%d items, menswear + unisex)\n  jane@thethinker.com / password123 (%d items, womenswear + unisex)",
		count, histCount, perUser[user1], perUser[user2],
	), nil
}

func (h *DevSeedHandler) seedHistory(ctx context.Context, userID string, itemIDs map[string]string) (int, error) {
	type entry struct {
		occasion  string
		daysAgo   int
		timeOfDay string
		weather   string
		subTypes  []string
	}
	entries := []entry{
		{"casual", 1, "morning", `{"temperature":20,"feels_like":19,"description":"sunny"}`, []string{"t-shirt", "jeans", "sneakers"}},
		{"formal", 2, "afternoon", `{"temperature":18,"feels_like":17,"description":"cloudy"}`, []string{"shirt", "blazer", "shoes"}},
		{"casual", 3, "evening", `{"temperature":15,"feels_like":14,"description":"clear"}`, []string{"hoodie", "jeans", "boots"}},
		{"casual", 4, "morning", `{"temperature":22,"feels_like":22,"description":"clear"}`, []string{"t-shirt", "shorts", "sneakers"}},
		{"formal", 5, "afternoon", `{"temperature":16,"feels_like":15,"description":"overcast"}`, []string{"shirt", "blazer", "shoes"}},
	}
	inserted := 0
	for i, e := range entries {
		histID := uuid.New().String()
		if _, err := h.db.Exec(ctx, `
			INSERT INTO outfit_history (id, user_id, session_id, occasion, worn_on, time_of_day, weather_snapshot, created_at)
			VALUES ($1, $2, $3, $4, CURRENT_DATE - $5::int, $6, $7, NOW() - $5::int * INTERVAL '1 day')`,
			histID, userID, fmt.Sprintf("seed-session-%d", i+1), e.occasion, e.daysAgo, e.timeOfDay, e.weather,
		); err != nil {
			return inserted, fmt.Errorf("entry %d: %w", i+1, err)
		}
		for _, subType := range e.subTypes {
			itemID, ok := itemIDs[subType]
			if !ok {
				continue
			}
			m := imageMeta[subType]
			if _, err := h.db.Exec(ctx, `
				INSERT INTO outfit_history_items (outfit_history_id, item_id, image_url, category, sub_type, color, fit, season)
				SELECT $1, id, COALESCE(image_url, ''), $3, $4, $5, $6, $7
				FROM wardrobe_items WHERE id = $2`,
				histID, itemID, m.category, m.subType, m.color, m.fit, m.season,
			); err != nil {
				return inserted, fmt.Errorf("entry %d item %s: %w", i+1, subType, err)
			}
		}
		inserted++
	}
	return inserted, nil
}

// buildItem converts curated string metadata into a typed ClothingItem.
func buildItem(meta seedMeta) (wardrobe.ClothingItem, error) {
	category, err := wardrobe.ParseCategory(meta.category)
	if err != nil {
		return wardrobe.ClothingItem{}, err
	}
	subType, err := wardrobe.ParseSubType(meta.subType)
	if err != nil {
		return wardrobe.ClothingItem{}, err
	}
	color, err := wardrobe.ParseColor(meta.color)
	if err != nil {
		return wardrobe.ClothingItem{}, err
	}
	fit, err := wardrobe.ParseFit(meta.fit)
	if err != nil {
		return wardrobe.ClothingItem{}, err
	}
	season, err := wardrobe.ParseSeason(meta.season)
	if err != nil {
		return wardrobe.ClothingItem{}, err
	}
	return wardrobe.ClothingItem{
		Category: category,
		SubType:  subType,
		Color:    color,
		Fit:      fit,
		Season:   season,
	}, nil
}

// checkAIServiceReady does a quick /healthz probe on the AI service.
// Returns a clear error if the service is unreachable so the seed fails fast
// instead of uploading 32 images that skip background removal.
func checkAIServiceReady() error {
	aiURL := os.Getenv("AI_SERVICE_URL")
	if aiURL == "" {
		return nil // no AI URL configured — skip the check
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(aiURL + "/healthz")
	if err != nil {
		return fmt.Errorf("AI service not ready (%s/healthz unreachable) — wait for it to start in the dashboard and retry: %w", aiURL, err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("AI service not ready (%s/healthz returned %d) — wait for it to start in the dashboard and retry", aiURL, resp.StatusCode)
	}
	return nil
}
