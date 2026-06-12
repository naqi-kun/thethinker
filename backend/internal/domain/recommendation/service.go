package recommendation

import (
	"context"
	"errors"
	"math/rand"
	"sort"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

// AIRecommender is implemented by the infrastructure AI client.
type AIRecommender interface {
	StartSession(ctx context.Context, items []*wardrobe.ClothingItem) (sessionID string, rec AIRec, err error)
	Regenerate(ctx context.Context, sessionID string) (AIRec, error)
	Accept(ctx context.Context, sessionID string) error
}

// userPrefsReader is a minimal interface for reading a user's saved preferences.
// Only FindPreferences is needed here; the full user.Repository satisfies it.
type userPrefsReader interface {
	FindPreferences(ctx context.Context, userID string) (*user.Preferences, error)
}

type Service struct {
	wardrobeRepo  wardrobe.Repository
	calendarRepo  calendar.Repository
	userPrefsRepo userPrefsReader
	weatherSvc    *weather.Service
	aiRecommender AIRecommender
	historyRepo   OutfitHistoryRepository
	transactor    Transactor
}

func NewService(
	wardrobeRepo wardrobe.Repository,
	calendarRepo calendar.Repository,
	userPrefsRepo userPrefsReader,
	weatherSvc *weather.Service,
	aiRecommender AIRecommender,
	historyRepo OutfitHistoryRepository,
	transactor Transactor,
) *Service {
	return &Service{
		wardrobeRepo:  wardrobeRepo,
		calendarRepo:  calendarRepo,
		userPrefsRepo: userPrefsRepo,
		weatherSvc:    weatherSvc,
		aiRecommender: aiRecommender,
		historyRepo:   historyRepo,
		transactor:    transactor,
	}
}

// GetOutfit returns an outfit recommendation.
// Pass sessionID="" to start a new AI session; pass an existing sessionID to
// regenerate (the AI will avoid the previously rejected combination).
func (s *Service) GetOutfit(ctx context.Context, userID string, date time.Time, sessionID string) (*OutfitRecommendation, error) {
	items, err := s.wardrobeRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrEmptyWardrobe
	}

	var rec AIRec
	if sessionID == "" {
		sessionID, rec, err = s.aiRecommender.StartSession(ctx, items)
	} else {
		rec, err = s.aiRecommender.Regenerate(ctx, sessionID)
		if err != nil {
			// Session expired (AI service restarted) — start a new one instead.
			if isSessionNotFound(err) {
				sessionID, rec, err = s.aiRecommender.StartSession(ctx, items)
			}
		}
	}
	if err != nil {
		return nil, err
	}

	selected := pickItemsByID(items, rec)
	if len(selected) == 0 {
		selected = pickOutfit(items)
	}

	// Best-effort weather lookup — never blocks the recommendation.
	var conditions *weather.Conditions
	if prefs, err := s.userPrefsRepo.FindPreferences(ctx, userID); err == nil && prefs != nil {
		if loc := prefs.Answers["location"]; loc != "" {
			if cond, err := s.weatherSvc.GetConditions(ctx, loc); err == nil {
				conditions = cond
			}
		}
	}

	return &OutfitRecommendation{
		SessionID: sessionID,
		UserID:    userID,
		Date:      date,
		Items:     selected,
		Occasion:  "casual",
		Weather:   conditions,
		CreatedAt: time.Now(),
	}, nil
}

// AcceptSession signals to the AI service that the user accepted the current
// outfit, ending the rejection-tracking loop for this session.
func (s *Service) AcceptSession(ctx context.Context, sessionID string) error {
	if sessionID == "" {
		return nil
	}
	if err := s.aiRecommender.Accept(ctx, sessionID); err != nil && !isSessionNotFound(err) {
		return err
	}
	return nil
}

