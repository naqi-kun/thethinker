package recommendation

import (
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

// ruleBasedOutfit selects a top, bottom, and shoes using deterministic rules:
//  1. Filter by season suitability (derived from weather temperature or current month)
//  2. Within each slot pick the least-recently-worn item (random tiebreak)
//
// If filtering yields no candidates for a slot, the season filter is relaxed
// and all items of that slot type are considered.
func ruleBasedOutfit(items []*wardrobe.ClothingItem, conditions *weather.Conditions, now time.Time) []*wardrobe.ClothingItem {
	season := deriveSeason(conditions, now)

	var tops, bottoms, footwear []*wardrobe.ClothingItem
	for _, item := range items {
		if !seasonMatches(item.Season, season) {
			continue
		}
		slot := slotFor(item.SubType)
		switch slot {
		case "top":
			tops = append(tops, item)
		case "bottom":
			bottoms = append(bottoms, item)
		case "shoes":
			footwear = append(footwear, item)
		}
	}

	// Relax season filter for any empty slot.
	if len(tops) == 0 || len(bottoms) == 0 || len(footwear) == 0 {
		var fallTops, fallBottoms, fallFootwear []*wardrobe.ClothingItem
		for _, item := range items {
			switch slotFor(item.SubType) {
			case "top":
				fallTops = append(fallTops, item)
			case "bottom":
				fallBottoms = append(fallBottoms, item)
			case "shoes":
				fallFootwear = append(fallFootwear, item)
			}
		}
		if len(tops) == 0 {
			tops = fallTops
		}
		if len(bottoms) == 0 {
			bottoms = fallBottoms
		}
		if len(footwear) == 0 {
			footwear = fallFootwear
		}
	}

	var result []*wardrobe.ClothingItem
	if top := leastRecentlyWorn(tops); top != nil {
		result = append(result, top)
	}
	if bottom := leastRecentlyWorn(bottoms); bottom != nil {
		result = append(result, bottom)
	}
	if shoe := leastRecentlyWorn(footwear); shoe != nil {
		result = append(result, shoe)
	}

	if len(result) == 0 && len(items) > 0 {
		return items[:1]
	}
	return result
}

// currentSeason derives the wardrobe season tag from temperature (°C) or month.
type currentSeason int

const (
	seasonSpringSummer currentSeason = iota
	seasonAutumnWinter
	seasonWinter
)

func deriveSeason(conditions *weather.Conditions, now time.Time) currentSeason {
	if conditions != nil {
		switch {
		case conditions.Temperature >= 18:
			return seasonSpringSummer
		case conditions.Temperature >= 8:
			return seasonAutumnWinter
		default:
			return seasonWinter
		}
	}
	// No weather data — fall back to hemisphere-neutral month heuristic.
	switch now.Month() {
	case time.March, time.April, time.May, time.June, time.July, time.August:
		return seasonSpringSummer
	case time.September, time.October, time.November:
		return seasonAutumnWinter
	default: // December, January, February
		return seasonWinter
	}
}

// seasonMatches returns true if the item's season tag is suitable for the
// derived current season.
func seasonMatches(itemSeason wardrobe.Season, cur currentSeason) bool {
	if itemSeason == wardrobe.SeasonAll {
		return true
	}
	switch cur {
	case seasonSpringSummer:
		return itemSeason == wardrobe.SeasonSpringSummer
	case seasonAutumnWinter:
		return itemSeason == wardrobe.SeasonAutumnWinter
	case seasonWinter:
		return itemSeason == wardrobe.SeasonAutumnWinter || itemSeason == wardrobe.SeasonWinter
	}
	return true
}

// slotFor maps a SubType to a recommendation slot ("top", "bottom", "shoes", or "").
func slotFor(sub wardrobe.SubType) string {
	switch sub {
	case wardrobe.SubTypeShirt, wardrobe.SubTypeTShirt, wardrobe.SubTypeSweater,
		wardrobe.SubTypeHoodie, wardrobe.SubTypeJacket, wardrobe.SubTypeCoat,
		wardrobe.SubTypeBlazer, wardrobe.SubTypeSuit:
		return "top"
	case wardrobe.SubTypePants, wardrobe.SubTypeJeans, wardrobe.SubTypeShorts,
		wardrobe.SubTypeSkirt, wardrobe.SubTypeDress:
		return "bottom"
	case wardrobe.SubTypeShoes, wardrobe.SubTypeSneakers, wardrobe.SubTypeBoots:
		return "shoes"
	}
	return ""
}
