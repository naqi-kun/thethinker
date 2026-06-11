package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"school-gitlab.xsolla.dev/team3/thethinker/seeds"
)

// Gemini free tier allows ~10 requests/minute; one classify call per item,
// so items are seeded sequentially with this much spacing between calls.
const defaultClassifyInterval = 6 * time.Second

// seedDB is the subset of pgxpool.Pool the seed needs; an interface so tests
// can run the seed against a fake without a live Postgres.
type seedDB interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

// DevSeedHandler populates the database with deterministic test data.
// Only active when GCS_EMULATOR_HOST is set (dev environment guard).
// Images are processed through the full pipeline: AI classification + background removal.
type DevSeedHandler struct {
	db               seedDB
	wardrobeSvc      wardrobeSvc
	classifyInterval time.Duration
}

func NewDevSeedHandler(db seedDB, svc wardrobeSvc) *DevSeedHandler {
	return &DevSeedHandler{db: db, wardrobeSvc: svc, classifyInterval: defaultClassifyInterval}
}

// WithClassifyInterval overrides the spacing between AI calls (used by tests).
func (h *DevSeedHandler) WithClassifyInterval(d time.Duration) *DevSeedHandler {
	h.classifyInterval = d
	return h
}

func (h *DevSeedHandler) Seed(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("GCS_EMULATOR_HOST") == "" {
		http.Error(w, "seed endpoint not available outside dev environment", http.StatusForbidden)
		return
	}

	// The paced run takes ~4 min; extend this connection's write deadline past
	// the server-wide WriteTimeout (120s), which would otherwise drop the
	// connection mid-seed. Best-effort: not all writers support it.
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Now().Add(12 * time.Minute))

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
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

	// Sequential on purpose: every IngestScan makes a Gemini call, and the free
	// tier rate-limits at ~10 RPM. Spacing the calls keeps the whole run under
	// the limit; consecutive quota failures abort early (daily cap, not RPM).
	count := 0
	consecutiveQuota := 0
	first := true
	var firstErr error
	failed := 0

	for _, entry := range entries {
		data, err := seeds.FS.ReadFile("images/" + entry.Name())
		if err != nil {
			return "", fmt.Errorf("read %s: %w", entry.Name(), err)
		}
		ct := seedContentType(entry.Name())

		for _, userID := range []string{user1, user2} {
			if !first {
				select {
				case <-ctx.Done():
					return "", fmt.Errorf("seed canceled after %d items: %w", count, ctx.Err())
				case <-time.After(h.classifyInterval):
				}
			}
			first = false

			err := h.ingestWithRetry(ctx, userID, data, ct)
			if err != nil {
				log.Printf("seed: ingest %s for %s: %v", entry.Name(), userID, err)
				failed++
				if firstErr == nil {
					firstErr = fmt.Errorf("ingest %s: %w", entry.Name(), err)
				}
				if isQuotaErr(err) {
					consecutiveQuota++
					if consecutiveQuota >= 2 {
						return "", fmt.Errorf(
							"AI quota exhausted after %d items seeded — the Gemini daily limit may be reached, try again later: %w",
							count, err)
					}
				}
				continue
			}
			consecutiveQuota = 0
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

// ingestWithRetry retries quota-limited calls (transient RPM throttling) with
// growing backoff. Non-quota errors are returned immediately.
func (h *DevSeedHandler) ingestWithRetry(ctx context.Context, userID string, data []byte, contentType string) error {
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			wait := time.Duration(attempt) * 4 * h.classifyInterval
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(wait):
			}
		}
		_, err = h.wardrobeSvc.IngestScan(ctx, userID, data, contentType)
		if err == nil || !isQuotaErr(err) {
			return err
		}
	}
	return err
}

func isQuotaErr(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	return strings.Contains(s, "status 503") || strings.Contains(s, "status 429") || strings.Contains(s, "quota")
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
