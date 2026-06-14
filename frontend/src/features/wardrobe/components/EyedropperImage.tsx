import { useEffect, useRef, useState } from 'react';
import { nearestNamedColor } from '../colorMatch';
import { colorLabel, type ClothingColor } from '../options';
import { displayedToNaturalPixel, rgbToHex, type ObjectFit } from '../imageSampling';

// Pixels with an alpha below this are treated as "no garment here" (e.g. the
// transparent area of a background-removed PNG) and never sampled.
const ALPHA_MIN = 32;

type Props = {
  src: string;
  alt: string;
  /** Styling for the image box (aspect ratio, rounding, overflow). */
  className?: string;
  /** Must match the CSS object-fit used to render the image. */
  objectFit: ObjectFit;
  /** Live preview as the cursor moves; null when off-image/transparent or on leave. */
  onHover: (color: ClothingColor | null) => void;
  /** Commit the snapped colour on click. Not called for transparent/invalid pixels. */
  onPick: (color: ClothingColor) => void;
  /** Forwarded from the underlying <img> onError. */
  onImgError?: () => void;
};

type Loupe = { left: number; top: number; rawHex: string; label: string };

/**
 * An image you can hover to sample the garment colour under the cursor. The sampled
 * pixel is snapped to the nearest named colour (recommendation-engine compatible) via
 * `nearestNamedColor`.
 *
 * The visible <img> is rendered WITHOUT crossOrigin so it always displays. Sampling uses
 * a SEPARATE offscreen crossOrigin image drawn to a canvas — if that fails to load or the
 * canvas taints (cross-origin image without CORS headers) sampling silently disables and
 * the fixed-palette picker remains the fallback, with no impact on the visible image.
 */
export default function EyedropperImage({
  src,
  alt,
  className,
  objectFit,
  onHover,
  onPick,
  onImgError,
}: Props) {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const natRef = useRef({ w: 0, h: 0 });
  const [enabled, setEnabled] = useState(false);
  const [loupe, setLoupe] = useState<Loupe | null>(null);

  // Load an offscreen crossOrigin copy purely for pixel sampling. Never touches the
  // visible <img>, so a missing CORS header degrades sampling but not display.
  useEffect(() => {
    setEnabled(false);
    setLoupe(null);
    ctxRef.current = null;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        ctx.getImageData(0, 0, 1, 1); // probe: throws SecurityError if tainted
        ctxRef.current = ctx;
        natRef.current = { w, h };
        setEnabled(true);
      } catch {
        // Tainted canvas (cross-origin without CORS) — sampling stays disabled.
        ctxRef.current = null;
        setEnabled(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) setEnabled(false);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  /** Sample the snapped colour + raw hex at a cursor position, or null if invalid. */
  function sampleAt(
    offsetX: number,
    offsetY: number,
    boxW: number,
    boxH: number,
  ): { snapped: ClothingColor; rawHex: string } | null {
    const ctx = ctxRef.current;
    if (!ctx) return null;
    const { w, h } = natRef.current;
    const px = displayedToNaturalPixel(offsetX, offsetY, boxW, boxH, w, h, objectFit);
    if (!px) return null;
    const data = ctx.getImageData(px.x, px.y, 1, 1).data;
    if (data[3] < ALPHA_MIN) return null;
    const rawHex = rgbToHex({ r: data[0], g: data[1], b: data[2] });
    return { snapped: nearestNamedColor(rawHex), rawHex };
  }

  function handleMove(e: React.MouseEvent<HTMLImageElement>) {
    if (!enabled) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const { width, height } = e.currentTarget.getBoundingClientRect();
    const sample = sampleAt(offsetX, offsetY, width, height);
    if (!sample) {
      setLoupe(null);
      onHover(null);
      return;
    }
    setLoupe({
      left: offsetX,
      top: offsetY,
      rawHex: sample.rawHex,
      label: colorLabel(sample.snapped),
    });
    onHover(sample.snapped);
  }

  function handleLeave() {
    setLoupe(null);
    onHover(null);
  }

  function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!enabled) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const { width, height } = e.currentTarget.getBoundingClientRect();
    const sample = sampleAt(offsetX, offsetY, width, height);
    if (sample) onPick(sample.snapped);
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <img
        src={src}
        alt={alt}
        className={`h-full w-full ${
          objectFit === 'cover' ? 'object-cover' : 'object-contain'
        } ${enabled ? 'cursor-crosshair' : ''}`}
        onError={onImgError}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={handleClick}
      />
      {loupe && (
        <div
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-[140%] flex-col items-center gap-1"
          style={{ left: loupe.left, top: loupe.top }}
        >
          <span
            className="block h-9 w-9 rounded-full border-2 border-white shadow-md ring-1 ring-black/10"
            style={{ backgroundColor: loupe.rawHex }}
          />
          <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
            {loupe.label}
          </span>
        </div>
      )}
    </div>
  );
}
