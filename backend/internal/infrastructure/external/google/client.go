// Package google implements the Google OAuth code exchange and Google Calendar
// event fetching behind the domain ports (user sign-in identity + calendar
// GoogleCalendarClient). It is the infrastructure adapter for KAN-97.
package google

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/oauth2"
	googleoauth "golang.org/x/oauth2/google"
	gcal "google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
)

const (
	// Window of events to sync: a little history plus the near future.
	syncPastDays   = 1
	syncFutureDays = 60
	maxEvents      = 250
)

// Client satisfies calendar.GoogleCalendarClient and additionally exchanges
// OAuth codes for a verified identity at sign-in time.
type Client struct {
	config *oauth2.Config
}

var _ calendar.GoogleCalendarClient = (*Client)(nil)

// NewClient builds the OAuth client. The redirect URL is supplied per request
// (it must match the one the browser used), so it is left empty here.
func NewClient(clientID, clientSecret string) *Client {
	return &Client{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			Endpoint:     googleoauth.Endpoint,
		},
	}
}

// Exchange swaps an authorization code for tokens and the user's identity.
// The id_token is trusted without re-verification: it was just received
// directly from Google's token endpoint over TLS by this server.
func (c *Client) Exchange(ctx context.Context, code, redirectURI string) (user.GoogleIdentity, calendar.GoogleToken, error) {
	if c.config.ClientID == "" || c.config.ClientSecret == "" {
		return user.GoogleIdentity{}, calendar.GoogleToken{}, errors.New("google: client credentials not configured")
	}

	cfg := *c.config
	cfg.RedirectURL = redirectURI

	tok, err := cfg.Exchange(ctx, code)
	if err != nil {
		return user.GoogleIdentity{}, calendar.GoogleToken{}, fmt.Errorf("google: exchange code: %w", err)
	}

	identity, err := identityFromIDToken(tok)
	if err != nil {
		return user.GoogleIdentity{}, calendar.GoogleToken{}, err
	}

	return identity, calendar.GoogleToken{
		AccessToken:  tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		Expiry:       tok.Expiry,
	}, nil
}

// FetchEvents lists the user's primary-calendar events for the sync window. The
// token source transparently refreshes the access token; the refreshed token is
// returned so the caller can persist it.
func (c *Client) FetchEvents(ctx context.Context, tok calendar.GoogleToken) ([]*calendar.Event, calendar.GoogleToken, error) {
	src := c.config.TokenSource(ctx, &oauth2.Token{
		AccessToken:  tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		Expiry:       tok.Expiry,
	})

	svc, err := gcal.NewService(ctx, option.WithTokenSource(src))
	if err != nil {
		return nil, tok, fmt.Errorf("google: calendar service: %w", err)
	}

	now := time.Now()
	res, err := svc.Events.List("primary").
		TimeMin(now.AddDate(0, 0, -syncPastDays).Format(time.RFC3339)).
		TimeMax(now.AddDate(0, 0, syncFutureDays).Format(time.RFC3339)).
		SingleEvents(true).
		OrderBy("startTime").
		MaxResults(maxEvents).
		Context(ctx).
		Do()
	if err != nil {
		return nil, tok, fmt.Errorf("google: list events: %w", err)
	}

	events := make([]*calendar.Event, 0, len(res.Items))
	for _, it := range res.Items {
		if e := toEvent(it); e != nil {
			events = append(events, e)
		}
	}

	// Surface any refreshed token so it can be persisted.
	out := tok
	if refreshed, err := src.Token(); err == nil && refreshed != nil {
		out = calendar.GoogleToken{
			AccessToken:  refreshed.AccessToken,
			RefreshToken: refreshed.RefreshToken,
			Expiry:       refreshed.Expiry,
		}
	}
	return events, out, nil
}

// toEvent maps a Google Calendar API event to a domain event, or nil if it has
// no id or usable start time.
func toEvent(it *gcal.Event) *calendar.Event {
	if it == nil || it.Id == "" || it.Start == nil {
		return nil
	}

	var start, end time.Time
	allDay := false

	switch {
	case it.Start.DateTime != "":
		t, err := time.Parse(time.RFC3339, it.Start.DateTime)
		if err != nil {
			return nil
		}
		start = t.UTC()
		if it.End != nil && it.End.DateTime != "" {
			if e, err := time.Parse(time.RFC3339, it.End.DateTime); err == nil {
				end = e.UTC()
			}
		}
	case it.Start.Date != "":
		t, err := time.Parse("2006-01-02", it.Start.Date)
		if err != nil {
			return nil
		}
		allDay = true
		start = t.UTC()
		if it.End != nil && it.End.Date != "" {
			if e, err := time.Parse("2006-01-02", it.End.Date); err == nil {
				end = e.UTC()
			}
		}
	default:
		return nil
	}

	return &calendar.Event{
		ID:       it.Id,
		Title:    it.Summary,
		StartsAt: start,
		EndsAt:   end,
		Location: it.Location,
		AllDay:   allDay,
	}
}

func identityFromIDToken(tok *oauth2.Token) (user.GoogleIdentity, error) {
	raw, ok := tok.Extra("id_token").(string)
	if !ok || raw == "" {
		return user.GoogleIdentity{}, errors.New("google: token response missing id_token")
	}

	parts := strings.Split(raw, ".")
	if len(parts) < 2 {
		return user.GoogleIdentity{}, errors.New("google: malformed id_token")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return user.GoogleIdentity{}, fmt.Errorf("google: decode id_token: %w", err)
	}

	var claims struct {
		Sub   string `json:"sub"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return user.GoogleIdentity{}, fmt.Errorf("google: parse id_token claims: %w", err)
	}
	if claims.Sub == "" {
		return user.GoogleIdentity{}, errors.New("google: id_token missing sub claim")
	}

	return user.GoogleIdentity{
		GoogleID: claims.Sub,
		Email:    claims.Email,
		Name:     claims.Name,
	}, nil
}
