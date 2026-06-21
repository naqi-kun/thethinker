package classifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
)

var _ wardrobe.Classifier = (*Client)(nil)
var _ wardrobe.BgRemover = (*Client)(nil)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 90 * time.Second},
	}
}

type classifyResponse struct {
	Category        string   `json:"category"`
	SubType         string   `json:"sub_type"`
	Color           string   `json:"color"`
	Fit             string   `json:"fit"`
	Season          string   `json:"season"`
	Pattern         string   `json:"pattern,omitempty"`
	Description     string   `json:"description"`
	ConfidenceScore *float64 `json:"confidence_score"`
}

func (c *Client) Classify(ctx context.Context, imageBytes []byte, contentType string) (*wardrobe.ClassifyResult, error) {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	part, err := w.CreateFormFile("image", "image")
	if err != nil {
		return nil, fmt.Errorf("classifier: create form file: %w", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(imageBytes)); err != nil {
		return nil, fmt.Errorf("classifier: copy image: %w", err)
	}
	w.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/classify", &body)
	if err != nil {
		return nil, fmt.Errorf("classifier: build request: %w", err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("classifier: http: %w", err)
	}
	defer resp.Body.Close()

	// The AI service returns 422 when the image is not a recognizable clothing
	// item. Surface it as a domain error so the handler responds 422, not 500.
	if resp.StatusCode == http.StatusUnprocessableEntity {
		return nil, fmt.Errorf("%w: image is not a recognizable clothing item", wardrobe.ErrInvalidClassification)
	}
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("classifier: status %d: %s", resp.StatusCode, raw)
	}

	var result classifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("classifier: decode: %w", err)
	}

	// Use the model's real confidence. Only fall back when the field is
	// genuinely absent — a returned 0.0 is a valid (very low) confidence and
	// must not be overwritten, or ambiguous scans would look highly confident.
	score := 0.85
	if result.ConfidenceScore != nil {
		score = *result.ConfidenceScore
	}

	return &wardrobe.ClassifyResult{
		Category:        result.Category,
		SubType:         result.SubType,
		Color:           result.Color,
		Fit:             result.Fit,
		Season:          result.Season,
		Pattern:         result.Pattern,
		Description:     result.Description,
		ConfidenceScore: score,
	}, nil
}

// RemoveBackground sends the image to the /remove-bg endpoint and returns a
// PNG with a transparent background. The caller is responsible for fallback
// if this returns an error.
func (c *Client) RemoveBackground(ctx context.Context, imageBytes []byte) ([]byte, error) {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	part, err := w.CreateFormFile("image", "image")
	if err != nil {
		return nil, fmt.Errorf("bgremover: create form file: %w", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(imageBytes)); err != nil {
		return nil, fmt.Errorf("bgremover: copy image: %w", err)
	}
	w.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/remove-bg", &body)
	if err != nil {
		return nil, fmt.Errorf("bgremover: build request: %w", err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bgremover: http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("bgremover: status %d: %s", resp.StatusCode, raw)
	}

	result, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("bgremover: read response: %w", err)
	}
	return result, nil
}
