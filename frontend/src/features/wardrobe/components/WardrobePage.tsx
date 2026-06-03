import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Footprints,
  Plus,
  Scan,
  Search,
  Shirt,
  ShoppingBag,
  Watch,
} from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';
import { listItems } from '../api';
import type { ClothingItem, ClothingSeason } from '../../../shared/api/types';

type WardrobeCategory = 'Tops' | 'Bottoms' | 'Shoes' | 'Outerwear' | 'Accessories';
type FilterTab = 'All' | WardrobeCategory;

const CATEGORY_TABS: FilterTab[] = [
  'All',
  'Tops',
  'Bottoms',
  'Shoes',
  'Outerwear',
  'Accessories',
];

function subTypeToCategory(subType: string): WardrobeCategory {
  const s = subType.toLowerCase();
  if (
    ['shirt', 't-shirt', 'blouse', 'top', 'sweater', 'hoodie', 'tee'].some((t) =>
      s.includes(t),
    )
  )
    return 'Tops';
  if (['pants', 'jeans', 'trousers', 'shorts', 'skirt'].some((t) => s.includes(t)))
    return 'Bottoms';
  if (
    ['shoes', 'sneakers', 'boots', 'loafers', 'sandals', 'heels'].some((t) =>
      s.includes(t),
    )
  )
    return 'Shoes';
  if (['jacket', 'coat', 'blazer', 'cardigan', 'outerwear'].some((t) => s.includes(t)))
    return 'Outerwear';
  return 'Accessories';
}

function seasonLabel(season: ClothingSeason): string {
  switch (season) {
    case 'all':
      return 'All seasons';
    case 'spring_summer':
      return 'Spring / Summer';
    case 'autumn_winter':
      return 'Autumn / Winter';
    case 'winter':
      return 'Winter only';
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function categoryIcon(category: WardrobeCategory) {
  switch (category) {
    case 'Tops':
      return <Shirt className="h-5 w-5" />;
    case 'Bottoms':
      return <Shirt className="h-5 w-5" />;
    case 'Shoes':
      return <Footprints className="h-5 w-5" />;
    case 'Outerwear':
      return <ShoppingBag className="h-5 w-5" />;
    case 'Accessories':
      return <Watch className="h-5 w-5" />;
  }
}

function colorSwatch(color: string) {
  const map: Record<string, string> = {
    white: '#f5f5f5',
    black: '#1a1a1a',
    blue: '#4a6fa5',
    charcoal: '#4a4a4a',
    tan: '#c9a96e',
    navy: '#1f3a5f',
    silver: '#a8a8b3',
    grey: '#888888',
    gray: '#888888',
    red: '#c0392b',
    green: '#27ae60',
    brown: '#795548',
    beige: '#d4bda8',
  };
  return map[color.toLowerCase()] ?? '#d4bda8';
}

function ReadinessHint({ items }: { items: ClothingItem[] }) {
  const cats = items.map((item) => subTypeToCategory(item.sub_type));
  const hasTops = cats.includes('Tops');
  const hasBottoms = cats.includes('Bottoms');
  const hasShoes = cats.includes('Shoes');
  const ready = hasTops && hasBottoms && hasShoes;
  const missing: string[] = [];
  if (!hasTops) missing.push('tops');
  if (!hasBottoms) missing.push('bottoms');
  if (!hasShoes) missing.push('shoes');

  return (
    <div
      className={`mb-6 rounded-xl border p-4 ${
        ready ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'
      }`}
    >
      <p className="text-sm font-semibold text-foreground">
        {ready ? 'Ready for outfit recommendations' : 'Almost ready'}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {ready
          ? 'You have enough items for daily outfit suggestions.'
          : `Add ${missing.join(', ')} to unlock outfit recommendations.`}
      </p>
    </div>
  );
}

function ItemCard({ item }: { item: ClothingItem }) {
  const category = subTypeToCategory(item.sub_type);
  const displayName = `${capitalize(item.color)} ${item.sub_type}`;
  const tags = [item.category, item.fit];

  return (
    <div className="card-interactive flex flex-col overflow-hidden">
      <div className="flex aspect-square items-center justify-center bg-linen/60">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              {categoryIcon(category)}
            </div>
            <div
              className="h-4 w-4 rounded-full border border-border"
              style={{ backgroundColor: colorSwatch(item.color) }}
              title={item.color}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
        <p className="text-xs text-muted-foreground">{item.color}</p>

        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="badge-default px-2 py-0.5 text-[10px]">
              {tag}
            </span>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">
          {item.last_worn ? `Worn ${item.last_worn}` : seasonLabel(item.season)}
        </p>
      </div>
    </div>
  );
}

function StatsBar({ items }: { items: ClothingItem[] }) {
  const cats = items.map((item) => subTypeToCategory(item.sub_type));
  const stats: { label: string; count: number }[] = [
    { label: 'Total', count: items.length },
    { label: 'Tops', count: cats.filter((c) => c === 'Tops').length },
    { label: 'Bottoms', count: cats.filter((c) => c === 'Bottoms').length },
    { label: 'Shoes', count: cats.filter((c) => c === 'Shoes').length },
    {
      label: 'Other',
      count: cats.filter((c) => c === 'Accessories' || c === 'Outerwear').length,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-5 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
      {stats.map(({ label, count }) => (
        <div key={label} className="flex flex-col items-center py-3">
          <span className="font-serif text-xl font-normal text-foreground">
            {count}
          </span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function WardrobePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('All');

  useEffect(() => {
    listItems()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => {
    const category = subTypeToCategory(item.sub_type);
    const normalizedSearch = search.trim().toLowerCase();
    const matchesCategory = activeTab === 'All' || category === activeTab;
    const displayName = `${item.color} ${item.sub_type}`.toLowerCase();
    const matchesSearch =
      normalizedSearch === '' ||
      displayName.includes(normalizedSearch) ||
      item.color.toLowerCase().includes(normalizedSearch) ||
      item.category.includes(normalizedSearch) ||
      item.fit.includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen-safe bg-background pb-24">
      <TopNav />

      <main className="container-app py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1">Wardrobe</h2>
            <p className="helper-text">Your scanned closet, always in order.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 mt-1">
            <button
              onClick={() => navigate('/wardrobe/scan')}
              className="btn-primary btn-sm gap-1.5"
            >
              <Scan className="h-4 w-4" />
              Scan item
            </button>
            <button
              onClick={() => navigate('/wardrobe/add')}
              className="btn-secondary btn-sm gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add manually
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center helper-text">Loading…</div>
        ) : (
          <>
            <StatsBar items={items} />
            <ReadinessHint items={items} />

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by name, color, or style..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-9"
              />
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 cursor-pointer transition-all ${
                    activeTab === tab ? 'badge-primary' : 'badge-outline'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                  <Shirt className="h-8 w-8 text-muted-foreground" />
                </div>
                <h5 className="mb-1">No items found</h5>
                <p className="helper-text mb-6">
                  {search
                    ? `No results for "${search}". Try a different search term.`
                    : `You have no ${activeTab.toLowerCase()} in your wardrobe yet.`}
                </p>
                <button
                  onClick={() => navigate('/wardrobe/add')}
                  className="btn-primary btn-md gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Item
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="container-app py-4">
            <button
              onClick={() => navigate('/outfit')}
              className="btn-primary btn-lg w-full"
            >
              Get Outfit Recommendation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
