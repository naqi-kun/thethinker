// Convenience aliases over the auto-generated schema — do not add manual type definitions here.
// To add or change a type, update api/openapi.yaml and re-run: npm run gen:api
import type { components } from './schema';

export type AuthResponse = components['schemas']['AuthResponse'];
export type Preferences = components['schemas']['Preferences'];
export type StylePreference = NonNullable<Preferences['styles']>[number];
export type ClothingItem = components['schemas']['ClothingItem'];
export type ClothingCategory = ClothingItem['category'];
export type CalendarConnection = components['schemas']['CalendarConnection'];
export type WeatherSnapshot = components['schemas']['WeatherSnapshot'];
export type OutfitRecommendation = components['schemas']['OutfitRecommendation'];
