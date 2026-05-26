package wardrobe

import "time"

type ClothingItem struct {
	ID        string
	UserID    string
	Category  string // "formal" | "casual" | "sport"
	SubType   string // "shirt" | "pants" | "shoes" | etc.
	Color     string
	ImageURL  string
	LastWorn  *time.Time
	CreatedAt time.Time
}
