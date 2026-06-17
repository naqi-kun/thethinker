import { apiClient } from '../../shared/api/client';
import type { Preferences } from '../../shared/api/types';
import { DEFAULT_AESTHETIC, type Aesthetic } from '../../shared/aesthetics';

// KAN-94: onboarding asks only what the recommender consumes and the user can
// edit later — the aesthetic (shared taxonomy, KAN-92) and a location for
// weather. Everything the old 8-step flow collected (occasions, skin tone,
// body/face shape, height, palette, climate) is dropped per KAN-104.
export type OnboardingAnswers = {
  aesthetic: Aesthetic;
  location: string;
};

export const EMPTY_ANSWERS: OnboardingAnswers = {
  aesthetic: DEFAULT_AESTHETIC,
  location: '',
};

export function buildPreferences(answers: OnboardingAnswers): Preferences {
  return {
    styles: [],
    answers: {
      aesthetic: answers.aesthetic,
      location: answers.location.trim(),
    },
    use_ai: true,
  };
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await apiClient.PUT('/users/me/preferences', { body: prefs });
}
