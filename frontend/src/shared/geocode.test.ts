import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCities } from './geocode';

describe('searchCities (Photon)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFeatures(
    features: Array<Record<string, unknown>>,
    ok = true,
    status = 200,
  ) {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok,
      status,
      json: async () => ({ features: features.map((properties) => ({ properties })) }),
    });
  }

  it('returns [] for queries shorter than 2 chars without calling the API', async () => {
    await expect(searchCities('k')).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops a same-named lower-tier village (Kuala Lumpur case)', async () => {
    // Mirrors the real Photon response: the Malaysian city is a `state`-tier
    // area, the Indonesian hamlet is a bare `village` node sharing the name.
    mockFeatures([
      { name: 'Kuala Lumpur', osm_value: 'village', country: 'Indonesia' },
      {
        name: 'Kuala Lumpur',
        osm_value: 'state',
        country: 'Malaysia',
        extent: [101.6, 3.2, 101.7, 3.0],
      },
    ]);
    const results = await searchCities('kuala lumpu');
    expect(results).toEqual(['Kuala Lumpur, Malaysia']);
  });

  it('drops fuzzy lookalikes that do not contain the query (country search)', async () => {
    // "Malaysia" is a country we don't search; Photon falls back to typo
    // lookalikes whose names don't actually contain "malaysia".
    mockFeatures([
      { name: 'Mala Vyska', osm_value: 'town', country: 'Ukraine' },
      { name: 'Malaia', osm_value: 'village', country: 'Romania' },
      { name: 'Malausma', osm_value: 'village', country: 'Indonesia' },
    ]);
    await expect(searchCities('malaysia')).resolves.toEqual([]);
  });

  it('keeps genuinely distinct same-name cities of equal tier', async () => {
    // The several US Springfields are all city-tier — none should be dropped.
    mockFeatures([
      {
        name: 'Springfield',
        osm_value: 'city',
        country: 'United States',
        state: 'Illinois',
      },
      {
        name: 'Springfield',
        osm_value: 'city',
        country: 'United States',
        state: 'Missouri',
      },
    ]);
    const results = await searchCities('springfield');
    expect(results).toEqual([
      'Springfield, Illinois, United States',
      'Springfield, Missouri, United States',
    ]);
  });

  it('prefers a feature with an extent when place tiers are equal', async () => {
    mockFeatures([
      { name: 'Springfield', osm_value: 'city', country: 'France' },
      {
        name: 'Springfield',
        osm_value: 'city',
        country: 'United States',
        state: 'Illinois',
        extent: [0, 0, 1, 1],
      },
    ]);
    const results = await searchCities('springfield');
    expect(results[0]).toBe('Springfield, Illinois, United States');
  });

  it('drops duplicate labels', async () => {
    mockFeatures([
      { name: 'Paris', osm_value: 'city', country: 'France' },
      { name: 'Paris', osm_value: 'city', country: 'France' },
    ]);
    await expect(searchCities('paris')).resolves.toEqual(['Paris, France']);
  });

  it('returns [] on a failed response', async () => {
    mockFeatures([], false, 500);
    await expect(searchCities('berlin')).resolves.toEqual([]);
  });
});
