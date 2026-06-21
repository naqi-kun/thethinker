// Tracks whether the daily outfit reveal "ceremony" has already played today,
// so a returning visit on the same day drops straight into the flat-lay instead
// of re-showing the sealed wrapper. Keyed by signed-in user + local calendar
// date so a second account on the same browser still gets its own reveal and
// doesn't inherit the first account's "already revealed" flag (KAN-100).

import { currentUserId } from '../../shared/api/token';

const PREFIX = 'thethinker_outfit_revealed_';

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const user = currentUserId() ?? 'anon';
  return `${PREFIX}${user}_${y}-${m}-${day}`;
}

export function hasRevealedToday(): boolean {
  try {
    return localStorage.getItem(todayKey()) === '1';
  } catch {
    // Private mode / storage disabled — fall back to always showing the reveal.
    return false;
  }
}

export function markRevealedToday(): void {
  try {
    localStorage.setItem(todayKey(), '1');
  } catch {
    // Best-effort; a failure just means the ceremony may replay later.
  }
}
