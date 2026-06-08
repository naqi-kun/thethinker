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
	GetOutfit(ctx context.Context, userID string, date time.Time) (*recommendation.OutfitRecommendation, error)
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

type outfitResponse struct {
	Date     string                 `json:"date"`
	Occasion string                 `json:"occasion,omitempty"`
	Items    []clothingItemResponse `json:"items"`
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

	rec, err := h.svc.GetOutfit(r.Context(), userID, date)
	if err != nil {
		if errors.Is(err, recommendation.ErrEmptyWardrobe) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "no items in wardrobe")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get recommendation")
		return
	}

	items := make([]clothingItemResponse, len(rec.Items))
	for i, item := range rec.Items {
		items[i] = toItemResponse(item)
	}

	writeJSON(w, http.StatusOK, outfitResponse{
		Date:     rec.Date.Format("2006-01-02"),
		Occasion: rec.Occasion,
		Items:    items,
	})
}

type acceptOutfitRequest struct {
	ItemIDs []string `json:"item_ids"`
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

	w.WriteHeader(http.StatusNoContent)
}
