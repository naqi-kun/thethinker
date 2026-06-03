package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type WardrobeHandler struct {
	svc *wardrobe.Service
}

func NewWardrobeHandler(svc *wardrobe.Service) *WardrobeHandler {
	return &WardrobeHandler{svc: svc}
}

type addItemRequest struct {
	Category string `json:"category"`
	SubType  string `json:"sub_type"`
	Color    string `json:"color"`
	Fit      string `json:"fit"`
	Season   string `json:"season"`
	ImageURL string `json:"image_url,omitempty"`
}

type clothingItemResponse struct {
	ID       string  `json:"id"`
	Category string  `json:"category"`
	SubType  string  `json:"sub_type"`
	Color    string  `json:"color"`
	Fit      string  `json:"fit"`
	Season   string  `json:"season"`
	ImageURL string  `json:"image_url,omitempty"`
	LastWorn *string `json:"last_worn"`
}

func toItemResponse(item *wardrobe.ClothingItem) clothingItemResponse {
	resp := clothingItemResponse{
		ID:       item.ID,
		Category: item.Category,
		SubType:  item.SubType,
		Color:    item.Color,
		Fit:      item.Fit,
		Season:   item.Season,
		ImageURL: item.ImageURL,
	}
	if item.LastWorn != nil {
		s := item.LastWorn.UTC().Format(time.RFC3339)
		resp.LastWorn = &s
	}
	return resp
}

func (h *WardrobeHandler) AddItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	var req addItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}
	if req.Category == "" || req.SubType == "" || req.Color == "" || req.Fit == "" || req.Season == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "category, sub_type, color, fit, and season are required")
		return
	}

	item, err := h.svc.AddItem(r.Context(), userID, wardrobe.ClothingItem{
		Category: req.Category,
		SubType:  req.SubType,
		Color:    req.Color,
		Fit:      req.Fit,
		Season:   req.Season,
		ImageURL: req.ImageURL,
	})
	if err != nil {
		if errors.Is(err, wardrobe.ErrInvalidClassification) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to save item")
		return
	}

	writeJSON(w, http.StatusCreated, toItemResponse(item))
}

func (h *WardrobeHandler) ListItems(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	category := r.URL.Query().Get("category")

	items, err := h.svc.ListItems(r.Context(), userID, category)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list items")
		return
	}

	resp := make([]clothingItemResponse, len(items))
	for i, item := range items {
		resp[i] = toItemResponse(item)
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *WardrobeHandler) Scan(w http.ResponseWriter, r *http.Request) {
	// TODO: parse multipart image, call svc.IngestScan, return created item
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
