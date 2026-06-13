package postgres

import (
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

// validRow returns a wardrobeRow whose enum values all parse cleanly. Callers
// override individual fields to simulate malformed classifier output.
func validRow(id string) wardrobeRow {
	return wardrobeRow{
		id:        id,
		userID:    "user-1",
		name:      "item " + id,
		category:  "casual",
		subType:   "t-shirt",
		color:     "grey",
		fit:       "regular",
		season:    "all",
		imageURL:  "https://example.test/" + id + ".png",
		createdAt: time.Now(),
	}
}

func ids(items []*wardrobe.ClothingItem) []string {
	out := make([]string, len(items))
	for i, it := range items {
		out[i] = it.ID
	}
	return out
}

// Scenario: one item has an unknown color → the other items are still returned.
func TestCollectItems_SkipsUnknownColor(t *testing.T) {
	bad := validRow("2")
	bad.color = "dark grey" // not in the known color set

	rows := []wardrobeRow{validRow("1"), bad, validRow("3")}

	items := collectItems("user-1", rows)

	if got := ids(items); len(got) != 2 || got[0] != "1" || got[1] != "3" {
		t.Fatalf("expected items [1 3], got %v", got)
	}
}

// Scenario: one item has an unknown category → the rest of the wardrobe is unaffected.
func TestCollectItems_SkipsUnknownCategory(t *testing.T) {
	bad := validRow("1")
	bad.category = "loungewear" // unknown category

	rows := []wardrobeRow{bad, validRow("2")}

	items := collectItems("user-1", rows)

	if got := ids(items); len(got) != 1 || got[0] != "2" {
		t.Fatalf("expected items [2], got %v", got)
	}
}

// Scenario: an unknown fit value (e.g. "slim-fit") is skipped, not fatal.
func TestCollectItems_SkipsUnknownFit(t *testing.T) {
	bad := validRow("1")
	bad.fit = "slim-fit" // classifier hyphenated a known value

	items := collectItems("user-1", []wardrobeRow{bad, validRow("2")})

	if got := ids(items); len(got) != 1 || got[0] != "2" {
		t.Fatalf("expected items [2], got %v", got)
	}
}

// Regression: a wardrobe of entirely valid items is returned unchanged, in order.
func TestCollectItems_AllValid(t *testing.T) {
	rows := []wardrobeRow{validRow("1"), validRow("2"), validRow("3")}

	items := collectItems("user-1", rows)

	if got := ids(items); len(got) != 3 || got[0] != "1" || got[1] != "2" || got[2] != "3" {
		t.Fatalf("expected items [1 2 3], got %v", got)
	}
}

// Scenario: every item has a bad value → result is an empty (non-nil) slice,
// which serializes to [] rather than null, and never an error/500.
func TestCollectItems_AllBad(t *testing.T) {
	a := validRow("1")
	a.color = "chartreuse"
	b := validRow("2")
	b.season = "monsoon"

	items := collectItems("user-1", []wardrobeRow{a, b})

	if items == nil {
		t.Fatal("expected non-nil empty slice, got nil")
	}
	if len(items) != 0 {
		t.Fatalf("expected empty slice, got %v", ids(items))
	}
}

// An empty input yields a non-nil empty slice (defensive: serializes as []).
func TestCollectItems_Empty(t *testing.T) {
	items := collectItems("user-1", nil)
	if items == nil || len(items) != 0 {
		t.Fatalf("expected non-nil empty slice, got %v", items)
	}
}

// toClothingItem maps every field correctly for a fully valid row.
func TestToClothingItem_Valid(t *testing.T) {
	item, err := validRow("42").toClothingItem()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item.ID != "42" || item.Category != wardrobe.CategoryCasual ||
		item.SubType != wardrobe.SubTypeTShirt || item.Color != wardrobe.ColorGrey ||
		item.Fit != wardrobe.FitRegular || item.Season != wardrobe.SeasonAll {
		t.Fatalf("fields mapped incorrectly: %+v", item)
	}
}

// toClothingItem surfaces ErrInvalidClassification for an unrecognized value so
// FindByID still reports the problem on a direct single-item lookup.
func TestToClothingItem_InvalidReturnsError(t *testing.T) {
	bad := validRow("1")
	bad.color = "dark grey"

	if _, err := bad.toClothingItem(); err == nil {
		t.Fatal("expected an error for unknown color, got nil")
	}
}
