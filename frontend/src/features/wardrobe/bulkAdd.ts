// Pure, framework-free helpers for the bulk add (scan many items at once) flow.
// Kept out of the React component so they are trivially unit-testable.
import type {
  AddItemPayload,
  ClassifyResult,
  ClothingCategory,
  ClothingFit,
  ClothingSeason,
} from '../../shared/api/types';
import { suggestName } from './colorMatch';
import type { ClothingColor, ClothingPattern, ClothingSubType } from './options';

export type ScanStatus = 'processing' | 'done' | 'failed';

/** One photo moving through the bulk flow: upload → classify → review. */
export type ScanItem = {
  /** Local-only id (not the server item id, which is assigned on "Add All"). */
  id: string;
  blob: Blob;
  /** Object URL for the thumbnail; revoked when the item leaves the flow. */
  url: string;
  status: ScanStatus;
  /** Friendly message when status is 'failed' (e.g. not a clothing item). */
  error?: string;
  /**
   * Set when committing this item in "Add All" failed (create or image upload).
   * Distinct from `error` (classification) so a complete item can stay addable
   * and be retried while still showing why the last attempt failed.
   */
  addError?: string;
  confidence?: number;
  // Editable, contract-aligned fields (seeded from the classifier).
  name: string;
  category: ClothingCategory | '';
  sub_type: ClothingSubType | '';
  color: ClothingColor | '';
  fit: ClothingFit | '';
  season: ClothingSeason | '';
  pattern: ClothingPattern | '';
};

export type ScanFields = Pick<
  ScanItem,
  'name' | 'category' | 'sub_type' | 'color' | 'fit' | 'season'
>;

/** Seed the editable fields of a scan item from a classifier result. */
export function seedFields(result: ClassifyResult): ScanFields {
  const color = (result.color as ClothingColor) ?? '';
  const sub_type = (result.sub_type as ClothingSubType) ?? '';
  return {
    name: suggestName(color, sub_type),
    category: (result.category as ClothingCategory) ?? '',
    sub_type,
    color,
    fit: (result.fit as ClothingFit) ?? '',
    season: (result.season as ClothingSeason) ?? '',
    pattern: (result.pattern as ClothingPattern) ?? 'solid',
  };
}

/**
 * True when an item has every attribute the wardrobe requires, so it can be
 * committed without opening the edit sheet. Mirrors ReviewItemPage's canSubmit.
 */
export function itemIsComplete(item: ScanFields): boolean {
  return (
    item.category !== '' &&
    item.sub_type !== '' &&
    item.color !== '' &&
    item.fit !== '' &&
    item.season !== ''
  );
}

/** Convert a (complete) scan item into the create-item request body. */
export function toPayload(item: ScanItem): AddItemPayload {
  return {
    name: item.name.trim(),
    category: item.category,
    sub_type: item.sub_type,
    color: item.color,
    fit: item.fit,
    season: item.season,
    pattern: item.pattern || 'solid',
  } as AddItemPayload;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/**
 * Build the multipart File to upload for a scan item, preserving the source
 * image's MIME type and giving it a matching extension. Avoids tagging every
 * upload as `scan.jpg`/`image/jpeg`, which mislabels PNG/WebP photos.
 */
export function toUploadFile(item: Pick<ScanItem, 'blob'>): File {
  const type = item.blob.type || 'image/jpeg';
  const ext = MIME_EXTENSIONS[type] ?? 'jpg';
  return new File([item.blob], `scan.${ext}`, { type });
}

/**
 * Run `fn` over `items` with at most `limit` in flight at once, preserving
 * input order in the result. Used to fan classification calls out without
 * hammering the AI service with one request per photo simultaneously.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
