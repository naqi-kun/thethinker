// Tracks whether the daily outfit reveal "ceremony" has already played today,
// so a returning visit on the same day drops straight into the flat-lay instead
// of re-showing the sealed wrapper. Keyed by local calendar date (KAN-100).

const PREFIX = 'thethinker_outfit_revealed_';

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${PREFIX}${y}-${m}-${day}`;
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
