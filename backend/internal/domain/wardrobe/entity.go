package wardrobe

import (
	"errors"
	"time"
)

var ErrInvalidClassification = errors.New("invalid category, fit, or season value")

var validCategory = map[string]bool{"formal": true, "casual": true, "sport": true}
var validFit = map[string]bool{"slim": true, "regular": true, "relaxed": true, "oversized": true}
var validSeason = map[string]bool{"all": true, "spring_summer": true, "autumn_winter": true, "winter": true}

type ClothingItem struct {
	ID        string
	UserID    string
	Category  string // "formal" | "casual" | "sport"
	SubType   string // "shirt" | "pants" | "shoes" | etc.
	Color     string
	Fit       string // "slim" | "regular" | "relaxed" | "oversized"
	Season    string // "all" | "spring_summer" | "autumn_winter" | "winter"
	ImageURL  string
	LastWorn  *time.Time
	CreatedAt time.Time
}

func (c *ClothingItem) Validate() error {
	if !validCategory[c.Category] {
		return ErrInvalidClassification
	}
	if !validFit[c.Fit] {
		return ErrInvalidClassification
	}
	if !validSeason[c.Season] {
		return ErrInvalidClassification
	}
	return nil
}
