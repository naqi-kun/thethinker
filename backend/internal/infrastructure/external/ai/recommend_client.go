package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

var _ recommendation.AIRecommender = (*RecommendClient)(nil)

type RecommendClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewRecommendClient(baseURL string) *RecommendClient {
	return &RecommendClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// ── wire types (match Python Pydantic models) ─────────────────────────────────

type wardrobeItemPayload struct {
	ID       string `json:"id"`
	SubType  string `json:"sub_type"`
	Category string `json:"category"`
	Color    string `json:"color"`
	Fit      string `json:"fit"`
	Season   string `json:"season"`
}

type aiRecommendation struct {
	TopID     string `json:"top_id"`
	BottomID  string `json:"bottom_id"`
	ShoesID   string `json:"shoes_id"`
	Reasoning string `json:"reasoning"`
}

type startRequest struct {
	SessionID     string                `json:"session_id,omitempty"`
	WardrobeItems []wardrobeItemPayload `json:"wardrobe_items"`
}

type startResponse struct {
	SessionID      string           `json:"session_id"`
	Recommendation aiRecommendation `json:"recommendation"`
}

type feedbackRequest struct {
	SessionID string `json:"session_id"`
	Action    string `json:"action"`
}

type feedbackResponse struct {
	Status         string            `json:"status"`
	Recommendation *aiRecommendation `json:"recommendation"`
}

// ── interface implementation ──────────────────────────────────────────────────

func (c *RecommendClient) StartSession(ctx context.Context, items []*wardrobe.ClothingItem) (string, recommendation.AIRec, error) {
	payload := make([]wardrobeItemPayload, len(items))
	for i, item := range items {
		payload[i] = wardrobeItemPayload{
			ID:       item.ID,
			SubType:  item.SubType.String(),
			Category: item.Category.String(),
			Color:    item.Color.String(),
			Fit:      item.Fit.String(),
			Season:   item.Season.String(),
		}
	}

	var resp startResponse
	if err := c.post(ctx, "/recommend/start", startRequest{WardrobeItems: payload}, &resp); err != nil {
		return "", recommendation.AIRec{}, err
	}

	return resp.SessionID, recommendation.AIRec{
		TopID:     resp.Recommendation.TopID,
		BottomID:  resp.Recommendation.BottomID,
		ShoesID:   resp.Recommendation.ShoesID,
		Reasoning: resp.Recommendation.Reasoning,
	}, nil
}

func (c *RecommendClient) Regenerate(ctx context.Context, sessionID string) (recommendation.AIRec, error) {
	var resp feedbackResponse
	if err := c.post(ctx, "/recommend/feedback", feedbackRequest{SessionID: sessionID, Action: "regenerate"}, &resp); err != nil {
		return recommendation.AIRec{}, err
	}
	if resp.Recommendation == nil {
		return recommendation.AIRec{}, fmt.Errorf("ai: regenerate returned no recommendation")
	}
	return recommendation.AIRec{
		TopID:     resp.Recommendation.TopID,
		BottomID:  resp.Recommendation.BottomID,
		ShoesID:   resp.Recommendation.ShoesID,
		Reasoning: resp.Recommendation.Reasoning,
	}, nil
}

func (c *RecommendClient) Accept(ctx context.Context, sessionID string) error {
	var resp feedbackResponse
	return c.post(ctx, "/recommend/feedback", feedbackRequest{SessionID: sessionID, Action: "accept"}, &resp)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func (c *RecommendClient) post(ctx context.Context, path string, body, out any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("ai: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("ai: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// A transport failure (connection refused, EOF, timeout) — commonly a
		// cold-start race where the AI container is up but uvicorn isn't serving
		// yet. Flag it as transient so the domain can retry before falling back.
		return fmt.Errorf("%w: %v", recommendation.ErrAIUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return recommendation.ErrSessionNotFound
	}
	if resp.StatusCode >= 500 {
		// 5xx is recoverable: a regenerate against a session the AI lost (e.g. after
		// a restart) can return 500/503 instead of 404. Flag it so the domain can
		// retry with a fresh session rather than treating it as a hard failure.
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%w: status %d: %s", recommendation.ErrAIServerError, resp.StatusCode, raw)
	}
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ai: status %d: %s", resp.StatusCode, raw)
	}

	return json.NewDecoder(resp.Body).Decode(out)
}
