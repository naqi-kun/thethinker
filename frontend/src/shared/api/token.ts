const KEY = 'thethinker_token';

export const token = {
  get: (): string | null => localStorage.getItem(KEY),
  set: (value: string): void => localStorage.setItem(KEY, value),
  clear: (): void => localStorage.removeItem(KEY),
};
