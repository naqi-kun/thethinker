package recommendation

import (
	"context"
	"errors"
	"log"
	"math/rand"
	"sort"
	"strings"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
)

// AIRecommender is implemented by the infrastructure AI client.
type AIRecommender interface {
	StartSession(ctx context.Context, items []*wardrobe.ClothingItem, brief RecBrief) (sessionID string, rec AIRec, err error)
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
// If the user has disabled AI (use_ai=false) or the AI service is unavailable,
// a rule-based fallback is used instead.
func (s *Service) GetOutfit(ctx context.Context, userID string, date time.Time, sessionID, occasionParam, eventID string) (*OutfitRecommendation, error) {
	items, err := s.wardrobeRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrEmptyWardrobe
	}

	// Only suggest items that are currently clean.
	clean := items[:0]
	for _, item := range items {
		if item.Status == wardrobe.StatusClean {
			clean = append(clean, item)
		}
	}
	items = clean
	if len(items) == 0 {
		return nil, ErrEmptyWardrobe
	}

	// Best-effort prefs + weather lookup — neither blocks the recommendation.
	var conditions *weather.Conditions
	useAI := true
	var aesthetic string
	if prefs, err := s.userPrefsRepo.FindPreferences(ctx, userID); err == nil && prefs != nil {
		useAI = prefs.UseAI
		aesthetic = readAesthetic(prefs)
		if loc := prefs.Answers["location"]; loc != "" {
			if cond, err := s.weatherSvc.GetConditions(ctx, loc); err == nil {
				conditions = cond
			}
		}
	}

	// Resolve the occasion to dress for: an explicitly chosen event or occasion,
	// else the day's most-formal calendar event, else everyday wear.
	occasion, occasionLabel := s.resolveOccasion(ctx, userID, date, eventID, occasionParam)
	brief := RecBrief{Occasion: occasion, EventName: occasionLabel, Aesthetic: aesthetic, Weather: conditions}

	var selected []*wardrobe.ClothingItem
	var reasoning string
	var rec AIRec
	recommender := RecommenderRuleBased
	if useAI {
		if sessionID == "" {
			sessionID, rec, err = s.startAISession(ctx, items, brief)
		} else {
			rec, err = s.aiRecommender.Regenerate(ctx, sessionID)
			if err != nil && sessionRecoverable(err) {
				// The session is unusable — the AI lost it (404), errored on it
				// (5xx, commonly after a restart), or was briefly unreachable.
				// Discard it and start a fresh session; if that also fails we fall
				// through to the rule-based fallback below rather than surfacing an
				// error to the client.
				log.Printf("recommendation: regenerate failed for user %s (%v); starting a fresh AI session", userID, err)
				sessionID, rec, err = s.startAISession(ctx, items, brief)
			}
		}
		if err == nil {
			selected = pickItemsByID(items, rec)
			reasoning = rec.Reasoning
			recommender = RecommenderAI
		} else {
			log.Printf("recommendation: AI unavailable for user %s, falling back to rule-based: %v", userID, err)
		}
	}

	if len(selected) == 0 {
		// Rule-based fallback: used when use_ai=false or AI service is unavailable.
		sessionID = "" // no session ID for rule-based recommendations
		recommender = RecommenderRuleBased
		selected = ruleBasedOutfit(items, conditions, date)
	}

	return &OutfitRecommendation{
		SessionID:   sessionID,
		UserID:      userID,
		Date:        date,
		Items:       selected,
		Watch:       pickItemByID(items, rec.WatchID),
		Bag:         pickItemByID(items, rec.BagID),
		Belt:        pickItemByID(items, rec.BeltID),
		Occasion:    occasionLabel,
		Weather:     conditions,
		Recommender: recommender,
		Reasoning:   reasoning,
		CreatedAt:   time.Now(),
	}, nil
}

// ── occasion + aesthetic resolution ─────────────────────────────────────────────

// readAesthetic pulls the user's chosen aesthetic/vibe out of saved preferences.
// The current onboarding stores it under "aesthetic"; older data (and the legacy
// multi-select inspiration step) used "inspiration" as a comma-joined list, so we
// fall back to the first entry there.
func readAesthetic(prefs *user.Preferences) string {
	if a := strings.TrimSpace(prefs.Answers["aesthetic"]); a != "" {
		return a
	}
	if insp := prefs.Answers["inspiration"]; insp != "" {
		if first := strings.TrimSpace(strings.Split(insp, ",")[0]); first != "" {
			return first
		}
	}
	return ""
}

