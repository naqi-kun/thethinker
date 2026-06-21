// Place-type ranking. Photon does not sort by importance/population, so we
// score OSM place types ourselves: a capital outranks a same-named hamlet.
const TIER: Record<string, number> = {
  state: 6,
  region: 6,
  county: 5,
  city: 4,
  town: 3,
  village: 2,
  hamlet: 1,
};
const tierOf = (osmValue?: string) => TIER[osmValue ?? ''] ?? 0;

// Lowercase + strip accents so "São Paulo" matches a "sao paulo" query.
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

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
          osm_value?: string;
          extent?: number[];
        };
      }>;
    };
    const q = normalize(trimmed);

    // Photon is typo-tolerant, so a query with no real match still returns
    // lookalikes (e.g. "Malaysia" — a country we don't search — yields
    // "Mala Vyska, Ukraine"). Drop anything whose name doesn't actually
    // contain what was typed.
    const matched = data.features.filter((f) => {
      const name = normalize(f.properties.name ?? '');
      return name.length > 0 && name.includes(q);
    });

    // For each place name, keep only its highest-tier feature(s). This drops a
    // low-tier village that shares a major city's name ("Kuala Lumpur,
    // Indonesia" — a real OSM village) while preserving genuinely distinct
    // same-name cities (e.g. the several US Springfields, all city-tier).
    const maxTierByName = new Map<string, number>();
    for (const f of matched) {
      const name = normalize(f.properties.name ?? '');
      maxTierByName.set(
        name,
        Math.max(maxTierByName.get(name) ?? 0, tierOf(f.properties.osm_value)),
      );
    }

    const seen = new Set<string>();
    return (
      matched
        .filter(
          (f) =>
            tierOf(f.properties.osm_value) ===
            maxTierByName.get(normalize(f.properties.name ?? '')),
        )
        // Sort by place-type tier, then prefer features with an `extent`
        // (areas/cities) over bare point nodes.
        .sort((a, b) => {
          const tier = tierOf(b.properties.osm_value) - tierOf(a.properties.osm_value);
          if (tier !== 0) return tier;
          return (b.properties.extent ? 1 : 0) - (a.properties.extent ? 1 : 0);
        })
        .map(({ properties: p }) => {
          const city = p.name || '';
          const country = p.country || '';
          // Include state only for large countries where cities share names
          // (US, Australia, Canada, India, Brazil) to aid disambiguation.
          const stateCountries = new Set([
            'United States',
            'Australia',
            'Canada',
            'India',
            'Brazil',
          ]);
          const state = stateCountries.has(country) ? p.state || '' : '';
          return [city, state, country].filter(Boolean).join(', ');
        })
        .filter((label) => {
          if (!label || seen.has(label)) return false;
          seen.add(label);
          return true;
        })
    );
  } catch {
    return [];
  }
}
