// The shared aesthetic taxonomy — a single-select list used across onboarding,
// Settings, and (server-side) the stylist prompt. The chosen value is persisted
// under preferences.answers.aesthetic and sent verbatim to the recommender, so
// keep these labels stable.
//
// "Basic" is the plain-language default for people who don't follow fashion —
// it keeps the recommender signal clean ("just keep it simple") instead of
// forcing a vibe they don't identify with. See docs/ux-audit.md, decision 2.
export const AESTHETICS = [
  'Basic',
  'Minimalist',
  'Classic',
  'Old Money',
  'Streetwear',
  'Y2K',
  'Coquette',
  'Cottagecore',
  'Boho',
  'Parisian',
  'Athleisure',
  'Grunge',
  'Preppy',
] as const;

export type Aesthetic = (typeof AESTHETICS)[number];

export const DEFAULT_AESTHETIC: Aesthetic = 'Basic';

// Resolve a stored value (possibly legacy/lowercase, e.g. "minimalist") back to
// a canonical label, falling back to the default when there's no match.
export function normalizeAesthetic(value: string | undefined): Aesthetic {
  if (!value) return DEFAULT_AESTHETIC;
  const match = AESTHETICS.find((a) => a.toLowerCase() === value.trim().toLowerCase());
  return match ?? DEFAULT_AESTHETIC;
}
