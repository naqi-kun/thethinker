import { apiClient } from '../../shared/api/client';
import type { ClothingItem } from '../../shared/api/types';

export async function listItems(): Promise<ClothingItem[]> {
  const { data } = await apiClient.GET('/wardrobe/items');
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
