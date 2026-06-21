import { describe, expect, it } from 'vitest';
import type { ClassifyResult } from '../../shared/api/types';
import {
  itemIsComplete,
  mapWithConcurrency,
  seedFields,
  toPayload,
  toUploadFile,
  type ScanItem,
} from './bulkAdd';

const fullResult = {
  category: 'casual',
  sub_type: 'jeans',
  color: 'navy blue',
  fit: 'slim',
  season: 'all',
  confidence_score: 0.9,
} as unknown as ClassifyResult;

describe('seedFields', () => {
  it('maps a classifier result onto editable fields and suggests a name', () => {
    const f = seedFields(fullResult);
    expect(f).toMatchObject({
      category: 'casual',
      sub_type: 'jeans',
      color: 'navy blue',
      fit: 'slim',
      season: 'all',
    });
    expect(f.name).toBe('Navy blue Jeans');
  });

  it('leaves missing attributes blank', () => {
    const f = seedFields({ confidence_score: 0.2 } as unknown as ClassifyResult);
    expect(f.category).toBe('');
    expect(f.color).toBe('');
  });
});

describe('itemIsComplete', () => {
  it('is true when every attribute is set', () => {
    expect(itemIsComplete(seedFields(fullResult))).toBe(true);
  });

  it('is false when any attribute is blank', () => {
    expect(itemIsComplete({ ...seedFields(fullResult), fit: '' })).toBe(false);
  });
});

describe('toPayload', () => {
  it('trims the name and carries attributes through', () => {
    const item = {
      ...seedFields(fullResult),
      name: '  Navy blue Jeans  ',
    } as ScanItem;
    expect(toPayload(item)).toEqual({
      name: 'Navy blue Jeans',
      category: 'casual',
      sub_type: 'jeans',
      color: 'navy blue',
      fit: 'slim',
      season: 'all',
      pattern: 'solid',
    });
  });
});

describe('toUploadFile', () => {
  it('preserves the source MIME type and gives it a matching extension', () => {
    const png = toUploadFile({ blob: new Blob(['x'], { type: 'image/png' }) });
    expect(png.type).toBe('image/png');
    expect(png.name).toBe('scan.png');
  });

  it('falls back to jpeg for an unknown or missing type', () => {
    const unknown = toUploadFile({ blob: new Blob(['x'], { type: 'image/heic' }) });
    expect(unknown.name).toBe('scan.jpg');

    const blank = toUploadFile({ blob: new Blob(['x']) });
    expect(blank.type).toBe('image/jpeg');
    expect(blank.name).toBe('scan.jpg');
  });
});

describe('mapWithConcurrency', () => {
  it('preserves order and processes every item', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        await Promise.resolve();
        inFlight--;
      },
    );
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async (n) => n)).toEqual([]);
  });
});
