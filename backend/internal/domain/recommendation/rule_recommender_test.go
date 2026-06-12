package recommendation

import (
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

func TestDeriveSeason_FromTemperature(t *testing.T) {
	june := time.Date(2026, 6, 12, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		temp float64
		want currentSeason
	}{
		{30, seasonSpringSummer},
		{18, seasonSpringSummer}, // boundary: >= 18
		{17.9, seasonAutumnWinter},
		{8, seasonAutumnWinter}, // boundary: >= 8
		{7.9, seasonWinter},
		{-5, seasonWinter},
	}
	for _, tc := range cases {
		cond := &weather.Conditions{Temperature: tc.temp}
		if got := deriveSeason(cond, june); got != tc.want {
			t.Errorf("temp %.1f: got %v, want %v", tc.temp, got, tc.want)
		}
	}
}

func TestDeriveSeason_FromMonthWhenNoWeather(t *testing.T) {
	cases := []struct {
		month time.Month
		want  currentSeason
	}{
		{time.March, seasonSpringSummer},
		{time.August, seasonSpringSummer},
		{time.September, seasonAutumnWinter},
		{time.November, seasonAutumnWinter},
		{time.December, seasonWinter},
		{time.February, seasonWinter},
	}
	for _, tc := range cases {
		now := time.Date(2026, tc.month, 15, 12, 0, 0, 0, time.UTC)
		if got := deriveSeason(nil, now); got != tc.want {
			t.Errorf("month %s: got %v, want %v", tc.month, got, tc.want)
		}
	}
}

func TestSeasonMatches(t *testing.T) {
	cases := []struct {
		item wardrobe.Season
		cur  currentSeason
		want bool
	}{
		{wardrobe.SeasonAll, seasonSpringSummer, true},
		{wardrobe.SeasonAll, seasonWinter, true},
		{wardrobe.SeasonSpringSummer, seasonSpringSummer, true},
		{wardrobe.SeasonSpringSummer, seasonWinter, false},
		{wardrobe.SeasonAutumnWinter, seasonAutumnWinter, true},
		{wardrobe.SeasonAutumnWinter, seasonWinter, true},
		{wardrobe.SeasonWinter, seasonWinter, true},
		{wardrobe.SeasonWinter, seasonAutumnWinter, false},
		{wardrobe.SeasonWinter, seasonSpringSummer, false},
	}
	for _, tc := range cases {
		if got := seasonMatches(tc.item, tc.cur); got != tc.want {
			t.Errorf("item %v in %v: got %v, want %v", tc.item, tc.cur, got, tc.want)
		}
	}
}

func TestSlotFor(t *testing.T) {
	cases := []struct {
		sub  wardrobe.SubType
		want string
	}{
		{wardrobe.SubTypeShirt, "top"},
		{wardrobe.SubTypeCoat, "top"},
		{wardrobe.SubTypeJeans, "bottom"},
		{wardrobe.SubTypeDress, "bottom"},
		{wardrobe.SubTypeSneakers, "shoes"},
		{wardrobe.SubTypeBoots, "shoes"},
	}
	for _, tc := range cases {
		if got := slotFor(tc.sub); got != tc.want {
			t.Errorf("slotFor(%v) = %q, want %q", tc.sub, got, tc.want)
		}
	}
}

func item(id string, sub wardrobe.SubType, season wardrobe.Season) *wardrobe.ClothingItem {
	return &wardrobe.ClothingItem{ID: id, SubType: sub, Season: season}
}

func ids(items []*wardrobe.ClothingItem) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, it := range items {
		m[it.ID] = true
	}
	return m
}

func TestRuleBasedOutfit_FiltersBySeason(t *testing.T) {
	items := []*wardrobe.ClothingItem{
		item("tshirt", wardrobe.SubTypeTShirt, wardrobe.SeasonSpringSummer),
		item("coat", wardrobe.SubTypeCoat, wardrobe.SeasonWinter),
		item("jeans", wardrobe.SubTypeJeans, wardrobe.SeasonAll),
		item("sneakers", wardrobe.SubTypeSneakers, wardrobe.SeasonAll),
	}
	hot := &weather.Conditions{Temperature: 28}
	got := ids(ruleBasedOutfit(items, hot, time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC)))

	if !got["tshirt"] || !got["jeans"] || !got["sneakers"] {
		t.Errorf("expected tshirt+jeans+sneakers, got %v", got)
	}
	if got["coat"] {
		t.Errorf("winter coat selected for 28°C: %v", got)
	}
}

func TestRuleBasedOutfit_RelaxesEmptySlot(t *testing.T) {
	// Only top available is a winter coat; in summer the top slot would be
	// empty after season filtering, so the filter must relax for that slot.
	items := []*wardrobe.ClothingItem{
		item("coat", wardrobe.SubTypeCoat, wardrobe.SeasonWinter),
		item("shorts", wardrobe.SubTypeShorts, wardrobe.SeasonSpringSummer),
		item("sneakers", wardrobe.SubTypeSneakers, wardrobe.SeasonAll),
	}
	hot := &weather.Conditions{Temperature: 28}
	got := ids(ruleBasedOutfit(items, hot, time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC)))

	if !got["coat"] {
		t.Errorf("expected season filter to relax and include the only top, got %v", got)
	}
	if !got["shorts"] || !got["sneakers"] {
		t.Errorf("expected shorts+sneakers, got %v", got)
	}
}

func TestRuleBasedOutfit_EmptyWardrobe(t *testing.T) {
	got := ruleBasedOutfit(nil, nil, time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC))
	if len(got) != 0 {
		t.Errorf("expected no items for empty wardrobe, got %d", len(got))
	}
}

func TestRuleBasedOutfit_NoSlotMatchesFallsBackToFirstItem(t *testing.T) {
	// An item whose sub-type maps to no slot (none exist today, so simulate by
	// checking the items[:1] fallback with slot-less selection impossible):
	// a wardrobe of one bottom still returns that bottom, never zero items.
	items := []*wardrobe.ClothingItem{
		item("jeans", wardrobe.SubTypeJeans, wardrobe.SeasonAll),
	}
	got := ruleBasedOutfit(items, nil, time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC))
	if len(got) != 1 || got[0].ID != "jeans" {
		t.Errorf("expected the single item to be returned, got %v", ids(got))
	}
}
