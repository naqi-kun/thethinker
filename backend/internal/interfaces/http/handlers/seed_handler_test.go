package handlers_test

import (
	"context"
	"errors"
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

// newSeedHandler builds a handler with zero AI-call spacing so tests run fast.
func newSeedHandler(db *fakeSeedDB, svc *mockWardrobeSvc) *handlers.DevSeedHandler {
	return handlers.NewDevSeedHandler(db, svc).WithClassifyInterval(0)
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
	rec := runSeedRequest(newSeedHandler(db, &mockWardrobeSvc{}))

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
	rec := runSeedRequest(newSeedHandler(db, &mockWardrobeSvc{}))

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
	rec := runSeedRequest(newSeedHandler(db, &mockWardrobeSvc{}))

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
	db := &fakeSeedDB{items: &items}
	svc := &mockWardrobeSvc{
		ingestScan: func(_ context.Context, userID string, _ []byte, _ string) (*wardrobe.ClothingItem, error) {
			items++
			it := *savedItem()
			it.UserID = userID
			return &it, nil
		},
	}
	h := newSeedHandler(db, svc)

	wantItems := seedImageCount(t) * 2 // every image seeded for both test users

	for run := 1; run <= 2; run++ {
		rec := runSeedRequest(h)
		if rec.Code != http.StatusOK {
			t.Fatalf("run %d: status = %d, body = %s", run, rec.Code, rec.Body.String())
		}
		if items != wantItems {
			t.Fatalf("run %d: items = %d, want %d (no duplicates across runs)", run, items, wantItems)
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

func TestSeed_SendsCorrectContentTypes(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")
	t.Setenv("AI_SERVICE_URL", healthyAIServer(t).URL)

	contentTypes := map[string]int{}
	items := 0
	db := &fakeSeedDB{items: &items}
	svc := &mockWardrobeSvc{
		ingestScan: func(_ context.Context, _ string, _ []byte, contentType string) (*wardrobe.ClothingItem, error) {
			contentTypes[contentType]++
			return savedItem(), nil
		},
	}

	if rec := runSeedRequest(newSeedHandler(db, svc)); rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// Committed seed set: avif + webp only. Anything else means a file was
	// added without a content-type mapping.
	for ct := range contentTypes {
		if ct != "image/avif" && ct != "image/webp" {
			t.Fatalf("unexpected content type %q sent to IngestScan", ct)
		}
	}
	if contentTypes["image/webp"] == 0 || contentTypes["image/avif"] == 0 {
		t.Fatalf("expected both avif and webp images in seed set, got: %v", contentTypes)
	}
}

func TestSeed_ReportsIngestFailures(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")
	t.Setenv("AI_SERVICE_URL", healthyAIServer(t).URL)

	items := 0
	db := &fakeSeedDB{items: &items}
	svc := &mockWardrobeSvc{
		ingestScan: func(context.Context, string, []byte, string) (*wardrobe.ClothingItem, error) {
			// Simulates GCS bucket missing / emulator gone mid-seed.
			return nil, errors.New("gcs: bucket not found")
		},
	}

	rec := runSeedRequest(newSeedHandler(db, svc))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if !strings.Contains(rec.Body.String(), "failed") {
		t.Fatalf("body = %q, want failure summary", rec.Body.String())
	}
}

func TestSeed_RetriesTransientQuotaErrors(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")
	t.Setenv("AI_SERVICE_URL", healthyAIServer(t).URL)

	items := 0
	calls := 0
	db := &fakeSeedDB{items: &items}
	svc := &mockWardrobeSvc{
		ingestScan: func(context.Context, string, []byte, string) (*wardrobe.ClothingItem, error) {
			calls++
			// Every first attempt per item is rate-limited; the retry succeeds.
			if calls%2 == 1 {
				return nil, errors.New(`classifier: status 503: {"detail":"AI quota exhausted — please try again later"}`)
			}
			items++
			return savedItem(), nil
		},
	}

	rec := runSeedRequest(newSeedHandler(db, svc))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	wantItems := seedImageCount(t) * 2
	if items != wantItems {
		t.Fatalf("items = %d, want %d (transient quota errors should be retried)", items, wantItems)
	}
}

func TestSeed_AbortsWhenQuotaExhausted(t *testing.T) {
	t.Setenv("GCS_EMULATOR_HOST", "localhost:4443")
	t.Setenv("AI_SERVICE_URL", healthyAIServer(t).URL)

	items := 0
	calls := 0
	db := &fakeSeedDB{items: &items}
	svc := &mockWardrobeSvc{
		ingestScan: func(context.Context, string, []byte, string) (*wardrobe.ClothingItem, error) {
			calls++
			// Daily quota gone: every call fails, retries included.
			return nil, errors.New(`classifier: status 503: {"detail":"AI quota exhausted — please try again later"}`)
		},
	}

	rec := runSeedRequest(newSeedHandler(db, svc))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if !strings.Contains(rec.Body.String(), "quota exhausted") {
		t.Fatalf("body = %q, want quota-exhausted message", rec.Body.String())
	}
	// 2 items × 3 attempts each, then abort — not 32 items × 3 attempts.
	if calls > 6 {
		t.Fatalf("made %d AI calls before aborting, want early abort (≤6)", calls)
	}
}
