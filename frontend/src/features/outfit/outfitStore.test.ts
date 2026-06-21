import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { token } from '../../shared/api/token';
import type { OutfitRecommendation } from '../../shared/api/types';
import { clearTodayOutfit, loadTodayOutfit, saveTodayOutfit } from './outfitStore';

// A minimal unsigned JWT whose payload carries the user id in `sub` — enough for
// currentUserId() to scope the cache, since it only decodes (never verifies).
function jwtFor(userId: string): string {
  return `header.${btoa(JSON.stringify({ sub: userId }))}.sig`;
}

const rec = { session_id: 's1', items: [] } as unknown as OutfitRecommendation;

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('outfitStore user scoping (KAN-100)', () => {
  it("never restores one account's outfit for a different account", () => {
    token.set(jwtFor('user-a'));
    saveTodayOutfit(rec, 'auto');
    expect(loadTodayOutfit()?.recommendation.session_id).toBe('s1');

    // Switching accounts must show nothing cached — not the first user's look.
    token.set(jwtFor('user-b'));
    expect(loadTodayOutfit()).toBeNull();

    // Switching back restores the original account's cached outfit.
    token.set(jwtFor('user-a'));
    expect(loadTodayOutfit()?.recommendation.session_id).toBe('s1');
  });

  it('clears the current user cache on demand', () => {
    token.set(jwtFor('user-a'));
    saveTodayOutfit(rec, 'auto');
    clearTodayOutfit();
    expect(loadTodayOutfit()).toBeNull();
  });
});
