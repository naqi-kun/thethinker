package handlers_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/handlers"
	"school-gitlab.xsolla.dev/team3/thethinker/seeds"
)

// fakeSeedDB records executed SQL and simulates the items table: TRUNCATE
// resets the shared item counter the mock wardrobe service increments.
type fakeSeedDB struct {
	mu    sync.Mutex
	execs []string
	items *int
	err   error
}

func (f *fakeSeedDB) Exec(_ context.Context, sql string, _ ...any) (pgconn.CommandTag, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return pgconn.CommandTag{}, f.err
	}
	f.execs = append(f.execs, sql)
	if strings.Contains(sql, "TRUNCATE") && f.items != nil {
		*f.items = 0
	}
	return pgconn.CommandTag{}, nil
}

func seedImageCount(t *testing.T) int {
	t.Helper()
	entries, err := seeds.FS.ReadDir("images")
	if err != nil {
		t.Fatalf("read embedded seed images: %v", err)
	}
	return len(entries)
}

// healthyAIServer returns an httptest server answering 200 on /healthz.
func healthyAIServer(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)
	return srv
}

// seedMockSvc returns a mock whose AddItem assigns sequential IDs and whose
// UploadImage increments the shared item counter, mimicking the real flow.
// perUser (optional) records how many items each user received.
func seedMockSvc(items *int, perUser map[string]int) *mockWardrobeSvc {
	next := 0
	return &mockWardrobeSvc{
		addItem: func(_ context.Context, userID string, item wardrobe.ClothingItem) (*wardrobe.ClothingItem, error) {
			next++
			saved := item
			saved.ID = fmt.Sprintf("item-%d", next)
			saved.UserID = userID
			return &saved, nil
		},
		uploadImage: func(_ context.Context, _ string, userID string, _ []byte) (*wardrobe.ClothingItem, error) {
			*items++
			if perUser != nil {
				perUser[userID]++
			}
			return savedItem(), nil
		},
	}
}

func runSeedRequest(h *handlers.DevSeedHandler) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/dev/seed", nil)
	rec := httptest.NewRecorder()
	h.Seed(rec, req)
	return rec
}

func TestSeed_RejectedOutsideDevEnvironment(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "")

	items := 0
	db := &fakeSeedDB{items: &items}
	rec := runSeedRequest(handlers.NewDevSeedHandler(db, &mockWardrobeSvc{}))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
	if len(db.execs) != 0 {
		t.Fatalf("db touched outside dev environment: %v", db.execs)
	}
}

func TestSeed_FailsFastWhenAIServiceDown(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")

	// A server that is immediately closed — connection refused.
	deadSrv := httptest.NewServer(http.NotFoundHandler())
	deadSrv.Close()
	t.Setenv("AI_SERVICE_URL", deadSrv.URL)

	items := 0
	db := &fakeSeedDB{items: &items}
	rec := runSeedRequest(handlers.NewDevSeedHandler(db, &mockWardrobeSvc{}))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if !strings.Contains(rec.Body.String(), "AI service not ready") {
		t.Fatalf("body = %q, want AI-not-ready message", rec.Body.String())
	}
	if len(db.execs) != 0 {
		t.Fatalf("db must not be truncated when AI is down, got: %v", db.execs)
	}
}

func TestSeed_FailsWhenAIHealthzUnhealthy(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(srv.Close)
	t.Setenv("AI_SERVICE_URL", srv.URL)

	items := 0
	db := &fakeSeedDB{items: &items}
	rec := runSeedRequest(handlers.NewDevSeedHandler(db, &mockWardrobeSvc{}))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if len(db.execs) != 0 {
		t.Fatalf("db must not be truncated when AI is unhealthy, got: %v", db.execs)
	}
}

func TestSeed_IdempotentAcrossRuns(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")
	t.Setenv("AI_SERVICE_URL", healthyAIServer(t).URL)

	items := 0
	perUser := map[string]int{}
	db := &fakeSeedDB{items: &items}
	h := handlers.NewDevSeedHandler(db, seedMockSvc(&items, perUser))

	imageCount := seedImageCount(t)
	firstRunItems := 0

	for run := 1; run <= 2; run++ {
		// Per-run counters: TRUNCATE resets `items`; reset perUser to match.
		for k := range perUser {
			delete(perUser, k)
		}
		rec := runSeedRequest(h)
		if rec.Code != http.StatusOK {
			t.Fatalf("run %d: status = %d, body = %s", run, rec.Code, rec.Body.String())
		}
		// Gendered split: each image seeds 1 user (mens/womens) or 2 (unisex).
		if items < imageCount || items > imageCount*2 {
			t.Fatalf("run %d: items = %d, want between %d and %d", run, items, imageCount, imageCount*2)
		}
		if run == 1 {
			firstRunItems = items
		} else if items != firstRunItems {
			t.Fatalf("run %d: items = %d, want %d (no duplicates across runs)", run, items, firstRunItems)
		}
		if len(perUser) != 2 {
			t.Fatalf("run %d: items seeded for %d users, want both test users", run, len(perUser))
		}
		if !strings.Contains(rec.Body.String(), "dev@thethinker.com") {
			t.Fatalf("run %d: response must surface test credentials, got: %s", run, rec.Body.String())
		}
	}

	// Each run must start with a TRUNCATE so re-seeding never duplicates.
	truncates := 0
	for _, sql := range db.execs {
		if strings.Contains(sql, "TRUNCATE") {
			truncates++
		}
	}
	if truncates != 2 {
		t.Fatalf("TRUNCATE executed %d times, want 2 (once per run)", truncates)
	}
}

func TestSeed_EveryImageHasValidMetadata(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")
	t.Setenv("AI_SERVICE_URL", healthyAIServer(t).URL)

	subTypes := map[wardrobe.SubType]bool{}
	items := 0
	db := &fakeSeedDB{items: &items}
	svc := seedMockSvc(&items, nil)
	baseAdd := svc.addItem
	svc.addItem = func(ctx context.Context, userID string, item wardrobe.ClothingItem) (*wardrobe.ClothingItem, error) {
		subTypes[item.SubType] = true
		return baseAdd(ctx, userID, item)
	}

	rec := runSeedRequest(handlers.NewDevSeedHandler(db, svc))

	// A 200 means every filename resolved to parseable enum metadata —
	// an image without an imageMeta entry fails the whole run.
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if len(subTypes) != seedImageCount(t) {
		t.Fatalf("distinct sub-types = %d, want %d (one per image)", len(subTypes), seedImageCount(t))
	}
}

func TestSeed_ReportsUploadFailures(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")
	t.Setenv("AI_SERVICE_URL", healthyAIServer(t).URL)

	items := 0
	db := &fakeSeedDB{items: &items}
	svc := seedMockSvc(&items, nil)
	svc.uploadImage = func(context.Context, string, string, []byte) (*wardrobe.ClothingItem, error) {
		// Simulates GCS bucket missing / emulator gone mid-seed.
		return nil, errors.New("gcs: bucket not found")
	}

	rec := runSeedRequest(handlers.NewDevSeedHandler(db, svc))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if !strings.Contains(rec.Body.String(), "failed") {
		t.Fatalf("body = %q, want failure summary", rec.Body.String())
	}
}
