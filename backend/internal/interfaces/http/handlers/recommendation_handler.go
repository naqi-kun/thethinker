package handlers

import "net/http"

type RecommendationHandler struct {
	// TODO: svc *recommendation.Service
}

func NewRecommendationHandler( /* svc *recommendation.Service */ ) *RecommendationHandler {
	return &RecommendationHandler{}
}

func (h *RecommendationHandler) GetOutfit(w http.ResponseWriter, r *http.Request) {
	// TODO: parse optional date query param, call svc.GetOutfit, return recommendation
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
