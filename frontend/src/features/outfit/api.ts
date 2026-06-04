import { apiClient } from '../../shared/api/client';
import type { OutfitRecommendation } from '../../shared/api/types';

export async function getOutfit(): Promise<OutfitRecommendation> {
  const { data } = await apiClient.GET('/recommendations/outfit');
  return data!;
}
