// Package gcs provides a Google Cloud Storage implementation of the wardrobe.ImageStore interface.
package gcs

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"

	"cloud.google.com/go/storage"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
)

// Client implements wardrobe.ImageStore backed by Google Cloud Storage.
// For local development, set GCS_EMULATOR_HOST to use the fake-gcs-server emulator.
type Client struct {
	bucket       string
	gcsClient    *storage.Client
	publicBase   string
	emulatorHost string // non-empty when using local fake-gcs-server
}

// New creates a GCS client. Credentials are read from GOOGLE_APPLICATION_CREDENTIALS
// or Application Default Credentials. When GCS_EMULATOR_HOST is set the client
// connects to a local fake-gcs-server emulator instead.
func New(ctx context.Context, bucket string) (*Client, error) {
	opts := []option.ClientOption{}

	emulatorHost := os.Getenv("GCS_EMULATOR_HOST")
	if emulatorHost != "" {
		opts = append(opts,
			option.WithEndpoint("http://"+emulatorHost+"/storage/v1/"),
			option.WithoutAuthentication(),
		)
	}

	gcsClient, err := storage.NewClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("gcs: create client: %w", err)
	}

	// On the local emulator, ensure the bucket exists so uploads work out of the box.
	// fake-gcs-server does not auto-create buckets. We always attempt creation and
	// treat a 409 (already exists) as success, so restarts are safe and idempotent.
	if emulatorHost != "" {
		if err := ensureBucket(ctx, gcsClient, bucket); err != nil {
			return nil, err
		}
	}

	publicBase := fmt.Sprintf("https://storage.googleapis.com/%s", bucket)

	return &Client{
		bucket:       bucket,
		gcsClient:    gcsClient,
		publicBase:   publicBase,
		emulatorHost: emulatorHost,
	}, nil
}

// ensureBucket creates the bucket on the emulator if it doesn't already exist.
func ensureBucket(ctx context.Context, c *storage.Client, bucket string) error {
	b := c.Bucket(bucket)

	// Check whether the bucket already exists.
	if _, err := b.Attrs(ctx); err == nil {
		return nil // exists — nothing to do
	}

	// Bucket missing (or any transient error) — try to create it.
	if err := b.Create(ctx, "thethinker-local", nil); err != nil {
		// 409 Conflict means it was created concurrently or already exists — fine.
		var gErr *googleapi.Error
		if errors.As(err, &gErr) && gErr.Code == http.StatusConflict {
			return nil
		}
		return fmt.Errorf("gcs: create emulator bucket %q: %w", bucket, err)
	}
	return nil
}

// Upload writes r to GCS at objectName and returns the public URL.
func (c *Client) Upload(ctx context.Context, objectName, contentType string, r io.Reader, _ int64) (string, error) {
	w := c.gcsClient.Bucket(c.bucket).Object(objectName).NewWriter(ctx)
	w.ContentType = contentType

	if _, err := io.Copy(w, r); err != nil {
		_ = w.Close()
		return "", fmt.Errorf("gcs: write object: %w", err)
	}
	if err := w.Close(); err != nil {
		return "", fmt.Errorf("gcs: close writer: %w", err)
	}

	return c.PublicURL(objectName), nil
}

// PublicURL returns the public URL for an object in this bucket.
// For the local emulator, fake-gcs-server only serves objects via its JSON API
// download path (/download/storage/v1/b/{bucket}/o/{encoded}?alt=media);
// the XML-style path (/{bucket}/{object}) returns 404.
func (c *Client) PublicURL(objectName string) string {
	if c.emulatorHost != "" {
		return fmt.Sprintf("http://%s/download/storage/v1/b/%s/o/%s?alt=media",
			c.emulatorHost, c.bucket, url.PathEscape(objectName))
	}
	return fmt.Sprintf("%s/%s", c.publicBase, objectName)
}

// Close releases resources held by the underlying GCS client.
func (c *Client) Close() error {
	return c.gcsClient.Close()
}
