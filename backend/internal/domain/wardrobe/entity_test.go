package wardrobe

import (
	"errors"
	"testing"
)

func TestParseCategory(t *testing.T) {
	valid := map[string]Category{
		"formal": CategoryFormal,
		"casual": CategoryCasual,
		"sport":  CategorySport,
	}
	for in, want := range valid {
		got, err := ParseCategory(in)
		if err != nil {
			t.Errorf("ParseCategory(%q): unexpected error %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("ParseCategory(%q) = %v, want %v", in, got, want)
		}
		if got.String() != in {
			t.Errorf("Category(%v).String() = %q, want %q", got, got.String(), in)
		}
	}

	for _, in := range []string{"", "Formal", "bogus"} {
		if _, err := ParseCategory(in); !errors.Is(err, ErrInvalidClassification) {
			t.Errorf("ParseCategory(%q): error = %v, want ErrInvalidClassification", in, err)
		}
	}
}

func TestParseSubType(t *testing.T) {
	valid := map[string]SubType{
		"shirt": SubTypeShirt, "t-shirt": SubTypeTShirt, "jeans": SubTypeJeans,
		"sneakers": SubTypeSneakers, "blazer": SubTypeBlazer,
	}
	for in, want := range valid {
		got, err := ParseSubType(in)
		if err != nil {
			t.Errorf("ParseSubType(%q): unexpected error %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("ParseSubType(%q) = %v, want %v", in, got, want)
		}
		if got.String() != in {
			t.Errorf("SubType(%v).String() = %q, want %q", got, got.String(), in)
		}
	}

	if _, err := ParseSubType("cardigan"); !errors.Is(err, ErrInvalidClassification) {
		t.Errorf("ParseSubType(cardigan): error = %v, want ErrInvalidClassification", err)
	}
}

func TestParseColor(t *testing.T) {
	valid := map[string]Color{
		"black": ColorBlack, "navy blue": ColorNavyBlue, "multicolor": ColorMulticolor,
	}
	for in, want := range valid {
		got, err := ParseColor(in)
		if err != nil {
			t.Errorf("ParseColor(%q): unexpected error %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("ParseColor(%q) = %v, want %v", in, got, want)
		}
		if got.String() != in {
			t.Errorf("Color(%v).String() = %q, want %q", got, got.String(), in)
		}
	}

	if _, err := ParseColor("turquoise"); !errors.Is(err, ErrInvalidClassification) {
		t.Errorf("ParseColor(turquoise): error = %v, want ErrInvalidClassification", err)
	}
}

func TestParseFit(t *testing.T) {
	valid := map[string]Fit{
		"slim": FitSlim, "regular": FitRegular, "relaxed": FitRelaxed, "oversized": FitOversized,
	}
	for in, want := range valid {
		got, err := ParseFit(in)
		if err != nil {
			t.Errorf("ParseFit(%q): unexpected error %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("ParseFit(%q) = %v, want %v", in, got, want)
		}
		if got.String() != in {
			t.Errorf("Fit(%v).String() = %q, want %q", got, got.String(), in)
		}
	}

	if _, err := ParseFit("baggy"); !errors.Is(err, ErrInvalidClassification) {
		t.Errorf("ParseFit(baggy): error = %v, want ErrInvalidClassification", err)
	}
}

func TestParseSeason(t *testing.T) {
	valid := map[string]Season{
		"all": SeasonAll, "spring_summer": SeasonSpringSummer,
		"autumn_winter": SeasonAutumnWinter, "winter": SeasonWinter,
	}
	for in, want := range valid {
		got, err := ParseSeason(in)
		if err != nil {
			t.Errorf("ParseSeason(%q): unexpected error %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("ParseSeason(%q) = %v, want %v", in, got, want)
		}
		if got.String() != in {
			t.Errorf("Season(%v).String() = %q, want %q", got, got.String(), in)
		}
	}

	if _, err := ParseSeason("monsoon"); !errors.Is(err, ErrInvalidClassification) {
		t.Errorf("ParseSeason(monsoon): error = %v, want ErrInvalidClassification", err)
	}
}
