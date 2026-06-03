import { apiRequest } from '../../shared/api/httpClient';
import { token } from '../../shared/api/token';
import type { AddItemPayload, ClothingItem } from '../../shared/api/types';

export function listItems(category?: string): Promise<ClothingItem[]> {
  const query = category ? `?category=${category}` : '';
  return apiRequest<ClothingItem[]>(`/wardrobe/items${query}`, {
    token: token.get() ?? undefined,
  });
}

export function addItem(payload: AddItemPayload): Promise<ClothingItem> {
  return apiRequest<ClothingItem>('/wardrobe/items', {
    method: 'POST',
    body: payload,
    token: token.get() ?? undefined,
  });
}
