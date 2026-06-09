package handlers

import (
	"net/http"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type RecommendationHandler struct {
	svc *recommendation.Service
}

func NewRecommendationHandler(svc *recommendation.Service) *RecommendationHandler {
	return &RecommendationHandler{svc: svc}
}

type weatherSnapshotResponse struct {
	Temperature float64 `json:"temperature"`
	FeelsLike   float64 `json:"feels_like"`
	Description string  `json:"description"`
}

type outfitResponse struct {
	Date     string                   `json:"date"`
	Occasion string                   `json:"occasion"`
	Weather  *weatherSnapshotResponse `json:"weather,omitempty"`
	Items    []clothingItemResponse   `json:"items"`
}

func (h *RecommendationHandler) GetOutfit(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	date := time.Now()
	if dateStr := r.URL.Query().Get("date"); dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "date must be in YYYY-MM-DD format")
			return
		}
		date = parsed
	}

	outfit, err := h.svc.GetOutfit(r.Context(), userID, date)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to build recommendation")
		return
	}

	resp := outfitResponse{
		Date:     outfit.Date.Format("2006-01-02"),
		Occasion: outfit.Occasion,
		Items:    make([]clothingItemResponse, len(outfit.Items)),
	}
	if outfit.Weather != nil {
		resp.Weather = &weatherSnapshotResponse{
			Temperature: outfit.Weather.Temperature,
			FeelsLike:   outfit.Weather.FeelsLike,
			Description: outfit.Weather.Description,
		}
	}
	for i, item := range outfit.Items {
		resp.Items[i] = toItemResponse(item)
	}

	writeJSON(w, http.StatusOK, resp)
}
