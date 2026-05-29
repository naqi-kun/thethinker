package recommendation

import (
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

// TODO: implement GetOutfit(ctx, userID, date)
// considers: next calendar event type, current weather, wardrobe catalog, outfit history
