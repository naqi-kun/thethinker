import { describe, expect, it } from 'vitest';
import { AESTHETICS, DEFAULT_AESTHETIC, normalizeAesthetic } from './aesthetics';

describe('normalizeAesthetic (KAN-92)', () => {
  it('falls back to the default when the value is missing', () => {
    expect(normalizeAesthetic(undefined)).toBe(DEFAULT_AESTHETIC);
    expect(normalizeAesthetic('')).toBe(DEFAULT_AESTHETIC);
  });

  it('returns the canonical label for an exact match', () => {
    expect(normalizeAesthetic('Minimalist')).toBe('Minimalist');
    expect(normalizeAesthetic('Old Money')).toBe('Old Money');
  });

  it('canonicalises a legacy lowercase value (what the recommender stores)', () => {
    // The backend persists preferences.answers.aesthetic verbatim, so a value
    // saved as "minimalist" must still light up the "Minimalist" control.
    expect(normalizeAesthetic('minimalist')).toBe('Minimalist');
    expect(normalizeAesthetic('STREETWEAR')).toBe('Streetwear');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(normalizeAesthetic('  Classic  ')).toBe('Classic');
  });

  it('falls back to the default for an unknown vibe', () => {
    // Onboarding still asks a different, looser inspiration vocabulary
    // (e.g. "Street Style", "Business"); those are not canonical aesthetics
    // yet, so they resolve to the default rather than a wrong match.
    expect(normalizeAesthetic('Street Style')).toBe(DEFAULT_AESTHETIC);
    expect(normalizeAesthetic('not-a-real-vibe')).toBe(DEFAULT_AESTHETIC);
  });

  it('round-trips every canonical label through itself', () => {
    for (const a of AESTHETICS) {
      expect(normalizeAesthetic(a)).toBe(a);
    }
  });
});
