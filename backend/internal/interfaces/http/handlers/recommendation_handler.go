package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type recommendationSvc interface {
	GetOutfit(ctx context.Context, userID string, date time.Time, sessionID, occasion, eventID string) (*recommendation.OutfitRecommendation, error)
	AcceptAndRecord(ctx context.Context, userID, sessionID string, itemIDs []string) error
}

// validOccasions are the occasion values accepted on the query string — they
// mirror the wardrobe categories the recommender understands. Anything else is
// ignored so a stray value degrades to the calendar-derived default.
var validOccasions = map[string]bool{"casual": true, "formal": true, "sport": true}

type RecommendationHandler struct {
	svc recommendationSvc
}

func NewRecommendationHandler(svc recommendationSvc) *RecommendationHandler {
	return &RecommendationHandler{svc: svc}
}

type weatherResponse struct {
	Temperature float64 `json:"temperature"`
	FeelsLike   float64 `json:"feels_like"`
	Description string  `json:"description"`
	Location    string  `json:"location,omitempty"`
	ObservedAt  string  `json:"observed_at,omitempty"`
}

type outfitResponse struct {
	SessionID   string                 `json:"session_id"`
	Date        string                 `json:"date"`
	Recommender string                 `json:"recommender"`
	Reasoning   string                 `json:"reasoning,omitempty"`
	Occasion    string                 `json:"occasion,omitempty"`
	Weather     *weatherResponse       `json:"weather,omitempty"`
	Items       []clothingItemResponse `json:"items"`
	Watch       *clothingItemResponse  `json:"watch,omitempty"`
	Bag         *clothingItemResponse  `json:"bag,omitempty"`
	Belt        *clothingItemResponse  `json:"belt,omitempty"`
}

func (h *RecommendationHandler) GetOutfit(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	date := time.Now()
	if d := r.URL.Query().Get("date"); d != "" {
		parsed, err := time.Parse("2006-01-02", d)
		if err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid date format, use YYYY-MM-DD")
			return
		}
		date = parsed
	}

	sessionID := r.URL.Query().Get("session_id")
	eventID := r.URL.Query().Get("event_id")
	occasion := r.URL.Query().Get("occasion")
	if occasion != "" && !validOccasions[occasion] {
		occasion = "" // ignore unknown values; fall back to the calendar default
	}

	rec, err := h.svc.GetOutfit(r.Context(), userID, date, sessionID, occasion, eventID)
	if err != nil {
		if errors.Is(err, recommendation.ErrEmptyWardrobe) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "no items in wardrobe")
			return
		}
		log.Printf("GetOutfit failed for user %s: %v", userID, err)
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get recommendation")
		return
	}
	if rec == nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "no recommendation returned")
		return
	}

	items := make([]clothingItemResponse, len(rec.Items))
	for i, item := range rec.Items {
		items[i] = toItemResponse(item)
	}

	var wr *weatherResponse
	if rec.Weather != nil {
		wr = &weatherResponse{
			Temperature: rec.Weather.Temperature,
			FeelsLike:   rec.Weather.FeelsLike,
			Description: rec.Weather.Description,
			Location:    rec.Weather.Location,
		}
		if !rec.Weather.ObservedAt.IsZero() {
			wr.ObservedAt = rec.Weather.ObservedAt.UTC().Format(time.RFC3339)
		}
	}

	var watch, bag, belt *clothingItemResponse
	if rec.Watch != nil {
		w := toItemResponse(rec.Watch)
		watch = &w
	}
	if rec.Bag != nil {
		b := toItemResponse(rec.Bag)
		bag = &b
	}
	if rec.Belt != nil {
		be := toItemResponse(rec.Belt)
		belt = &be
	}

	writeJSON(w, http.StatusOK, outfitResponse{
		SessionID:   rec.SessionID,
		Date:        rec.Date.Format("2006-01-02"),
		Recommender: string(rec.Recommender),
		Reasoning:   rec.Reasoning,
		Occasion:    rec.Occasion,
		Weather:     wr,
		Items:       items,
		Watch:       watch,
		Bag:         bag,
		Belt:        belt,
	})
}

type acceptOutfitRequest struct {
	ItemIDs   []string `json:"item_ids"`
	SessionID string   `json:"session_id"`
}

func (h *RecommendationHandler) AcceptOutfit(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	var req acceptOutfitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.ItemIDs) == 0 {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "item_ids is required")
		return
	}

	if err := h.svc.AcceptAndRecord(r.Context(), userID, req.SessionID, req.ItemIDs); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to accept outfit")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
