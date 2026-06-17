import { apiClient } from '../../shared/api/client';
import type { OutfitRecommendation } from '../../shared/api/types';

// Which occasion to dress for. eventId dresses for a specific calendar event
// (the server maps its type to an occasion); occasion is the no-event override.
// Empty = let the server default to the day's most-formal event.
export type OutfitOptions = {
  eventId?: string;
  occasion?: 'casual' | 'formal' | 'sport';
};

export async function getOutfit(
  sessionId?: string,
  opts: OutfitOptions = {},
): Promise<OutfitRecommendation> {
  const query: Record<string, string> = {};
  if (sessionId) query.session_id = sessionId;
  if (opts.eventId) query.event_id = opts.eventId;
  if (opts.occasion) query.occasion = opts.occasion;
  const { data } = await apiClient.GET('/recommendations/outfit', {
    params: { query },
  });
  return data!;
}

export async function acceptOutfit(
  itemIds: string[],
  sessionId: string,
): Promise<void> {
  await apiClient.POST('/recommendations/outfit/accept', {
    body: { item_ids: itemIds, session_id: sessionId },
  });
}
