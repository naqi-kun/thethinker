// Persists the day's outfit so a refresh or app-switch restores the exact same
// look instead of starting a fresh AI session (which would silently reshuffle).
// Only an explicit Shuffle or "Dressing for" change fetches a new outfit. Keyed
// by local calendar date so a new day naturally fetches fresh (KAN-100 sibling
// to revealStore — same date-key convention).

import { currentUserId } from '../../shared/api/token';
import type { OutfitRecommendation } from '../../shared/api/types';

const PREFIX = 'thethinker_outfit_today_';

type StoredOutfit = {
  recommendation: OutfitRecommendation;
  // The "Dressing for" selection that produced this look ('auto' | 'everyday' |
  // event id) so the picker restores to the right option on reload.
  dressingFor: string;
};

// Cache keys are scoped to the signed-in user so a second account on the same
// browser never restores the first account's outfit (KAN-100).
function userScope(): string {
  return currentUserId() ?? 'anon';
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${PREFIX}${userScope()}_${y}-${m}-${day}`;
}

// Drop any cached outfits from previous days so the payload (a few KB with image
// URLs) can't accumulate in localStorage over time.
function pruneOldDays(keepKey: string): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== keepKey) localStorage.removeItem(k);
    }
  } catch {
    // Best-effort cleanup.
  }
}

export function loadTodayOutfit(): StoredOutfit | null {
  try {
    const raw = localStorage.getItem(todayKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOutfit;
    if (!parsed?.recommendation) return null;
    return parsed;
  } catch {
    // Private mode / corrupt value — behave as if nothing was stored.
    return null;
  }
}

export function saveTodayOutfit(
  recommendation: OutfitRecommendation,
  dressingFor: string,
): void {
  try {
    const key = todayKey();
    localStorage.setItem(key, JSON.stringify({ recommendation, dressingFor }));
    pruneOldDays(key);
  } catch {
    // Best-effort; a failure just means the outfit may reshuffle on reload.
  }
}

// Drop the cached outfit so the next outfit-page mount fetches a fresh AI
// session. The session's brief (aesthetic, occasion, weather) is baked in at
// creation and a shuffle/regenerate never updates it — so when the user changes
// their preferences, the only way the new aesthetic takes effect is to discard
// the cached look and start over (KAN-100).
export function clearTodayOutfit(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // Best-effort.
  }
}
