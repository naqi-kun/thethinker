package recommendation

import (
	"context"
	"sort"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

type Service struct {
	wardrobeRepo wardrobe.Repository
	calendarRepo calendar.Repository
	weatherSvc   *weather.Service
}

func NewService(
	wardrobeRepo wardrobe.Repository,
	calendarRepo calendar.Repository,
	weatherSvc *weather.Service,
) *Service {
	return &Service{
		wardrobeRepo: wardrobeRepo,
		calendarRepo: calendarRepo,
		weatherSvc:   weatherSvc,
	}
}

func (s *Service) GetOutfit(ctx context.Context, userID string, date time.Time) (*OutfitRecommendation, error) {
	items, err := s.wardrobeRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrEmptyWardrobe
	}

	selected := pickOutfit(items)

	return &OutfitRecommendation{
		UserID:    userID,
		Date:      date,
		Items:     selected,
		Occasion:  "casual",
		CreatedAt: time.Now(),
	}, nil
}

func pickOutfit(items []*wardrobe.ClothingItem) []*wardrobe.ClothingItem {
	var tops, bottoms, footwear []*wardrobe.ClothingItem
	for _, item := range items {
		switch item.SubType {
		case wardrobe.SubTypeShirt, wardrobe.SubTypeTShirt, wardrobe.SubTypeSweater,
			wardrobe.SubTypeHoodie, wardrobe.SubTypeJacket, wardrobe.SubTypeCoat,
			wardrobe.SubTypeBlazer, wardrobe.SubTypeSuit:
			tops = append(tops, item)
		case wardrobe.SubTypePants, wardrobe.SubTypeJeans, wardrobe.SubTypeShorts,
			wardrobe.SubTypeSkirt, wardrobe.SubTypeDress:
			bottoms = append(bottoms, item)
		case wardrobe.SubTypeShoes, wardrobe.SubTypeSneakers, wardrobe.SubTypeBoots:
			footwear = append(footwear, item)
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

	if len(result) == 0 {
		return items[:1]
	}
	return result
}

func leastRecentlyWorn(items []*wardrobe.ClothingItem) *wardrobe.ClothingItem {
	if len(items) == 0 {
		return nil
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].LastWorn == nil {
			return true
		}
		if items[j].LastWorn == nil {
			return false
		}
		return items[i].LastWorn.Before(*items[j].LastWorn)
	})
	return items[0]
}
