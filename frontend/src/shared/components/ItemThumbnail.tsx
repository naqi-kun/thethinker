import { useState, type ReactNode } from 'react';
import { Footprints, Shirt, ShoppingBag, Watch } from 'lucide-react';
import type { ClothingItem } from '../api/types';

// Only the fields needed to render an image-or-fallback thumbnail.
type ThumbnailItem = Pick<ClothingItem, 'image_url' | 'sub_type' | 'color'>;

type Aspect = 'square' | 'video';
type FallbackSize = 'sm' | 'md';

interface ItemThumbnailProps {
  item: ThumbnailItem;
  /** Image alt text; defaults to the item's sub_type. */
  alt?: string;
  /** Box aspect ratio. Defaults to a square. */
  aspect?: Aspect;
  /** Size of the no-image fallback (icon circle + colour swatch). */
  fallbackSize?: FallbackSize;
  /** Reserve top padding so overlay controls don't cover the image (pt-12). */
  topInset?: boolean;
  /** Extra classes on the box, e.g. `rounded-xl`. */
  className?: string;
  /** Absolutely-positioned overlay controls and full-cover overlays. */
  children?: ReactNode;
}

// Map a sub_type to a rough display category for the fallback icon. Kept local so
// this shared component never reaches into a feature folder; the wardrobe feature
// keeps its own copy for filtering/stats.
function fallbackCategory(
  subType: string,
): 'Tops' | 'Bottoms' | 'Shoes' | 'Outerwear' | 'Accessories' {
  const s = subType.toLowerCase();
  if (
    ['shirt', 't-shirt', 'blouse', 'top', 'sweater', 'hoodie', 'tee'].some((t) =>
      s.includes(t),
    )
  )
    return 'Tops';
  if (['pants', 'jeans', 'trousers', 'shorts', 'skirt'].some((t) => s.includes(t)))
    return 'Bottoms';
  if (
    ['shoes', 'sneakers', 'boots', 'loafers', 'sandals', 'heels'].some((t) =>
      s.includes(t),
    )
  )
    return 'Shoes';
  if (
    ['jacket', 'coat', 'blazer', 'cardigan', 'outerwear', 'suit'].some((t) =>
      s.includes(t),
    )
  )
    return 'Outerwear';
  return 'Accessories';
}

function categoryIcon(subType: string) {
  switch (fallbackCategory(subType)) {
    case 'Tops':
      return <Shirt className="h-5 w-5" />;
    case 'Bottoms':
      return <ShoppingBag className="h-5 w-5" />;
    case 'Shoes':
      return <Footprints className="h-5 w-5" />;
    default:
      return <Watch className="h-5 w-5" />;
  }
}

function colorSwatch(color: string): string {
  const map: Record<string, string> = {
    white: '#f5f5f5',
    black: '#1a1a1a',
    blue: '#4a6fa5',
    charcoal: '#4a4a4a',
    tan: '#c9a96e',
    navy: '#1f3a5f',
    silver: '#a8a8b3',
    grey: '#888888',
    gray: '#888888',
    red: '#c0392b',
    green: '#27ae60',
    brown: '#795548',
    beige: '#d4bda8',
  };
  return map[color.toLowerCase()] ?? '#d4bda8';
}

function ItemFallback({ item, size }: { item: ThumbnailItem; size: FallbackSize }) {
  const circle = size === 'md' ? 'h-14 w-14' : 'h-12 w-12';
  const swatch = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex flex-col items-center gap-2 text-muted-foreground">
      <div
        className={`flex ${circle} items-center justify-center rounded-full bg-secondary`}
      >
        {categoryIcon(item.sub_type)}
      </div>
      <div
        className={`${swatch} rounded-full border border-border`}
        style={{ backgroundColor: colorSwatch(item.color) }}
        title={item.color}
      />
    </div>
  );
}

/**
 * Renders a clothing item's image inside a fixed-aspect box, falling back to a
 * category icon + colour swatch when there's no image (or it fails to load).
 *
 * The box keeps its aspect ratio regardless of the source image's dimensions:
 * `min-h-0` stops a tall portrait image from overriding `aspect-*` (flex items
 * default to `min-height: auto`), which previously made some cards taller than
 * others and misaligned the grid. Encoding the pattern here keeps that guard
 * from being forgotten at each call site (KAN-88).
 */
export default function ItemThumbnail({
  item,
  alt,
  aspect = 'square',
  fallbackSize = 'sm',
  topInset = false,
  className = '',
  children,
}: ItemThumbnailProps) {
  const [imgError, setImgError] = useState(false);
  const aspectClass = aspect === 'video' ? 'aspect-video' : 'aspect-square';
  const showImage = Boolean(item.image_url) && !imgError;

  return (
    <div
      className={`relative flex ${aspectClass} min-h-0 w-full items-center justify-center overflow-hidden bg-linen/60 ${
        topInset ? 'pt-12' : ''
      } ${className}`}
    >
      {showImage ? (
        <img
          src={item.image_url ?? ''}
          alt={alt ?? item.sub_type}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <ItemFallback item={item} size={fallbackSize} />
      )}
      {children}
    </div>
  );
}
