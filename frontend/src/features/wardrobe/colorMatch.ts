// Pure helpers for mapping a free hex colour to the nearest named wardrobe
// colour, and for suggesting a default item name. No React/DOM dependencies so
// they are trivially unit-testable.
import {
  COLOR_SWATCHES,
  colorLabel,
  type ClothingColor,
  type ClothingSubType,
} from './options';

type Rgb = { r: number; g: number; b: number };

/** Parse a `#rgb` or `#rrggbb` string into 0–255 channels. Returns null if not a hex. */
export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/**
 * Return the nearest named colour to a hex value using squared Euclidean
 * distance in RGB space. `multicolor` (a gradient, not a hex) is excluded.
 * Falls back to 'black' for an unparseable input.
 */
export function nearestNamedColor(hex: string): ClothingColor {
  const target = hexToRgb(hex);
  if (!target) return 'black';

  let best: ClothingColor = 'black';
  let bestDist = Infinity;
  for (const name of Object.keys(COLOR_SWATCHES) as ClothingColor[]) {
    const swatch = COLOR_SWATCHES[name];
    const rgb = hexToRgb(swatch); // null for the multicolor gradient → skipped
    if (!rgb) continue;
    const dr = rgb.r - target.r;
    const dg = rgb.g - target.g;
    const db = rgb.b - target.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

const SUB_TYPE_LABELS: Record<ClothingSubType, string> = {
  shirt: 'Shirt',
  't-shirt': 'T-Shirt',
  sweater: 'Sweater',
  hoodie: 'Hoodie',
  jacket: 'Jacket',
  coat: 'Coat',
  pants: 'Pants',
  jeans: 'Jeans',
  shorts: 'Shorts',
  skirt: 'Skirt',
  dress: 'Dress',
  shoes: 'Shoes',
  sneakers: 'Sneakers',
  boots: 'Boots',
  suit: 'Suit',
  blazer: 'Blazer',
};

/** Suggest a default item name, e.g. "Navy Blue Jeans". Falls back gracefully. */
export function suggestName(color: string, subType: string): string {
  const colorPart = color ? colorLabel(color) : '';
  const typePart =
    (SUB_TYPE_LABELS as Record<string, string>)[subType] ??
    (subType ? colorLabel(subType) : '');
  return [colorPart, typePart].filter(Boolean).join(' ').trim();
}
