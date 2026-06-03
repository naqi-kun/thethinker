package minioclient

import (
	"context"
	"fmt"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client wraps the MinIO SDK client with bucket management.
type Client struct {
	mc     *minio.Client
	bucket string
}

// New creates a new MinIO client and ensures the target bucket exists.
func New(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*Client, error) {
	mc, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio: init client: %w", err)
	}

	ctx := context.Background()
	exists, err := mc.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("minio: check bucket: %w", err)
	}
	if !exists {
		if err := mc.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio: create bucket: %w", err)
		}
		// Make bucket publicly readable so image_url can be served directly.
		policy := fmt.Sprintf(`{
			"Version":"2012-10-17",
			"Statement":[{
				"Effect":"Allow",
				"Principal":{"AWS":["*"]},
				"Action":["s3:GetObject"],
				"Resource":["arn:aws:s3:::%s/*"]
			}]
		}`, bucket)
		if err := mc.SetBucketPolicy(ctx, bucket, policy); err != nil {
			return nil, fmt.Errorf("minio: set bucket policy: %w", err)
		}
	}

	return &Client{mc: mc, bucket: bucket}, nil
}

// Upload stores an object and returns its public URL.
func (c *Client) Upload(ctx context.Context, objectName, contentType string, r io.Reader, size int64) (string, error) {
	_, err := c.mc.PutObject(ctx, c.bucket, objectName, r, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("minio: put object: %w", err)
	}

	// Return the direct public URL (bucket is publicly readable).
	return fmt.Sprintf("%s/%s/%s", c.mc.EndpointURL(), c.bucket, objectName), nil
}

// PublicURL returns the direct public URL for an already-uploaded object.
func (c *Client) PublicURL(objectName string) string {
	return fmt.Sprintf("%s/%s/%s", c.mc.EndpointURL(), c.bucket, objectName)
}
