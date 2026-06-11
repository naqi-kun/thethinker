package recommendation

import (
	"context"
	"time"
)

type TimeOfDay string

const (
	TimeOfDayMorning   TimeOfDay = "morning"
	TimeOfDayAfternoon TimeOfDay = "afternoon"
	TimeOfDayEvening   TimeOfDay = "evening"
)

func DeriveTimeOfDay(t time.Time) TimeOfDay {
	h := t.UTC().Hour()
	switch {
	case h < 12:
		return TimeOfDayMorning
	case h < 17:
		return TimeOfDayAfternoon
	default:
		return TimeOfDayEvening
	}
}

type WeatherSnapshot struct {
	Temperature float64 `json:"temperature"`
	FeelsLike   float64 `json:"feels_like"`
	Description string  `json:"description"`
}

type AcceptedOutfitItem struct {
	ItemID   string
	ImageURL string
	Category string
	SubType  string
	Color    string
	Fit      string
	Season   string
}

type AcceptedOutfit struct {
	ID              string
	UserID          string
	SessionID       string
	Occasion        string
	WornOn          time.Time
	TimeOfDay       TimeOfDay
	WeatherSnapshot *WeatherSnapshot
	Items           []*AcceptedOutfitItem
	CreatedAt       time.Time
}

type HistoryFilter struct {
	Range     string
	TimeOfDay string
}

type Transactor interface {
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type OutfitHistoryRepository interface {
	Save(ctx context.Context, outfit *AcceptedOutfit) error
	List(ctx context.Context, userID string, cursor string, limit int, filter HistoryFilter) ([]*AcceptedOutfit, string, error)
}
