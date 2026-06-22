//go:build integration

package postgres

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path"
	"sort"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

func TestMain(m *testing.M) {
	if os.Getenv("TEST_DATABASE_URL") == "" {
		fmt.Fprintln(os.Stderr, "TEST_DATABASE_URL is required for integration tests")
		os.Exit(1)
	}
	os.Exit(m.Run())
}

func TestRunMigrations_FreshInstallIncludesPattern(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	resetDatabase(t, dbURL)

	if err := RunMigrations(dbURL); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}
	if err := RunMigrations(dbURL); err != nil {
		t.Fatalf("RunMigrations second run: %v", err)
	}

	assertColumnExists(t, dbURL, "wardrobe_items", "pattern")
	assertColumnExists(t, dbURL, "wardrobe_items", "description")
	assertSchemaVersion(t, dbURL, fixMissingPatternVersion)
}

// Simulates production: description migration applied first, schema stamped at
// 20260622090000, pattern column never added because 20260621000000 sorts earlier.
func TestRunMigrations_RepairsProductionPatternGap(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	resetDatabase(t, dbURL)

	applyMigrationFiles(t, dbURL, migrationsBeforePatternGap()...)
	execSQL(t, dbURL, readMigrationSQL(t, "20260622090000_wardrobe_description.up.sql"))
	setSchemaVersion(t, dbURL, descriptionMigrationVersion)

	assertColumnExists(t, dbURL, "wardrobe_items", "description")
	assertColumnMissing(t, dbURL, "wardrobe_items", "pattern")

	if err := RunMigrations(dbURL); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	assertColumnExists(t, dbURL, "wardrobe_items", "pattern")
	assertSchemaVersion(t, dbURL, fixMissingPatternVersion)

	ctx := context.Background()
	pool, err := NewPool(ctx, dbURL)
	if err != nil {
		t.Fatalf("NewPool: %v", err)
	}
	defer pool.Close()

	userID := insertTestUser(t, pool)
	repo := NewWardrobeRepository(pool)
	if err := repo.Save(ctx, testClothingItem(userID)); err != nil {
		t.Fatalf("Save: %v", err)
	}
	items, err := repo.FindByUserID(ctx, userID)
	if err != nil {
		t.Fatalf("FindByUserID: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
}

func migrationsBeforePatternGap() []string {
	return []string{
		"000001_init_schema.up.sql",
		"000002_wardrobe_fit_season.up.sql",
		"000003_wardrobe_enums.up.sql",
		"000004_calendars.up.sql",
		"000005_work_schedule.up.sql",
		"000006_wardrobe_name.up.sql",
		"000007_outfit_history.up.sql",
		"000008_preferences_use_ai.up.sql",
		"000009_wardrobe_accessories.up.sql",
		"20260614082008_clothing_status.up.sql",
		"20260615090000_user_name.up.sql",
		"20260616120000_google_oauth.up.sql",
		"20260618074300_narrow_clothing_status.up.sql",
		"20260618130000_notifications.up.sql",
	}
}

func resetDatabase(t *testing.T, dbURL string) {
	t.Helper()
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	defer pool.Close()

	rows, err := pool.Query(ctx, `
		SELECT tablename
		FROM pg_tables
		WHERE schemaname = 'public'
	`)
	if err != nil {
		t.Fatalf("list tables: %v", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("scan table: %v", err)
		}
		tables = append(tables, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("list tables rows: %v", err)
	}

	if len(tables) == 0 {
		return
	}

	_, err = pool.Exec(ctx, "DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
	if err != nil {
		t.Fatalf("reset schema: %v", err)
	}
}

func applyMigrationFiles(t *testing.T, dbURL string, names ...string) {
	t.Helper()
	for _, name := range names {
		execSQL(t, dbURL, readMigrationSQL(t, name))
	}
}

func readMigrationSQL(t *testing.T, name string) string {
	t.Helper()
	body, err := migrationFiles.ReadFile(path.Join("migrations", name))
	if err != nil {
		t.Fatalf("read migration %s: %v", name, err)
	}
	return string(body)
}

func execSQL(t *testing.T, dbURL, sql string) {
	t.Helper()
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, sql); err != nil {
		t.Fatalf("exec sql: %v", err)
	}
}

func setSchemaVersion(t *testing.T, dbURL string, version uint) {
	t.Helper()
	execSQL(t, dbURL, fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version bigint NOT NULL PRIMARY KEY,
			dirty boolean NOT NULL
		);
		DELETE FROM schema_migrations;
		INSERT INTO schema_migrations (version, dirty) VALUES (%d, false);
	`, version))
}

func assertSchemaVersion(t *testing.T, dbURL string, want uint) {
	t.Helper()
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	defer pool.Close()

	var got uint
	if err := pool.QueryRow(ctx, `SELECT version FROM schema_migrations`).Scan(&got); err != nil {
		t.Fatalf("query schema version: %v", err)
	}
	if got != want {
		t.Fatalf("schema version = %d, want %d", got, want)
	}
}

func assertColumnExists(t *testing.T, dbURL, table, column string) {
	t.Helper()
	if !columnExists(t, dbURL, table, column) {
		t.Fatalf("expected column %s.%s to exist", table, column)
	}
}

func assertColumnMissing(t *testing.T, dbURL, table, column string) {
	t.Helper()
	if columnExists(t, dbURL, table, column) {
		t.Fatalf("expected column %s.%s to be missing", table, column)
	}
}

func columnExists(t *testing.T, dbURL, table, column string) bool {
	t.Helper()
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	defer pool.Close()

	var exists bool
	err = pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = $1
			  AND column_name = $2
		)
	`, table, column).Scan(&exists)
	if err != nil {
		t.Fatalf("query column exists: %v", err)
	}
	return exists
}

func testClothingItem(userID string) *wardrobe.ClothingItem {
	return &wardrobe.ClothingItem{
		ID:       uuid.NewString(),
		UserID:   userID,
		Name:     "Integration tee",
		Category: wardrobe.CategoryCasual,
		SubType:  wardrobe.SubTypeTShirt,
		Color:    wardrobe.ColorGrey,
		Fit:      wardrobe.FitRegular,
		Season:   wardrobe.SeasonAll,
		Pattern:  wardrobe.PatternSolid,
		Status:   wardrobe.StatusClean,
	}
}

func insertTestUser(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	var userID string
	err := pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash)
		VALUES ('integration@test.local', 'hash')
		RETURNING id
	`).Scan(&userID)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return userID
}

func TestAllMigrationPairsPresent(t *testing.T) {
	entries, err := fs.ReadDir(migrationFiles, "migrations")
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}

	upFiles := map[string]struct{}{}
	downFiles := map[string]struct{}{}
	for _, entry := range entries {
		name := entry.Name()
		switch {
		case strings.HasSuffix(name, ".up.sql"):
			upFiles[strings.TrimSuffix(name, ".up.sql")] = struct{}{}
		case strings.HasSuffix(name, ".down.sql"):
			downFiles[strings.TrimSuffix(name, ".down.sql")] = struct{}{}
		}
	}

	var ups []string
	for base := range upFiles {
		ups = append(ups, base)
	}
	sort.Strings(ups)

	for _, base := range ups {
		if _, ok := downFiles[base]; !ok {
			t.Fatalf("missing down migration for %s", base)
		}
	}
}
