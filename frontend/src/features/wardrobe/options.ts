// Single source of truth for wardrobe attribute option lists and colour swatches.
// `color` and `sub_type` are free strings in the OpenAPI contract, so their
// allowed values are defined here on the frontend.
import type {
  ClothingCategory,
  ClothingFit,
  ClothingSeason,
  ClothingStatus,
} from '../../shared/api/types';

export type ClothingSubType =
  | 'shirt'
  | 't-shirt'
  | 'sweater'
  | 'hoodie'
  | 'jacket'
  | 'coat'
  | 'pants'
  | 'jeans'
  | 'shorts'
  | 'skirt'
  | 'dress'
  | 'shoes'
  | 'sneakers'
  | 'boots'
  | 'suit'
  | 'blazer'
  // accessories — bucketed under "Accessories" by subTypeToCategory()
  | 'watch'
  | 'bag'
  | 'belt'
  | 'hat'
  | 'scarf'
  | 'sunglasses'
  | 'tie';

export type ClothingColor =
  | 'black'
  | 'white'
  | 'grey'
  | 'navy blue'
  | 'blue'
  | 'light blue'
  | 'red'
  | 'burgundy'
  | 'green'
  | 'olive'
  | 'beige'
  | 'brown'
  | 'yellow'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'multicolor';

export type SelectOption<T extends string> = { value: T; label: string };

export const CATEGORIES: SelectOption<ClothingCategory>[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'sport', label: 'Sport' },
];

export const FITS: SelectOption<ClothingFit>[] = [
  { value: 'slim', label: 'Slim' },
  { value: 'regular', label: 'Regular' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'oversized', label: 'Oversized' },
];

export const SEASONS: SelectOption<ClothingSeason>[] = [
  { value: 'all', label: 'All Seasons' },
  { value: 'spring_summer', label: 'Spring / Summer' },
  { value: 'autumn_winter', label: 'Autumn / Winter' },
  { value: 'winter', label: 'Winter Only' },
];

export const STATUSES: SelectOption<ClothingStatus>[] = [
  { value: 'clean', label: 'Clean' },
  { value: 'worn', label: 'Worn' },
  { value: 'in_laundry', label: 'In Laundry' },
];

export const SUB_TYPES: SelectOption<ClothingSubType>[] = [
  { value: 'shirt', label: 'Shirt' },
  { value: 't-shirt', label: 'T-Shirt' },
  { value: 'sweater', label: 'Sweater' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'jacket', label: 'Jacket' },
  { value: 'coat', label: 'Coat' },
  { value: 'blazer', label: 'Blazer' },
  { value: 'suit', label: 'Suit' },
  { value: 'pants', label: 'Pants' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'skirt', label: 'Skirt' },
  { value: 'dress', label: 'Dress' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'sneakers', label: 'Sneakers' },
  { value: 'boots', label: 'Boots' },
  // Accessories
  { value: 'watch', label: 'Watch' },
  { value: 'bag', label: 'Bag' },
  { value: 'belt', label: 'Belt' },
  { value: 'hat', label: 'Hat' },
  { value: 'scarf', label: 'Scarf' },
  { value: 'sunglasses', label: 'Sunglasses' },
  { value: 'tie', label: 'Tie' },
];

// Representative hex per named colour. `multicolor` is a gradient (not a hex)
// and is intentionally excluded from nearest-colour matching.
export const COLOR_SWATCHES: Record<ClothingColor, string> = {
  black: '#1a1a1a',
  white: '#f0f0f0',
  grey: '#888888',
  'navy blue': '#1f3a5f',
  blue: '#4a6fa5',
  'light blue': '#6fa3c7',
  red: '#c0392b',
  burgundy: '#800020',
  green: '#27ae60',
  olive: '#6b7c39',
  beige: '#d4bda8',
  brown: '#795548',
  yellow: '#f1c40f',
  orange: '#e67e22',
  pink: '#e91e8c',
  purple: '#9b59b6',
  multicolor: 'linear-gradient(135deg, #e74c3c, #3498db, #2ecc71)',
};

export const COLORS: SelectOption<ClothingColor>[] = (
  Object.keys(COLOR_SWATCHES) as ClothingColor[]
).map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));

export function colorLabel(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}