// eventOccasion maps a calendar Event.Type onto a wardrobe occasion category.
func eventOccasion(eventType string) string {
	switch eventType {
	case "meeting":
		return "formal"
	case "sport":
		return "sport"
	default:
		return "casual"
	}
}

// occasionFormality ranks occasions so the default can pick the most-formal event
// of the day — the user is never left underdressed.
func occasionFormality(occasion string) int {
	switch occasion {
	case "formal":
		return 3
	case "casual":
		return 2
	case "sport":
		return 1
	default:
		return 0
	}
}

// resolveOccasion decides what occasion to dress for and a human-readable label
// for it. Precedence: an explicitly chosen event_id, then an explicit occasion
// override, then the day's most-formal calendar event, then everyday wear.
// The calendar lookup is best-effort — a failure degrades to everyday wear.
func (s *Service) resolveOccasion(ctx context.Context, userID string, date time.Time, eventID, occasionParam string) (occasion, label string) {
	events, _ := s.calendarRepo.FindEventsByDate(ctx, userID, date)

	// 1. A specific event the user chose to dress for.
	if eventID != "" {
		for _, ev := range events {
			if ev.ID == eventID {
				return eventOccasion(ev.Type), ev.Title
			}
		}
	}

	// 2. An explicit occasion override (the "Everyday"/manual path).
	if occasionParam != "" {
		return occasionParam, titleCase(occasionParam)
	}

	// 3. Default: dress for the most-formal (non-ignored) event of the day.
	var best *calendar.Event
	for _, ev := range events {
		if ev.Ignored {
			continue
		}
		if best == nil || occasionFormality(eventOccasion(ev.Type)) > occasionFormality(eventOccasion(best.Type)) {
			best = ev
		}
	}
	if best != nil {
		return eventOccasion(best.Type), best.Title
	}

	// 4. Nothing on the calendar — everyday wear.
	return "everyday", "Everyday"
}

func titleCase(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
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

// sessionRecoverable reports whether a failed Regenerate should be retried with a
// fresh AI session. A 404 means the session is gone; a 5xx means the AI errored on
// this specific session (commonly after a restart); a transport failure means the
// AI was briefly unreachable. In all three a brand-new session may still succeed.
// 4xx contract errors are not retried — they fall through to the rule-based
// fallback instead.
func sessionRecoverable(err error) bool {
	return errors.Is(err, ErrSessionNotFound) ||
		errors.Is(err, ErrAIServerError) ||
		errors.Is(err, ErrAIUnavailable)
}

// aiStartBackoff is the wait before each retry of a transient StartSession
// failure; one retry per entry. A package var so tests can shorten it. Kept
// short — it bridges a cold-start readiness gap or a transient reset, not a long
// outage (a long one degrades to rule-based, which is fine).
var aiStartBackoff = []time.Duration{150 * time.Millisecond, 400 * time.Millisecond}

// startAISession starts a fresh AI session, retrying transient failures (a
// cold-start EOF/connection reset or a 5xx) with a short backoff before giving
// up. Non-transient errors (4xx contract errors, generic failures) return
// immediately so the caller falls straight through to the rule-based fallback.
func (s *Service) startAISession(ctx context.Context, items []*wardrobe.ClothingItem, brief RecBrief) (string, AIRec, error) {
	sessionID, rec, err := s.aiRecommender.StartSession(ctx, items, brief)
	for attempt := 0; err != nil && transientAIError(err) && attempt < len(aiStartBackoff); attempt++ {
		log.Printf("recommendation: AI StartSession attempt %d failed (%v); retrying in %s", attempt+1, err, aiStartBackoff[attempt])
		select {
		case <-ctx.Done():
			return "", AIRec{}, ctx.Err()
		case <-time.After(aiStartBackoff[attempt]):
		}
		sessionID, rec, err = s.aiRecommender.StartSession(ctx, items, brief)
	}
	return sessionID, rec, err
}

// transientAIError reports whether an AI failure is worth retrying — a transient
// transport problem or a 5xx, as opposed to a generic/contract error.
func transientAIError(err error) bool {
	return errors.Is(err, ErrAIUnavailable) || errors.Is(err, ErrAIServerError)
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

// pickItemByID returns a single item by ID, or nil if not found.
func pickItemByID(items []*wardrobe.ClothingItem, id string) *wardrobe.ClothingItem {
	if id == "" {
		return nil
	}
	for _, item := range items {
		if item.ID == id {
			return item
		}
	}
	return nil
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
