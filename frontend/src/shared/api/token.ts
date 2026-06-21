const KEY = 'thethinker_token';

export const token = {
  get: (): string | null => localStorage.getItem(KEY),
  set: (value: string): void => localStorage.setItem(KEY, value),
  clear: (): void => localStorage.removeItem(KEY),
};

// The signed JWT carries the user id in its `sub` claim. Reading it lets
// per-user local caches (e.g. the daily outfit) stay scoped to one account so
// they never bleed across a logout/login on a shared browser. This only decodes
// the payload — it does NOT verify the signature, which is fine because the
// value is used purely to namespace local storage, never to authorize anything.
export function currentUserId(): string | null {
  const t = token.get();
  if (!t) return null;
  try {
    const payload = t.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const claims = JSON.parse(atob(b64 + pad)) as { sub?: string };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}
