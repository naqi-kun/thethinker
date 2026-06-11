import { apiClient } from '../../shared/api/client';
import type { OutfitRecommendation } from '../../shared/api/types';

export async function getOutfit(sessionId?: string): Promise<OutfitRecommendation> {
  const { data } = await apiClient.GET('/recommendations/outfit', {
    params: { query: sessionId ? { session_id: sessionId } : {} },
  });
  return data!;
}

export async function acceptOutfit(itemIds: string[], sessionId: string): Promise<void> {
  await apiClient.POST('/recommendations/outfit/accept', {
    body: { item_ids: itemIds, session_id: sessionId },
  });
}
