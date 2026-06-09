import type { components } from './schema';

export type AuthResponse = components['schemas']['AuthResponse'];
export type Preferences = components['schemas']['Preferences'];
export type StylePreference = NonNullable<Preferences['styles']>[number];
export type ClothingItem = components['schemas']['ClothingItem'];
export type ClothingCategory = ClothingItem['category'];
export type ClothingFit = NonNullable<ClothingItem['fit']>;
export type ClothingSeason = NonNullable<ClothingItem['season']>;
export type AddItemPayload = components['schemas']['AddItemRequest'];
export type CalendarConnection = components['schemas']['CalendarConnection'];
export type Calendar = components['schemas']['Calendar'];
export type AddCalendarPayload = components['schemas']['AddCalendarRequest'];
export type CalendarEvent = components['schemas']['CalendarEvent'];
export type WorkSchedule = components['schemas']['WorkSchedule'];
export type WeatherSnapshot = components['schemas']['WeatherSnapshot'];
export type OutfitRecommendation = components['schemas']['OutfitRecommendation'];
