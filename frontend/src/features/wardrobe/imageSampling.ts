// Pure helpers for sampling a colour from a rendered image. No React/DOM deps so
// they are trivially unit-testable (mirrors colorMatch.ts).

type Rgb = { r: number; g: number; b: number };

/** A pixel coordinate in an image's natural (source) coordinate space. */
export type Pixel = { x: number; y: number };

/** How the image is laid out inside its rendered box (CSS object-fit). */
export type ObjectFit = 'cover' | 'contain';

/** Format 0–255 channels as a `#rrggbb` string. Channels are clamped + rounded. */
export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const hex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Map a cursor position within a rendered `<img>` box to a pixel in the image's
 * natural coordinate space, accounting for `object-fit`.
 *
 * - `offsetX/offsetY` are relative to the rendered box's top-left (e.g.
 *   `MouseEvent.offsetX/offsetY`).
 * - `boxW/boxH` are the rendered element size; `natW/natH` the image's natural size.
 *
 * For `contain`, returns `null` when the cursor is over the letterbox bars (no image
 * there). For `cover`, the image is cropped to fill the box, so every box position maps
 * to a pixel. Returns `null` for degenerate (zero) dimensions.
 */
export function displayedToNaturalPixel(
  offsetX: number,
  offsetY: number,
  boxW: number,
  boxH: number,
  natW: number,
  natH: number,
  fit: ObjectFit,
): Pixel | null {
  if (boxW <= 0 || boxH <= 0 || natW <= 0 || natH <= 0) return null;

  // Scale that maps natural → rendered content. contain fits inside (min),
  // cover fills and crops (max).
  const scale =
    fit === 'contain'
      ? Math.min(boxW / natW, boxH / natH)
      : Math.max(boxW / natW, boxH / natH);

  const contentW = natW * scale;
  const contentH = natH * scale;
  // Image is centred within the box; offset is negative for the cropped axis (cover).
  const originX = (boxW - contentW) / 2;
  const originY = (boxH - contentH) / 2;

  // Cursor position within the displayed image content (may be off-content for contain).
  const contentX = offsetX - originX;
  const contentY = offsetY - originY;
  if (contentX < 0 || contentY < 0 || contentX >= contentW || contentY >= contentH) {
    return null; // over a letterbox bar (contain) or outside the box
  }

  const x = Math.floor(contentX / scale);
  const y = Math.floor(contentY / scale);
  return {
    x: Math.max(0, Math.min(natW - 1, x)),
    y: Math.max(0, Math.min(natH - 1, y)),
  };
}
