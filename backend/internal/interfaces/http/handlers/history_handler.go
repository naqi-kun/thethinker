package handlers

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

type historyRepo interface {
	List(ctx context.Context, userID string, cursor string, limit int, filter recommendation.HistoryFilter) ([]*recommendation.AcceptedOutfit, string, error)
}

type HistoryHandler struct {
	repo historyRepo
}

func NewHistoryHandler(repo historyRepo) *HistoryHandler {
	return &HistoryHandler{repo: repo}
}

type historyItemResponse struct {
	ItemID   string `json:"item_id"`
	ImageURL string `json:"image_url,omitempty"`
	Category string `json:"category"`
	SubType  string `json:"sub_type"`
	Color    string `json:"color"`
	Fit      string `json:"fit,omitempty"`
	Season   string `json:"season,omitempty"`
}

type weatherSnapshotResponse struct {
	Temperature float64 `json:"temperature"`
	FeelsLike   float64 `json:"feels_like"`
	Description string  `json:"description"`
}

type acceptedOutfitResponse struct {
	ID        string                   `json:"id"`
	WornOn    string                   `json:"worn_on"`
	Occasion  string                   `json:"occasion,omitempty"`
	TimeOfDay string                   `json:"time_of_day"`
	Weather   *weatherSnapshotResponse `json:"weather,omitempty"`
	Items     []historyItemResponse    `json:"items"`
}

type historyEntryResponse struct {
	WornOn  string                   `json:"worn_on"`
	Outfits []acceptedOutfitResponse `json:"outfits"`
}

type outfitHistoryResponse struct {
	Entries    []historyEntryResponse `json:"entries"`
	NextCursor *string                `json:"next_cursor"`
}

func (h *HistoryHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	cursor := r.URL.Query().Get("cursor")
	rangeVal := r.URL.Query().Get("range")
	if rangeVal == "" {
		rangeVal = "week"
	}
	todVal := r.URL.Query().Get("time_of_day")

	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}

	outfits, nextCursor, err := h.repo.List(r.Context(), userID, cursor, limit, recommendation.HistoryFilter{
		Range:     rangeVal,
		TimeOfDay: todVal,
	})
	if err != nil {
		if errors.Is(err, recommendation.ErrInvalidCursor) {
			writeError(w, http.StatusBadRequest, "INVALID_CURSOR", "malformed pagination cursor")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list history")
		return
	}

	type group struct {
		date    string
		outfits []acceptedOutfitResponse
	}
	var groups []group
	dateIndex := map[string]int{}

	for _, o := range outfits {
		date := o.WornOn.UTC().Format("2006-01-02")

		items := make([]historyItemResponse, len(o.Items))
		for i, it := range o.Items {
			items[i] = historyItemResponse{
				ItemID:   it.ItemID,
				ImageURL: it.ImageURL,
				Category: it.Category,
				SubType:  it.SubType,
				Color:    it.Color,
				Fit:      it.Fit,
				Season:   it.Season,
			}
		}

		ao := acceptedOutfitResponse{
			ID:        o.ID,
			WornOn:    date,
			Occasion:  o.Occasion,
			TimeOfDay: string(o.TimeOfDay),
			Items:     items,
		}
		if o.WeatherSnapshot != nil {
			ao.Weather = &weatherSnapshotResponse{
				Temperature: o.WeatherSnapshot.Temperature,
				FeelsLike:   o.WeatherSnapshot.FeelsLike,
				Description: o.WeatherSnapshot.Description,
			}
		}

		if idx, ok := dateIndex[date]; ok {
			groups[idx].outfits = append(groups[idx].outfits, ao)
		} else {
			dateIndex[date] = len(groups)
			groups = append(groups, group{date: date, outfits: []acceptedOutfitResponse{ao}})
		}
	}

	entries := make([]historyEntryResponse, len(groups))
	for i, g := range groups {
		entries[i] = historyEntryResponse{WornOn: g.date, Outfits: g.outfits}
	}

	resp := outfitHistoryResponse{Entries: entries}
	if nextCursor != "" {
		resp.NextCursor = &nextCursor
	}

	writeJSON(w, http.StatusOK, resp)
}
