// Forward-geocode a partial city name using Photon (Komoot). Photon is built
// on OSM data but exposes a layer=city filter so results are cities/towns only
// — not streets or buildings. Keyless, CORS-enabled. Returns [] on failure so
// callers can leave the plain input usable without suggestions.
export async function searchCities(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url =
    `https://photon.komoot.io/api/` +
    `?q=${encodeURIComponent(trimmed)}&limit=7&layer=city&layer=state`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features: Array<{
        properties: {
          name?: string;
          state?: string;
          country?: string;
        };
      }>;
    };
    const seen = new Set<string>();
    return data.features
      .map(({ properties: p }) => {
        const city = p.name || '';
        const country = p.country || '';
        // Include state only for large countries where cities share names
        // (US, Australia, Canada, India, Brazil) to aid disambiguation.
        const stateCountries = new Set([
          'United States', 'Australia', 'Canada', 'India', 'Brazil',
        ]);
        const state = stateCountries.has(country) ? (p.state || '') : '';
        return [city, state, country].filter(Boolean).join(', ');
      })
      .filter((label) => {
        if (!label || seen.has(label)) return false;
        seen.add(label);
        return true;
      });
  } catch {
    return [];
  }
}
