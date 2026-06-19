// KAN-94: the Location step leads with one-tap device geolocation. Our weather
// backend (OpenWeatherMap) is queried by city name, so we resolve coords to a
// city string client-side and store that. KAN-111 will replace this shim with a
// precise coords path through the backend.
//
// KAN-132: searchCities added for manual-entry autocomplete (Nominatim, keyless).

export type Coords = { lat: number; lon: number };

// Promisified geolocation with a bounded wait. Rejects on denial, timeout, or
// when the API is unavailable (e.g. insecure context) so the caller can fall
// back to manual city entry.
export function getDeviceLocation(timeoutMs = 10_000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

// BigDataCloud's reverse-geocode-client endpoint is keyless and CORS-enabled,
// so it works straight from the browser. We want a human city name that
// OpenWeatherMap's `q=` lookup understands; fall back through the locality and
// region fields when the city is blank (rural coords, oceans, etc.).
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Reverse geocode failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
  };
  const city = (data.city || data.locality || data.principalSubdivision || '').trim();
  if (!city) {
    throw new Error('Could not determine a city from your location');
  }
  return city;
}

// Forward-geocode a partial city name and return up to 5 human-readable
// "City, Country" strings. Uses Nominatim (OpenStreetMap) which is keyless
// and CORS-enabled. Returns [] on any network/parse failure so the input
// remains usable without suggestions.
export async function searchCities(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=5`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        country?: string;
      };
    }>;
    return data
      .map((item) => {
        const a = item.address ?? {};
        const city = a.city || a.town || a.village || a.county || '';
        const country = a.country || '';
        return [city, country].filter(Boolean).join(', ');
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