// AcceptAndRecord atomically marks the given items as worn and records an
// AcceptedOutfit in outfit_history.
func (s *Service) AcceptAndRecord(ctx context.Context, userID, sessionID string, itemIDs []string) error {
	now := time.Now().UTC()

	var historyItems []*AcceptedOutfitItem
	for _, id := range itemIDs {
		item, err := s.wardrobeRepo.FindByID(ctx, id)
		if err != nil || item == nil {
			continue
		}
		historyItems = append(historyItems, &AcceptedOutfitItem{
			ItemID:   item.ID,
			ImageURL: item.ImageURL,
			Category: item.Category.String(),
			SubType:  item.SubType.String(),
			Color:    item.Color.String(),
			Fit:      item.Fit.String(),
			Season:   item.Season.String(),
		})
	}

	var ws *WeatherSnapshot
	if cond, err := s.weatherSvc.GetConditions(ctx, ""); err == nil {
		ws = &WeatherSnapshot{
			Temperature: float64(cond.Temperature),
			FeelsLike:   float64(cond.FeelsLike),
			Description: cond.Description,
		}
	}

	outfit := &AcceptedOutfit{
		UserID:          userID,
		SessionID:       sessionID,
		WornOn:          now.Truncate(24 * time.Hour),
		TimeOfDay:       DeriveTimeOfDay(now),
		WeatherSnapshot: ws,
		Items:           historyItems,
		CreatedAt:       now,
	}

	if err := s.transactor.InTransaction(ctx, func(ctx context.Context) error {
		if err := s.wardrobeRepo.MarkWorn(ctx, userID, itemIDs, now); err != nil {
			return err
		}
		return s.historyRepo.Save(ctx, outfit)
	}); err != nil {
		return err
	}

	if sessionID != "" {
		_ = s.aiRecommender.Accept(ctx, sessionID)
	}

	return nil
}

func isSessionNotFound(err error) bool {
	return errors.Is(err, ErrSessionNotFound)
}

// ── item selection helpers ─────────────────────────────────────────────────────

// pickItemsByID maps the AI-returned IDs back to full ClothingItem objects.
func pickItemsByID(items []*wardrobe.ClothingItem, rec AIRec) []*wardrobe.ClothingItem {
	index := make(map[string]*wardrobe.ClothingItem, len(items))
	for _, item := range items {
		index[item.ID] = item
	}
	var result []*wardrobe.ClothingItem
	for _, id := range []string{rec.TopID, rec.BottomID, rec.ShoesID} {
		if id == "" {
			continue
		}
		if item, ok := index[id]; ok {
			result = append(result, item)
		}
	}
	return result
}

// pickOutfit is the deterministic fallback used when AI selection yields nothing.
func pickOutfit(items []*wardrobe.ClothingItem) []*wardrobe.ClothingItem {
	var tops, bottoms, footwear []*wardrobe.ClothingItem
	for _, item := range items {
		switch item.SubType {
		case wardrobe.SubTypeShirt, wardrobe.SubTypeTShirt, wardrobe.SubTypeSweater,
			wardrobe.SubTypeHoodie, wardrobe.SubTypeJacket, wardrobe.SubTypeCoat,
			wardrobe.SubTypeBlazer, wardrobe.SubTypeSuit:
			tops = append(tops, item)
		case wardrobe.SubTypePants, wardrobe.SubTypeJeans, wardrobe.SubTypeShorts,
			wardrobe.SubTypeSkirt, wardrobe.SubTypeDress:
			bottoms = append(bottoms, item)
		case wardrobe.SubTypeShoes, wardrobe.SubTypeSneakers, wardrobe.SubTypeBoots:
			footwear = append(footwear, item)
		}
	}

	var result []*wardrobe.ClothingItem
	if top := leastRecentlyWorn(tops); top != nil {
		result = append(result, top)
	}
	if bottom := leastRecentlyWorn(bottoms); bottom != nil {
		result = append(result, bottom)
	}
	if shoe := leastRecentlyWorn(footwear); shoe != nil {
		result = append(result, shoe)
	}

	if len(result) == 0 {
		return items[:1]
	}
	return result
}

func leastRecentlyWorn(items []*wardrobe.ClothingItem) *wardrobe.ClothingItem {
	if len(items) == 0 {
		return nil
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].LastWorn == nil {
			return true
		}
		if items[j].LastWorn == nil {
			return false
		}
		return items[i].LastWorn.Before(*items[j].LastWorn)
	})
	first := items[0]
	tied := []*wardrobe.ClothingItem{first}
	for _, item := range items[1:] {
		if first.LastWorn == nil {
			if item.LastWorn == nil {
				tied = append(tied, item)
			} else {
				break
			}
		} else if item.LastWorn != nil && !item.LastWorn.After(*first.LastWorn) {
			tied = append(tied, item)
		} else {
			break
		}
	}
	return tied[rand.Intn(len(tied))]
}
