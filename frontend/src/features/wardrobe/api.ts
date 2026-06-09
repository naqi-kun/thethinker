import { apiClient } from '../../shared/api/client';
import { token } from '../../shared/api/token';
import type {
  AddItemPayload,
  ClassifyResult,
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

export async function classifyItem(image: Blob): Promise<ClassifyResult> {
  const { data } = await apiClient.POST('/wardrobe/classify', {
    body: { image: image as unknown as string },
    bodySerializer() {
      const form = new FormData();
      form.append('image', image, 'scan.jpg');
      return form;
    },
  });
  return data! as ClassifyResult;
}

export async function uploadItemImage(
  itemId: string,
  file: File,
): Promise<ClothingItem> {
  const authToken = token.get();
  const form = new FormData();
  form.append('image', file);

  const response = await fetch(`/api/wardrobe/items/${itemId}/image`, {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: form,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throw new Error(body.message ?? 'Upload failed');
  }

  return response.json() as Promise<ClothingItem>;
}
