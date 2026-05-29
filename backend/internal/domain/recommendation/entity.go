package recommendation

import "time"

type OutfitRecommendation struct {
	UserID    string
	Date      time.Time
	ItemIDs   []string // clothing item IDs from wardrobe
	Occasion  string
	Weather   string
	CreatedAt time.Time
}
