package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

const maxUploadSize = 10 << 20 // 10 MB

type wardrobeSvc interface {
	AddItem(ctx context.Context, userID string, item wardrobe.ClothingItem) (*wardrobe.ClothingItem, error)
	ListItems(ctx context.Context, userID, category string) ([]*wardrobe.ClothingItem, error)
	IngestScan(ctx context.Context, userID string, imageBytes []byte, contentType string) (*wardrobe.ClothingItem, error)
	UploadImage(ctx context.Context, itemID, userID string, imageData []byte) (*wardrobe.ClothingItem, error)
	ClassifyOnly(ctx context.Context, imageBytes []byte, contentType string) (*wardrobe.ClassifyResult, error)
	UpdateItem(ctx context.Context, itemID, userID string, fields wardrobe.ClothingItem) (*wardrobe.ClothingItem, error)
}

type WardrobeHandler struct {
	svc wardrobeSvc
}

func NewWardrobeHandler(svc wardrobeSvc) *WardrobeHandler {
	return &WardrobeHandler{svc: svc}
}

type classifyResultResponse struct {
	Category        string  `json:"category"`
	SubType         string  `json:"sub_type"`
	Color           string  `json:"color"`
	Fit             string  `json:"fit"`
	Season          string  `json:"season"`
	ConfidenceScore float64 `json:"confidence_score"`
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
		Category: item.Category.String(),
		SubType:  item.SubType.String(),
		Color:    item.Color.String(),
		Fit:      item.Fit.String(),
		Season:   item.Season.String(),
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

	category, err := wardrobe.ParseCategory(req.Category)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	subType, err := wardrobe.ParseSubType(req.SubType)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	color, err := wardrobe.ParseColor(req.Color)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	fit, err := wardrobe.ParseFit(req.Fit)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	season, err := wardrobe.ParseSeason(req.Season)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	item, err := h.svc.AddItem(r.Context(), userID, wardrobe.ClothingItem{
		Category: category,
		SubType:  subType,
		Color:    color,
		Fit:      fit,
		Season:   season,
		ImageURL: req.ImageURL,
	})
	if err != nil {
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
		if errors.Is(err, wardrobe.ErrInvalidClassification) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list items")
		return
	}

	resp := make([]clothingItemResponse, len(items))
	for i, item := range items {
		resp[i] = toItemResponse(item)
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *WardrobeHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	// Extract item ID from path: /wardrobe/items/{id}/image
	// Go 1.22+ ServeMux supports path params via r.PathValue.
	itemID := r.PathValue("id")
	if itemID == "" {
		// Fallback: parse manually for older routers.
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 3 {
			itemID = parts[2]
		}
	}
	if itemID == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "item ID is required")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "max upload size is 10 MB")
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "image field is required")
		return
	}
	defer file.Close()

	imageData, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to read uploaded file")
		return
	}

	item, err := h.svc.UploadImage(r.Context(), itemID, userID, imageData)
	if err != nil {
		switch {
		case errors.Is(err, wardrobe.ErrNotFound):
			writeError(w, http.StatusNotFound, "NOT_FOUND", "clothing item not found")
		case errors.Is(err, wardrobe.ErrForbidden):
			writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		case errors.Is(err, wardrobe.ErrInvalidImage):
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "uploaded file is not a valid JPEG or PNG image")
		default:
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to upload image")
		}
		return
	}

	writeJSON(w, http.StatusOK, toItemResponse(item))
}

func (h *WardrobeHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	itemID := r.PathValue("id")
	if itemID == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "item ID is required")
		return
	}

	var req addItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}

	category, err := wardrobe.ParseCategory(req.Category)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	subType, err := wardrobe.ParseSubType(req.SubType)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	color, err := wardrobe.ParseColor(req.Color)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	fit, err := wardrobe.ParseFit(req.Fit)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	season, err := wardrobe.ParseSeason(req.Season)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	item, err := h.svc.UpdateItem(r.Context(), itemID, userID, wardrobe.ClothingItem{
		Category: category,
		SubType:  subType,
		Color:    color,
		Fit:      fit,
		Season:   season,
	})
	if err != nil {
		switch {
		case errors.Is(err, wardrobe.ErrNotFound):
			writeError(w, http.StatusNotFound, "NOT_FOUND", "clothing item not found")
		case errors.Is(err, wardrobe.ErrForbidden):
			writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		default:
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update item")
		}
		return
	}

	writeJSON(w, http.StatusOK, toItemResponse(item))
}

func (h *WardrobeHandler) Classify(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "max upload size is 10 MB")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "image field is required")
		return
	}
	defer file.Close()

	imageBytes, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to read image")
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	result, err := h.svc.ClassifyOnly(r.Context(), imageBytes, contentType)
	if err != nil {
		if errors.Is(err, wardrobe.ErrInvalidClassification) {
			writeError(w, http.StatusUnprocessableEntity, "UNPROCESSABLE", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "classify failed")
		return
	}

	writeJSON(w, http.StatusOK, classifyResultResponse{
		Category:        result.Category,
		SubType:         result.SubType,
		Color:           result.Color,
		Fit:             result.Fit,
		Season:          result.Season,
		ConfidenceScore: result.ConfidenceScore,
	})
}

func (h *WardrobeHandler) Scan(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "max upload size is 10 MB")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "image field is required")
		return
	}
	defer file.Close()

	imageBytes, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to read image")
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	item, err := h.svc.IngestScan(r.Context(), userID, imageBytes, contentType)
	if err != nil {
		if errors.Is(err, wardrobe.ErrInvalidClassification) {
			writeError(w, http.StatusUnprocessableEntity, "UNPROCESSABLE", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "scan failed")
		return
	}

	writeJSON(w, http.StatusCreated, toItemResponse(item))
}
