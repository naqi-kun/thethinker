package recommendation

import (
	"context"
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/workschedule"
)

type fakeWardrobeRepo struct{ items []*wardrobe.ClothingItem }

func (r *fakeWardrobeRepo) FindByUserID(context.Context, string) ([]*wardrobe.ClothingItem, error) {
	return r.items, nil
}
func (r *fakeWardrobeRepo) FindByID(context.Context, string) (*wardrobe.ClothingItem, error) {
	return nil, nil
}
func (r *fakeWardrobeRepo) Save(context.Context, *wardrobe.ClothingItem) error  { return nil }
func (r *fakeWardrobeRepo) UpdateImageURL(context.Context, string, string) error { return nil }
func (r *fakeWardrobeRepo) Delete(context.Context, string) error                 { return nil }

type fakeScheduleRepo struct{ sched *workschedule.Schedule }

func (r *fakeScheduleRepo) Get(context.Context, string) (*workschedule.Schedule, error) {
	return r.sched, nil
}
func (r *fakeScheduleRepo) Save(_ context.Context, s *workschedule.Schedule) error {
	r.sched = s
	return nil
}

func sampleWardrobe() []*wardrobe.ClothingItem {
	return []*wardrobe.ClothingItem{
		{ID: "f-top", Category: wardrobe.CategoryFormal, SubType: wardrobe.SubTypeShirt},
		{ID: "f-bottom", Category: wardrobe.CategoryFormal, SubType: wardrobe.SubTypePants},
		{ID: "f-shoes", Category: wardrobe.CategoryFormal, SubType: wardrobe.SubTypeShoes},
		{ID: "c-top", Category: wardrobe.CategoryCasual, SubType: wardrobe.SubTypeTShirt},
		{ID: "c-bottom", Category: wardrobe.CategoryCasual, SubType: wardrobe.SubTypeJeans},
		{ID: "c-shoes", Category: wardrobe.CategoryCasual, SubType: wardrobe.SubTypeSneakers},
	}
}

func newSvc(sched *workschedule.Schedule) *Service {
	return NewService(
		&fakeWardrobeRepo{items: sampleWardrobe()},
		nil, // calendarRepo is unused by GetOutfit
		weather.NewService(),
		workschedule.NewService(&fakeScheduleRepo{sched: sched}),
	)
}

func assertAllCategory(t *testing.T, items []*wardrobe.ClothingItem, want wardrobe.Category) {
	t.Helper()
	if len(items) == 0 {
		t.Fatalf("expected items, got none")
	}
	for _, it := range items {
		if it.Category != want {
			t.Errorf("item %s category = %v, want %v", it.ID, it.Category, want)
		}
	}
}

func TestGetOutfit_WorkingDay(t *testing.T) {
	date := time.Date(2026, 6, 8, 12, 0, 0, 0, time.UTC)
	sched := &workschedule.Schedule{
		UserID:      "u",
		WorkingDays: []time.Weekday{date.Weekday()},
		WorkStart:   "09:00",
		WorkEnd:     "17:00",
	}
	out, err := newSvc(sched).GetOutfit(context.Background(), "u", date)
	if err != nil {
		t.Fatalf("GetOutfit: %v", err)
	}
	if out.Occasion != "Work" || !out.IsWorkday {
		t.Errorf("occasion = %q, isWorkday = %v; want Work/true", out.Occasion, out.IsWorkday)
	}
	assertAllCategory(t, out.Items, wardrobe.CategoryFormal)
	if out.Weather == nil {
		t.Errorf("expected a weather snapshot")
	}
}

func TestGetOutfit_DayOff(t *testing.T) {
	date := time.Date(2026, 6, 8, 12, 0, 0, 0, time.UTC)
	sched := &workschedule.Schedule{
		UserID:      "u",
		WorkingDays: []time.Weekday{}, // no working days -> day off
		WorkStart:   "09:00",
		WorkEnd:     "17:00",
	}
	out, err := newSvc(sched).GetOutfit(context.Background(), "u", date)
	if err != nil {
		t.Fatalf("GetOutfit: %v", err)
	}
	if out.Occasion != "Day off" || out.IsWorkday {
		t.Errorf("occasion = %q, isWorkday = %v; want Day off/false", out.Occasion, out.IsWorkday)
	}
	assertAllCategory(t, out.Items, wardrobe.CategoryCasual)
}

func TestGetOutfit_Holiday(t *testing.T) {
	date := time.Date(2026, 6, 8, 12, 0, 0, 0, time.UTC)
	sched := &workschedule.Schedule{
		UserID:      "u",
		WorkingDays: []time.Weekday{date.Weekday()},
		WorkStart:   "09:00",
		WorkEnd:     "17:00",
		Holidays:    []time.Time{date},
	}
	out, err := newSvc(sched).GetOutfit(context.Background(), "u", date)
	if err != nil {
		t.Fatalf("GetOutfit: %v", err)
	}
	if out.Occasion != "Holiday" || out.IsWorkday {
		t.Errorf("occasion = %q, isWorkday = %v; want Holiday/false", out.Occasion, out.IsWorkday)
	}
	assertAllCategory(t, out.Items, wardrobe.CategoryCasual)
}
