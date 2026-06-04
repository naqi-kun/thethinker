import { apiClient } from '../../shared/api/client';
import type { Preferences, StylePreference } from '../../shared/api/types';

const STYLE_MAP: Record<string, StylePreference> = {
  Casual: 'casual',
  'Smart Casual': 'business_casual',
  Formal: 'formal',
  Sporty: 'sport',
};

type OnboardingAnswers = {
  style: string;
  occasions: string[];
  palette: string;
  climate: string;
};

export function buildPreferences(answers: OnboardingAnswers): Preferences {
  return {
    styles: STYLE_MAP[answers.style] ? [STYLE_MAP[answers.style]] : [],
    answers: {
      occasions: answers.occasions.join(','),
      palette: answers.palette,
      climate: answers.climate,
    },
  };
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await apiClient.PUT('/users/me/preferences', { body: prefs });
}
