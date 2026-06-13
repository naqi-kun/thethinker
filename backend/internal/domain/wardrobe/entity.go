package wardrobe

import (
	"errors"
	"fmt"
	"time"
)

var ErrInvalidClassification = errors.New("invalid classification value")

// Category is the style category of a clothing item.
type Category int

const (
	CategoryFormal Category = iota
	CategoryCasual
	CategorySport
)

func (c Category) String() string {
	return [...]string{"formal", "casual", "sport"}[c]
}

func ParseCategory(s string) (Category, error) {
	switch s {
	case "formal":
		return CategoryFormal, nil
	case "casual":
		return CategoryCasual, nil
	case "sport":
		return CategorySport, nil
	default:
		return 0, fmt.Errorf("%w: category %q", ErrInvalidClassification, s)
	}
}

// SubType is the specific garment type.
type SubType int

const (
	SubTypeShirt SubType = iota
	SubTypeTShirt
	SubTypeSweater
	SubTypeHoodie
	SubTypeJacket
	SubTypeCoat
	SubTypePants
	SubTypeJeans
	SubTypeShorts
	SubTypeSkirt
	SubTypeDress
	SubTypeShoes
	SubTypeSneakers
	SubTypeBoots
	SubTypeSuit
	SubTypeBlazer
	// accessories
	SubTypeWatch
	SubTypeBag
	SubTypeBelt
	SubTypeHat
	SubTypeScarf
	SubTypeSunglasses
	SubTypeTie
)

func (s SubType) String() string {
	return [...]string{
		"shirt", "t-shirt", "sweater", "hoodie", "jacket", "coat",
		"pants", "jeans", "shorts", "skirt", "dress",
		"shoes", "sneakers", "boots", "suit", "blazer",
		"watch", "bag", "belt", "hat", "scarf", "sunglasses", "tie",
	}[s]
}

func ParseSubType(s string) (SubType, error) {
	m := map[string]SubType{
		"shirt": SubTypeShirt, "t-shirt": SubTypeTShirt, "sweater": SubTypeSweater,
		"hoodie": SubTypeHoodie, "jacket": SubTypeJacket, "coat": SubTypeCoat,
		"pants": SubTypePants, "jeans": SubTypeJeans, "shorts": SubTypeShorts,
		"skirt": SubTypeSkirt, "dress": SubTypeDress, "shoes": SubTypeShoes,
		"sneakers": SubTypeSneakers, "boots": SubTypeBoots, "suit": SubTypeSuit,
		"blazer": SubTypeBlazer,
		"watch":  SubTypeWatch, "bag": SubTypeBag, "belt": SubTypeBelt,
		"hat": SubTypeHat, "scarf": SubTypeScarf, "sunglasses": SubTypeSunglasses,
		"tie": SubTypeTie,
	}
	if v, ok := m[s]; ok {
		return v, nil
	}
	return 0, fmt.Errorf("%w: sub_type %q", ErrInvalidClassification, s)
}

// Color is the dominant color of a clothing item.
type Color int

const (
	ColorBlack Color = iota
	ColorWhite
	ColorGrey
	ColorNavyBlue
	ColorBlue
	ColorLightBlue
	ColorRed
	ColorBurgundy
	ColorGreen
	ColorOlive
	ColorBeige
	ColorBrown
	ColorYellow
	ColorOrange
	ColorPink
	ColorPurple
	ColorMulticolor
)

func (c Color) String() string {
	return [...]string{
		"black", "white", "grey", "navy blue", "blue", "light blue",
		"red", "burgundy", "green", "olive", "beige", "brown",
		"yellow", "orange", "pink", "purple", "multicolor",
	}[c]
}

func ParseColor(s string) (Color, error) {
	m := map[string]Color{
		"black": ColorBlack, "white": ColorWhite, "grey": ColorGrey,
		"navy blue": ColorNavyBlue, "blue": ColorBlue, "light blue": ColorLightBlue,
		"red": ColorRed, "burgundy": ColorBurgundy, "green": ColorGreen,
		"olive": ColorOlive, "beige": ColorBeige, "brown": ColorBrown,
		"yellow": ColorYellow, "orange": ColorOrange, "pink": ColorPink,
		"purple": ColorPurple, "multicolor": ColorMulticolor,
	}
	if v, ok := m[s]; ok {
		return v, nil
	}
	return 0, fmt.Errorf("%w: color %q", ErrInvalidClassification, s)
}

// Fit describes how a garment sits on the body.
type Fit int

const (
	FitSlim Fit = iota
	FitRegular
	FitRelaxed
	FitOversized
)

func (f Fit) String() string {
	return [...]string{"slim", "regular", "relaxed", "oversized"}[f]
}

func ParseFit(s string) (Fit, error) {
	switch s {
	case "slim":
		return FitSlim, nil
	case "regular":
		return FitRegular, nil
	case "relaxed":
		return FitRelaxed, nil
	case "oversized":
		return FitOversized, nil
	default:
		return 0, fmt.Errorf("%w: fit %q", ErrInvalidClassification, s)
	}
}

// Season is the seasonal suitability of a clothing item.
type Season int

const (
	SeasonAll Season = iota
	SeasonSpringSummer
	SeasonAutumnWinter
	SeasonWinter
)

func (s Season) String() string {
	return [...]string{"all", "spring_summer", "autumn_winter", "winter"}[s]
}

func ParseSeason(s string) (Season, error) {
	switch s {
	case "all":
		return SeasonAll, nil
	case "spring_summer":
		return SeasonSpringSummer, nil
	case "autumn_winter":
		return SeasonAutumnWinter, nil
	case "winter":
		return SeasonWinter, nil
	default:
		return 0, fmt.Errorf("%w: season %q", ErrInvalidClassification, s)
	}
}

type ClothingItem struct {
	ID        string
	UserID    string
	Name      string
	Category  Category
	SubType   SubType
	Color     Color
	Fit       Fit
	Season    Season
	ImageURL  string
	LastWorn  *time.Time
	CreatedAt time.Time
}
