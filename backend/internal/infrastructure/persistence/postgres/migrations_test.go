package postgres

import (
	"strings"
	"testing"
)

const (
	descriptionMigrationVersion = 20260622090000
	fixMissingPatternVersion    = 20260622120000
)

func TestFixMissingPatternMigrationVersionOrdersAfterDescription(t *testing.T) {
	if fixMissingPatternVersion <= descriptionMigrationVersion {
		t.Fatalf("fix migration version %d must be greater than description migration %d",
			fixMissingPatternVersion, descriptionMigrationVersion)
	}
}

func TestFixMissingPatternMigrationFilesExist(t *testing.T) {
	for _, name := range []string{
		"20260622120000_fix_missing_pattern.up.sql",
		"20260622120000_fix_missing_pattern.down.sql",
	} {
		if _, err := migrationFiles.Open("migrations/" + name); err != nil {
			t.Fatalf("missing migration file %s: %v", name, err)
		}
	}
}

func TestFixMissingPatternMigrationUpIsIdempotent(t *testing.T) {
	body, err := migrationFiles.ReadFile("migrations/20260622120000_fix_missing_pattern.up.sql")
	if err != nil {
		t.Fatalf("read up migration: %v", err)
	}
	sql := string(body)
	for _, fragment := range []string{
		"WHEN duplicate_object THEN NULL",
		"ADD COLUMN IF NOT EXISTS pattern",
	} {
		if !strings.Contains(sql, fragment) {
			t.Fatalf("expected idempotent fragment %q in up migration", fragment)
		}
	}
}
