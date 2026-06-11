package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"school-gitlab.xsolla.dev/team3/thethinker/seeds"
)

// seedDB is the subset of pgxpool.Pool the seed needs; an interface so tests
// can run the seed against a fake without a live Postgres.
type seedDB interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

// DevSeedHandler populates the database with deterministic test data.
// Only active when GCS_EMULATOR_HOST is set (dev environment guard).
// Images are processed through the full pipeline: AI classification + background removal.
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

	msg, err := h.runSeed(r.Context())
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

	// Process items concurrently (4 at a time) — each IngestScan call hits the AI
	// service for classification + background removal, so sequential would be very slow.
	sem := make(chan struct{}, 4)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var errs []error
	count := 0

	for _, entry := range entries {
		for _, userID := range []string{user1, user2} {
			wg.Add(1)
			entry, userID := entry, userID
			go func() {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				data, err := seeds.FS.ReadFile("images/" + entry.Name())
				if err != nil {
					mu.Lock()
					errs = append(errs, err)
					mu.Unlock()
					return
				}

				ct := seedContentType(entry.Name())
				if _, err := h.wardrobeSvc.IngestScan(ctx, userID, data, ct); err != nil {
					log.Printf("seed: ingest %s for %s: %v", entry.Name(), userID, err)
					mu.Lock()
					errs = append(errs, fmt.Errorf("ingest %s: %w", entry.Name(), err))
					mu.Unlock()
					return
				}

				mu.Lock()
				count++
				mu.Unlock()
			}()
		}
	}

	wg.Wait()

	if len(errs) > 0 {
		return "", fmt.Errorf("%d item(s) failed, first error: %w", len(errs), errs[0])
	}

	return fmt.Sprintf(
		"seed complete — 2 users, %d wardrobe items\n\nLogin credentials:\n  dev@thethinker.com  / password123\n  jane@thethinker.com / password123",
		count,
	), nil
}

// checkAIServiceReady does a quick /healthz probe on the AI service.
// Returns a clear error if the service is unreachable so the seed fails fast
// instead of silently retrying 32 items against a down DCP proxy.
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

func seedContentType(filename string) string {
	switch filepath.Ext(filename) {
	case ".avif":
		return "image/avif"
	case ".webp":
		return "image/webp"
	default:
		return "image/jpeg"
	}
}
