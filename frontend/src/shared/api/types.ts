export type AuthResponse = {
  token: string;
  user_id: string;
};

export type StylePreference =
  | 'formal'
  | 'casual'
  | 'sport'
  | 'streetwear'
  | 'business_casual';

export type ClothingCategory = 'formal' | 'casual' | 'sport';

export type Preferences = {
  styles: StylePreference[];
  answers: Record<string, string>;
};

export type ClothingItem = {
  id: string;
  category: ClothingCategory;
  sub_type: string;
  color: string;
  image_url?: string;
  last_worn?: string | null;
};

export type CalendarConnection = {
  provider: 'google' | 'apple';
  connected_at: string;
};

export type WeatherSnapshot = {
  temperature: number;
  feels_like: number;
  description: string;
};

export type OutfitRecommendation = {
  date: string;
  occasion: string;
  weather: WeatherSnapshot;
  items: ClothingItem[];
};
