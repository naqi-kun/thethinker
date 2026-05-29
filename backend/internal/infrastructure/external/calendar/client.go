package calendar

import (
	"context"

	domain "school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
)

type Client struct {
	// TODO: oauth2.Config for Google / Apple
}

func NewClient() *Client {
	return &Client{}
}

// ExchangeCode exchanges an OAuth auth code for an access token.
// TODO: implement Google Calendar / Apple Calendar OAuth flow
func (c *Client) ExchangeCode(ctx context.Context, provider, authCode string) (string, error) {
	panic("not implemented")
}

// FetchEvents retrieves upcoming calendar events using the stored access token.
// TODO: call Google Calendar API / Apple CalDAV
func (c *Client) FetchEvents(ctx context.Context, token string) ([]*domain.Event, error) {
	panic("not implemented")
}
