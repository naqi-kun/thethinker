package recommendation

import (
	"context"
	"fmt"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/workschedule"
)

// Outfit is a recommendation for a given day: the occasion derived from the
// user's work schedule, a weather snapshot, and the chosen wardrobe items.
type Outfit struct {
	Date      time.Time
	Occasion  string
	IsWorkday bool
	Weather   *weather.Conditions
	Items     []*wardrobe.ClothingItem
}

type Service struct {
	wardrobeRepo wardrobe.Repository
	calendarRepo calendar.Repository
	weatherSvc   *weather.Service
	scheduleSvc  *workschedule.Service
}

func NewService(
	wardrobeRepo wardrobe.Repository,
	calendarRepo calendar.Repository,
	weatherSvc *weather.Service,
	scheduleSvc *workschedule.Service,
) *Service {
	return &Service{
		wardrobeRepo: wardrobeRepo,
		calendarRepo: calendarRepo,
		weatherSvc:   weatherSvc,
		scheduleSvc:  scheduleSvc,
	}
}

// GetOutfit produces a work-aware outfit recommendation for the given date.
// The occasion is driven by the user's working schedule and holidays
// (KAN-49 criterion 8): a working day yields a "Work" (formal) outfit, a
// holiday or non-working day yields a relaxed "Day off" / "Holiday" outfit.
func (s *Service) GetOutfit(ctx context.Context, userID string, date time.Time) (*Outfit, error) {
	sched, err := s.scheduleSvc.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	working := sched.IsWorkingDay(date)
	occasion := "Day off"
	switch {
	case sched.IsHoliday(date):
		occasion = "Holiday"
	case working:
		occasion = "Work"
	}

	items, err := s.wardrobeRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("recommendation: load wardrobe: %w", err)
	}

	conditions, err := s.weatherSvc.GetConditions(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("recommendation: weather: %w", err)
	}

	return &Outfit{
		Date:      date,
		Occasion:  occasion,
		IsWorkday: working,
		Weather:   conditions,
		Items:     selectOutfit(items, working),
	}, nil
}

// selectOutfit picks a coherent set of items for the day. On a working day it
// prefers formal pieces; otherwise casual. It assembles one top, one bottom, and
// footwear (or a dress + footwear), falling back to the whole wardrobe if the
// preferred style has nothing.
func selectOutfit(items []*wardrobe.ClothingItem, working bool) []*wardrobe.ClothingItem {
	target := wardrobe.CategoryCasual
	if working {
		target = wardrobe.CategoryFormal
	}

	pool := make([]*wardrobe.ClothingItem, 0, len(items))
	for _, it := range items {
		if it.Category == target {
			pool = append(pool, it)
		}
	}
	if len(pool) == 0 {
		pool = items // fall back so we still suggest something
	}

	var top, bottom, footwear, dress *wardrobe.ClothingItem
	for _, it := range pool {
		switch slotOf(it.SubType) {
		case slotTop:
			if top == nil {
				top = it
			}
		case slotBottom:
			if bottom == nil {
				bottom = it
			}
		case slotFootwear:
			if footwear == nil {
				footwear = it
			}
		case slotDress:
			if dress == nil {
				dress = it
			}
		}
	}

	var chosen []*wardrobe.ClothingItem
	if dress != nil {
		chosen = append(chosen, dress)
	} else {
		if top != nil {
			chosen = append(chosen, top)
		}
		if bottom != nil {
			chosen = append(chosen, bottom)
		}
	}
	if footwear != nil {
		chosen = append(chosen, footwear)
	}
	return chosen
}

type slot int

const (
	slotOther slot = iota
	slotTop
	slotBottom
	slotFootwear
	slotDress
)

func slotOf(st wardrobe.SubType) slot {
	switch st {
	case wardrobe.SubTypeShirt, wardrobe.SubTypeTShirt, wardrobe.SubTypeSweater,
		wardrobe.SubTypeHoodie, wardrobe.SubTypeJacket, wardrobe.SubTypeCoat,
		wardrobe.SubTypeSuit, wardrobe.SubTypeBlazer:
		return slotTop
	case wardrobe.SubTypePants, wardrobe.SubTypeJeans, wardrobe.SubTypeShorts,
		wardrobe.SubTypeSkirt:
		return slotBottom
	case wardrobe.SubTypeShoes, wardrobe.SubTypeSneakers, wardrobe.SubTypeBoots:
		return slotFootwear
	case wardrobe.SubTypeDress:
		return slotDress
	default:
		return slotOther
	}
}
