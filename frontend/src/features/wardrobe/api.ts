import { apiClient } from '../../shared/api/client';
import { token } from '../../shared/api/token';
import type {
  AddItemPayload,
  ClassifyResult,
  ClothingCategory,
  ClothingItem,
  ClothingStatus,
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

/**
 * Create a wardrobe item and attach its image in one call. Used by the bulk
 * add flow where many reviewed items are committed together.
 */
export async function addItemWithImage(
  payload: AddItemPayload,
  file: File,
): Promise<ClothingItem> {
  const created = await addItem(payload);
  return uploadItemImage(created.id, file);
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

export async function updateItem(
  id: string,
  payload: AddItemPayload,
): Promise<ClothingItem> {
  const { data } = await apiClient.PUT('/wardrobe/items/{id}', {
    params: { path: { id } },
    body: payload,
  });
  return data! as ClothingItem;
}

export async function updateItemStatus(
  id: string,
  status: ClothingStatus,
): Promise<ClothingItem> {
  const { data } = await apiClient.PATCH('/wardrobe/items/{id}/status', {
    params: { path: { id } },
    body: { status },
  });
  return data! as ClothingItem;
}

export async function deleteItem(id: string): Promise<void> {
  await apiClient.DELETE('/wardrobe/items/{id}', { params: { path: { id } } });
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
