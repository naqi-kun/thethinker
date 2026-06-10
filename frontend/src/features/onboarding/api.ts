import { apiClient } from '../../shared/api/client';
import type { Preferences, StylePreference } from '../../shared/api/types';

const STYLE_MAP: Record<string, StylePreference> = {
  Casual: 'casual',
  'Smart Casual': 'business_casual',
  Formal: 'formal',
  Sporty: 'sport',
};

export type OnboardingAnswers = {
  style: string;
  occasions: string[];
  inspiration: string[];
  skinTone: string;
  bodyShape: string;
  height: string;
  faceShape: string;
  palette: string;
  location: string;
  climate: string;
};

export function buildPreferences(answers: OnboardingAnswers): Preferences {
  return {
    styles: STYLE_MAP[answers.style] ? [STYLE_MAP[answers.style]] : [],
    answers: {
      occasions: answers.occasions.join(','),
      inspiration: answers.inspiration.join(','),
      skin_tone: answers.skinTone,
      body_shape: answers.bodyShape,
      height: answers.height,
      face_shape: answers.faceShape,
      palette: answers.palette,
      location: answers.location,
      climate: answers.climate,
    },
  };
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await apiClient.PUT('/users/me/preferences', { body: prefs });
}
