package recommendation

import (
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

type OutfitRecommendation struct {
	SessionID string
	UserID    string
	Date      time.Time
	Items     []*wardrobe.ClothingItem
	Occasion  string
	Weather   *weather.Conditions // nil when location is unknown
	CreatedAt time.Time
}

// AIRec holds the raw item IDs returned by the AI recommendation service.
type AIRec struct {
	TopID    string
	BottomID string
	ShoesID  string
}
