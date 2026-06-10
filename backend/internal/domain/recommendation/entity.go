package recommendation

import (
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

type OutfitRecommendation struct {
	UserID    string
	Date      time.Time
	Items     []*wardrobe.ClothingItem
	Occasion  string
	CreatedAt time.Time
}
