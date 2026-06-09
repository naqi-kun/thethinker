package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type wardrobeAccepter interface {
	MarkItemsWorn(ctx context.Context, userID string, itemIDs []string) error
}

type RecommendationHandler struct {
	wardrobeSvc wardrobeAccepter
}

func NewRecommendationHandler(wardrobeSvc wardrobeAccepter) *RecommendationHandler {
	return &RecommendationHandler{wardrobeSvc: wardrobeSvc}
}

func (h *RecommendationHandler) GetOutfit(w http.ResponseWriter, r *http.Request) {
	// TODO: parse optional date query param, call svc.GetOutfit, return recommendation
	http.Error(w, "not implemented", http.StatusNotImplemented)
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
