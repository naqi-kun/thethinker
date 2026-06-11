package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/seeds"
)

// seedDB is the subset of pgxpool.Pool the seed needs; an interface so tests
// can run the seed against a fake without a live Postgres.
type seedDB interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

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
}

// imageMeta maps each filename stem under backend/seeds/images/ to its metadata.
var imageMeta = map[string]seedMeta{
	"shirt":      {"shirt", "formal", "white", "slim", "all"},
	"t-shirt":    {"t-shirt", "casual", "white", "regular", "all"},
	"sweatshirt": {"sweater", "casual", "beige", "relaxed", "autumn_winter"},
	"hoodie":     {"hoodie", "casual", "grey", "oversized", "all"},
	"jacket":     {"jacket", "casual", "black", "regular", "autumn_winter"},
	"coat":       {"coat", "formal", "brown", "regular", "winter"},
	"blazer":     {"blazer", "formal", "navy blue", "slim", "all"},
	"suit":       {"suit", "formal", "grey", "slim", "all"},
	"pants":      {"pants", "formal", "black", "slim", "all"},
	"jeans":      {"jeans", "casual", "blue", "slim", "all"},
	"shorts":     {"shorts", "casual", "beige", "regular", "spring_summer"},
	"skirt":      {"skirt", "casual", "beige", "regular", "spring_summer"},
	"dress":      {"dress", "casual", "navy blue", "regular", "spring_summer"},
	"shoes":      {"shoes", "formal", "black", "regular", "all"},
	"sneakers":   {"sneakers", "casual", "white", "regular", "all"},
	"boots":      {"boots", "casual", "brown", "regular", "autumn_winter"},
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

	count := 0
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

		for _, userID := range []string{user1, user2} {
			if err := ctx.Err(); err != nil {
				return "", fmt.Errorf("seed canceled after %d items: %w", count, err)
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
			count++
		}
	}

	if failed > 0 {
		return "", fmt.Errorf("%d item(s) failed (%d seeded), first error: %w", failed, count, firstErr)
	}

	return fmt.Sprintf(
		"seed complete — 2 users, %d wardrobe items\n\nLogin credentials:\n  dev@thethinker.com  / password123\n  jane@thethinker.com / password123",
		count,
	), nil
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
