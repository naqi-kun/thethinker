// Package image provides image optimization utilities for the upload pipeline.
package image

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png" // register PNG decoder
	"io"

	"golang.org/x/image/draw"
)

const (
	MaxWidth  = 1024
	MaxHeight = 1024
	Quality   = 85 // JPEG quality (0–100)
)

// Process reads an image from r, resizes it to fit within MaxWidth×MaxHeight
// (preserving aspect ratio), and encodes it as JPEG.
// Returns the processed bytes and their size.
func Process(r io.Reader) ([]byte, error) {
	src, _, err := image.Decode(r)
	if err != nil {
		return nil, fmt.Errorf("image: decode: %w", err)
	}

	resized := resize(src, MaxWidth, MaxHeight)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: Quality}); err != nil {
		return nil, fmt.Errorf("image: encode jpeg: %w", err)
	}

	return buf.Bytes(), nil
}

// resize scales img down to fit within maxW×maxH, preserving aspect ratio.
// If the image already fits, it is returned as-is.
func resize(src image.Image, maxW, maxH int) image.Image {
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	if srcW <= maxW && srcH <= maxH {
		return src
	}

	// Calculate scale factor preserving aspect ratio.
	scaleW := float64(maxW) / float64(srcW)
	scaleH := float64(maxH) / float64(srcH)
	scale := scaleW
	if scaleH < scaleW {
		scale = scaleH
	}

	dstW := int(float64(srcW) * scale)
	dstH := int(float64(srcH) * scale)

	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))
	draw.BiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Src, nil)
	return dst
}
