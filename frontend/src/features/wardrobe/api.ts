import { apiClient } from '../../shared/api/client';
import type {
  AddItemPayload,
  ClothingCategory,
  ClothingItem,
} from '../../shared/api/types';

export async function listItems(category?: ClothingCategory): Promise<ClothingItem[]> {
  const { data } = await apiClient.GET('/wardrobe/items', {
    params: { query: category ? { category } : undefined },
  });
  return (data ?? []) as ClothingItem[];
}

export async function addItem(payload: AddItemPayload): Promise<ClothingItem> {
  const { data } = await apiClient.POST('/wardrobe/items', { body: payload });
  return data! as ClothingItem;
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
  return data! as ClothingItem;
}
