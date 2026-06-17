import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeviceLocation, reverseGeocode } from './geocode';

describe('getDeviceLocation (KAN-94)', () => {
  afterEach(() => {
    // @ts-expect-error allow removing the stubbed API between tests
    delete navigator.geolocation;
  });

  function stubGeolocation(impl: Geolocation['getCurrentPosition']) {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: impl },
      configurable: true,
    });
  }

  it('resolves to coords from a successful position', async () => {
    stubGeolocation((success) =>
      success({
        coords: { latitude: 52.52, longitude: 13.405 },
      } as GeolocationPosition),
    );
    await expect(getDeviceLocation()).resolves.toEqual({ lat: 52.52, lon: 13.405 });
  });

  it('rejects when the user denies or it errors', async () => {
    stubGeolocation((_s, error) => error?.({ code: 1 } as GeolocationPositionError));
    await expect(getDeviceLocation()).rejects.toBeTruthy();
  });

  it('rejects when geolocation is unavailable', async () => {
    // No geolocation defined on navigator (insecure context / unsupported).
    await expect(getDeviceLocation()).rejects.toThrow(/not available/i);
  });
});

describe('reverseGeocode (KAN-94)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(body: unknown, ok = true, status = 200) {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok,
      status,
      json: async () => body,
    });
  }

  it('returns the city when present', async () => {
    mockFetch({ city: 'Berlin', locality: 'Mitte' });
    await expect(reverseGeocode(52.52, 13.405)).resolves.toBe('Berlin');
  });

  it('falls back through locality then region when city is blank', async () => {
    mockFetch({ city: '', locality: '', principalSubdivision: 'Bavaria' });
    await expect(reverseGeocode(48.1, 11.6)).resolves.toBe('Bavaria');
  });

  it('throws on a non-ok response', async () => {
    mockFetch({}, false, 503);
    await expect(reverseGeocode(0, 0)).rejects.toThrow(/503/);
  });

  it('throws when no place name can be derived', async () => {
    mockFetch({ city: '', locality: '' });
    await expect(reverseGeocode(0, 0)).rejects.toThrow(/could not determine/i);
  });
});
