import { apiClient } from '../../shared/api/client';
import type { AddItemPayload, ClothingItem } from '../../shared/api/types';

export async function listItems(category?: string): Promise<ClothingItem[]> {
  const { data } = await apiClient.GET('/wardrobe/items', {
    params: { query: category ? { category: category as ClothingItem['category'] } : undefined },
  });
  return data!;
}

export async function addItem(payload: AddItemPayload): Promise<ClothingItem> {
  const { data } = await apiClient.POST('/wardrobe/items', { body: payload });
  return data!;
}

export async function scanItem(image: Blob): Promise<ClothingItem> {
  const { data } = await apiClient.POST('/wardrobe/scan', {
    body: { image: image as unknown as string },
    bodySerializer() {
      const form = new FormData();
      form.append('image', image, 'scan.jpg');
      return form;
    },
  });
  return data!;
}
