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
	Watch       *wardrobe.ClothingItem // nil if no suitable match found
	Bag         *wardrobe.ClothingItem // nil if no suitable match found
	Belt        *wardrobe.ClothingItem // nil if no suitable match found
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
	WatchID   string // optional
	BagID     string // optional
	BeltID    string // optional
	Reasoning string
}

// RecBrief carries the situational signals the stylist should dress for, beyond
// the wardrobe itself. All fields are optional — an empty/nil field means "no
// constraint" and the stylist falls back to general styling.
type RecBrief struct {
	Occasion  string              // wardrobe occasion category: "casual" | "formal" | "sport" | "everyday"
	EventName string              // human label of the chosen calendar event, for prompt context
	Aesthetic string              // the user's chosen aesthetic/vibe, e.g. "minimalist"
	Weather   *weather.Conditions // current conditions to dress for; nil when location/weather is unknown
}
