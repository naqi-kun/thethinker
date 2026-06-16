package recommendation

import (
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

type Recommender string

const (
	RecommenderAI        Recommender = "ai"
	RecommenderRuleBased Recommender = "rule_based"
)

type OutfitRecommendation struct {
	SessionID   string
	UserID      string
	Date        time.Time
	Items       []*wardrobe.ClothingItem
	Occasion    string
	Weather     *weather.Conditions // nil when location is unknown
	Recommender Recommender
	Reasoning   string // one-sentence AI rationale; empty for the rule-based fallback
	CreatedAt   time.Time
}

// AIRec holds the raw item IDs and styling rationale returned by the AI
// recommendation service.
type AIRec struct {
	TopID     string
	BottomID  string
	ShoesID   string
	Reasoning string
}
