package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type recommendationSvc interface {
	GetOutfit(ctx context.Context, userID string, date time.Time, sessionID string) (*recommendation.OutfitRecommendation, error)
	AcceptSession(ctx context.Context, sessionID string) error
}

type wardrobeAccepter interface {
	MarkItemsWorn(ctx context.Context, userID string, itemIDs []string) error
}

type RecommendationHandler struct {
	svc         recommendationSvc
	wardrobeSvc wardrobeAccepter
}

func NewRecommendationHandler(svc recommendationSvc, wardrobeSvc wardrobeAccepter) *RecommendationHandler {
	return &RecommendationHandler{svc: svc, wardrobeSvc: wardrobeSvc}
}

type weatherResponse struct {
	Temperature float64 `json:"temperature"`
	FeelsLike   float64 `json:"feels_like"`
	Description string  `json:"description"`
	Location    string  `json:"location,omitempty"`
}

type outfitResponse struct {
	SessionID string                 `json:"session_id"`
	Date      string                 `json:"date"`
	Occasion  string                 `json:"occasion,omitempty"`
	Weather   *weatherResponse       `json:"weather,omitempty"`
	Items     []clothingItemResponse `json:"items"`
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

	rec, err := h.svc.GetOutfit(r.Context(), userID, date, sessionID)
	if err != nil {
		if errors.Is(err, recommendation.ErrEmptyWardrobe) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "no items in wardrobe")
			return
		}
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
	}

	writeJSON(w, http.StatusOK, outfitResponse{
		SessionID: rec.SessionID,
		Date:      rec.Date.Format("2006-01-02"),
		Occasion:  rec.Occasion,
		Weather:   wr,
		Items:     items,
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

	if err := h.wardrobeSvc.MarkItemsWorn(r.Context(), userID, req.ItemIDs); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to mark items as worn")
		return
	}

	// Close the AI session; non-fatal if it has already expired.
	_ = h.svc.AcceptSession(r.Context(), req.SessionID)

	w.WriteHeader(http.StatusNoContent)
}
