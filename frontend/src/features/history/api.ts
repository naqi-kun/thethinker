import { apiClient } from '../../shared/api/client';
import type { OutfitHistoryResponse } from '../../shared/api/types';

interface ListHistoryParams {
  cursor?: string;
  limit?: number;
  range?: 'week' | 'month' | 'season' | 'all';
  time_of_day?: 'morning' | 'afternoon' | 'evening';
}

export async function listHistory(
  params: ListHistoryParams = {},
): Promise<OutfitHistoryResponse> {
  const query: Record<string, string> = {};
  if (params.cursor) query.cursor = params.cursor;
  if (params.limit) query.limit = String(params.limit);
  if (params.range) query.range = params.range;
  if (params.time_of_day) query.time_of_day = params.time_of_day;

  const { data, error } = await apiClient.GET('/recommendations/history', {
    params: { query },
  });
  if (error) throw error;
  return data;
}
