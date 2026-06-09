package handlers_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/handlers"
)

type mockWardrobeSvc struct {
	addItem     func(ctx context.Context, userID string, item wardrobe.ClothingItem) (*wardrobe.ClothingItem, error)
	listItems   func(ctx context.Context, userID, category string) ([]*wardrobe.ClothingItem, error)
	ingestScan  func(ctx context.Context, userID string, imageBytes []byte, contentType string) (*wardrobe.ClothingItem, error)
	uploadImage func(ctx context.Context, itemID, userID string, imageData []byte) (*wardrobe.ClothingItem, error)
	deleteItem  func(ctx context.Context, itemID, userID string) error
}

func (m *mockWardrobeSvc) AddItem(ctx context.Context, userID string, item wardrobe.ClothingItem) (*wardrobe.ClothingItem, error) {
	return m.addItem(ctx, userID, item)
}

func (m *mockWardrobeSvc) ListItems(ctx context.Context, userID, category string) ([]*wardrobe.ClothingItem, error) {
	return m.listItems(ctx, userID, category)
}

func (m *mockWardrobeSvc) IngestScan(ctx context.Context, userID string, imageBytes []byte, contentType string) (*wardrobe.ClothingItem, error) {
	return m.ingestScan(ctx, userID, imageBytes, contentType)
}

func (m *mockWardrobeSvc) UploadImage(ctx context.Context, itemID, userID string, imageData []byte) (*wardrobe.ClothingItem, error) {
	return m.uploadImage(ctx, itemID, userID, imageData)
}

func (m *mockWardrobeSvc) DeleteItem(ctx context.Context, itemID, userID string) error {
	if m.deleteItem != nil {
		return m.deleteItem(ctx, itemID, userID)
	}
	return nil
}

func savedItem() *wardrobe.ClothingItem {
	return &wardrobe.ClothingItem{
		ID:        "item-1",
		UserID:    "user-123",
		Category:  wardrobe.CategoryCasual,
		SubType:   wardrobe.SubTypeTShirt,
		Color:     wardrobe.ColorWhite,
		Fit:       wardrobe.FitRegular,
		Season:    wardrobe.SeasonAll,
		CreatedAt: time.Now(),
	}
}

func TestAddItem(t *testing.T) {
	validBody := `{"category":"casual","sub_type":"t-shirt","color":"white","fit":"regular","season":"all"}`

	tests := []struct {
		name       string
		body       string
		injectUser bool
		svcErr     error
		wantStatus int
	}{
		{
			name:       "happy path returns 201",
			body:       validBody,
			injectUser: true,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "missing auth returns 401",
			body:       validBody,
			injectUser: false,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid JSON returns 400",
			body:       `not-json`,
			injectUser: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "unknown category returns 400",
			body:       `{"category":"unknown","sub_type":"t-shirt","color":"white","fit":"regular","season":"all"}`,
			injectUser: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "unknown sub_type returns 400",
			body:       `{"category":"casual","sub_type":"unknown","color":"white","fit":"regular","season":"all"}`,
			injectUser: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "service error returns 500",
			body:       validBody,
			injectUser: true,
			svcErr:     errors.New("db unavailable"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svcErr := tc.svcErr
			svc := &mockWardrobeSvc{
				addItem: func(_ context.Context, _ string, _ wardrobe.ClothingItem) (*wardrobe.ClothingItem, error) {
					if svcErr != nil {
						return nil, svcErr
					}
					return savedItem(), nil
				},
			}
			h := handlers.NewWardrobeHandler(svc)

			req := httptest.NewRequest(http.MethodPost, "/wardrobe/items", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			if tc.injectUser {
				req = withUserID(req, "user-123")
			}

			rr := httptest.NewRecorder()
			h.AddItem(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", rr.Code, tc.wantStatus, rr.Body.String())
			}
		})
	}
}

func TestListItems(t *testing.T) {
	items := []*wardrobe.ClothingItem{savedItem()}

	tests := []struct {
		name       string
		query      string
		injectUser bool
		svcItems   []*wardrobe.ClothingItem
		svcErr     error
		wantStatus int
	}{
		{
			name:       "happy path returns 200 with items",
			injectUser: true,
			svcItems:   items,
			wantStatus: http.StatusOK,
		},
		{
			name:       "empty wardrobe returns 200 empty array",
			injectUser: true,
			svcItems:   []*wardrobe.ClothingItem{},
			wantStatus: http.StatusOK,
		},
		{
			name:       "valid category filter returns 200",
			query:      "?category=casual",
			injectUser: true,
			svcItems:   items,
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid category filter returns 400",
			query:      "?category=unknown",
			injectUser: true,
			svcErr:     wardrobe.ErrInvalidClassification,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing auth returns 401",
			injectUser: false,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "service error returns 500",
			injectUser: true,
			svcErr:     errors.New("db unavailable"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svcItems, svcErr := tc.svcItems, tc.svcErr
			svc := &mockWardrobeSvc{
				listItems: func(_ context.Context, _, _ string) ([]*wardrobe.ClothingItem, error) {
					return svcItems, svcErr
				},
			}
			h := handlers.NewWardrobeHandler(svc)

			req := httptest.NewRequest(http.MethodGet, "/wardrobe/items"+tc.query, nil)
			if tc.injectUser {
				req = withUserID(req, "user-123")
			}

			rr := httptest.NewRecorder()
			h.ListItems(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", rr.Code, tc.wantStatus, rr.Body.String())
			}
		})
	}
}
