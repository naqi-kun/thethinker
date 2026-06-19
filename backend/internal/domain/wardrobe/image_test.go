package wardrobe

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"testing"
)

func TestProcessImageResizesAndReencodesToJPEG(t *testing.T) {
	// A 2000x1000 source should be scaled down to fit within the max bounds
	// while preserving aspect ratio (-> 1024x512) and re-encoded as JPEG.
	src := image.NewRGBA(image.Rect(0, 0, 2000, 1000))
	var in bytes.Buffer
	if err := png.Encode(&in, src); err != nil {
		t.Fatalf("encode source png: %v", err)
	}

	out, err := processImage(&in)
	if err != nil {
		t.Fatalf("processImage returned error: %v", err)
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode processed image: %v", err)
	}
	if format != "jpeg" {
		t.Errorf("processed format = %q, want jpeg", format)
	}
	if cfg.Width > maxImageWidth || cfg.Height > maxImageHeight {
		t.Errorf("processed dimensions %dx%d exceed max %dx%d",
			cfg.Width, cfg.Height, maxImageWidth, maxImageHeight)
	}
	if cfg.Width != 1024 || cfg.Height != 512 {
		t.Errorf("processed dimensions = %dx%d, want 1024x512 (aspect ratio preserved)",
			cfg.Width, cfg.Height)
	}
}

func TestProcessImageKeepsSmallImageWithinBounds(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 200, 300))
	var in bytes.Buffer
	if err := png.Encode(&in, src); err != nil {
		t.Fatalf("encode source png: %v", err)
	}

	out, err := processImage(&in)
	if err != nil {
		t.Fatalf("processImage returned error: %v", err)
	}

	cfg, _, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode processed image: %v", err)
	}
	if cfg.Width != 200 || cfg.Height != 300 {
		t.Errorf("small image resized to %dx%d, want unchanged 200x300", cfg.Width, cfg.Height)
	}
}

// A minimal valid lossy WebP image (1x1). Phones and web downloads commonly
// produce WebP, so the decoder must accept it and re-encode to JPEG.
const tinyWebPBase64 = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="

func TestProcessImageAcceptsWebP(t *testing.T) {
	in, err := base64.StdEncoding.DecodeString(tinyWebPBase64)
	if err != nil {
		t.Fatalf("decode webp fixture: %v", err)
	}

	out, err := processImage(bytes.NewReader(in))
	if err != nil {
		t.Fatalf("processImage on webp returned error: %v", err)
	}

	_, format, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode processed image: %v", err)
	}
	if format != "jpeg" {
		t.Errorf("processed format = %q, want jpeg", format)
	}
}

func TestProcessImageRejectsNonImage(t *testing.T) {
	if _, err := processImage(bytes.NewReader([]byte("definitely not an image"))); err == nil {
		t.Error("processImage on non-image bytes: expected error, got nil")
	}
}
