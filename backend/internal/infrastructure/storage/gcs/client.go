// Package gcs provides a Google Cloud Storage implementation of the wardrobe.ImageStore interface.
package gcs

import (
	"context"
	"fmt"
	"io"
	"os"

	"cloud.google.com/go/storage"
	"google.golang.org/api/option"
)

// Client implements wardrobe.ImageStore backed by Google Cloud Storage.
// For local development, set GCS_EMULATOR_HOST to use the fake-gcs-server emulator.
type Client struct {
	bucket     string
	gcsClient  *storage.Client
	publicBase string
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

	publicBase := fmt.Sprintf("https://storage.googleapis.com/%s", bucket)
	if emulatorHost != "" {
		publicBase = fmt.Sprintf("http://%s/%s", emulatorHost, bucket)
	}

	return &Client{
		bucket:     bucket,
		gcsClient:  gcsClient,
		publicBase: publicBase,
	}, nil
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
func (c *Client) PublicURL(objectName string) string {
	return fmt.Sprintf("%s/%s", c.publicBase, objectName)
}

// Close releases resources held by the underlying GCS client.
func (c *Client) Close() error {
	return c.gcsClient.Close()
}
