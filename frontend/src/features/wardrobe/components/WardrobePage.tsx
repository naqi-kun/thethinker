import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footprints, Scan, Search, Shirt, ShoppingBag, Watch } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';

type WardrobeCategory = 'Tops' | 'Bottoms' | 'Shoes' | 'Outerwear' | 'Accessories';
type FilterTab = 'All' | WardrobeCategory;

interface WardrobeItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  color: string;
  tags: string[];
  season?: string;
  lastWorn?: string;
  imageUrl?: string;
}

const MOCK_ITEMS: WardrobeItem[] = [
  {
    id: '1',
    name: 'White Oxford Shirt',
    category: 'Tops',
    color: 'White',
    tags: ['formal', 'business casual'],
    season: 'All season',
    lastWorn: '2 days ago',
  },
  {
    id: '2',
    name: 'Black T-Shirt',
    category: 'Tops',
    color: 'Black',
    tags: ['casual', 'streetwear'],
    season: 'All season',
    lastWorn: 'Yesterday',
  },
  {
    id: '3',
    name: 'Straight Blue Jeans',
    category: 'Bottoms',
    color: 'Blue',
    tags: ['casual', 'smart casual'],
    season: 'All season',
    lastWorn: '3 days ago',
  },
  {
    id: '4',
    name: 'Charcoal Trousers',
    category: 'Bottoms',
    color: 'Charcoal',
    tags: ['formal', 'business casual'],
    season: 'All season',
    lastWorn: '1 week ago',
  },
  {
    id: '5',
    name: 'White Sneakers',
    category: 'Shoes',
    color: 'White',
    tags: ['casual', 'sport'],
    season: 'Spring / Summer',
    lastWorn: 'Today',
  },
  {
    id: '6',
    name: 'Tan Loafers',
    category: 'Shoes',
    color: 'Tan',
    tags: ['smart casual', 'business casual'],
    season: 'Spring / Autumn',
    lastWorn: '4 days ago',
  },
  {
    id: '7',
    name: 'Navy Blazer',
    category: 'Outerwear',
    color: 'Navy',
    tags: ['formal', 'smart casual'],
    season: 'Autumn / Winter',
    lastWorn: '2 weeks ago',
  },
  {
    id: '8',
    name: 'Silver Watch',
    category: 'Accessories',
    color: 'Silver',
    tags: ['formal', 'smart casual'],
    season: 'All season',
    lastWorn: 'Yesterday',
  },
];

const CATEGORY_TABS: FilterTab[] = [
  'All',
  'Tops',
  'Bottoms',
  'Shoes',
  'Outerwear',
  'Accessories',
];

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
    White: '#f5f5f5',
    Black: '#1a1a1a',
    Blue: '#4a6fa5',
    Charcoal: '#4a4a4a',
    Tan: '#c9a96e',
    Navy: '#1f3a5f',
    Silver: '#a8a8b3',
  };

  return map[color] ?? '#d4bda8';
}

function ReadinessHint({ items }: { items: WardrobeItem[] }) {
  const hasTops = items.some((item) => item.category === 'Tops');
  const hasBottoms = items.some((item) => item.category === 'Bottoms');
  const hasShoes = items.some((item) => item.category === 'Shoes');
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

function ItemCard({ item }: { item: WardrobeItem }) {
  return (
    <div className="card-interactive flex flex-col overflow-hidden">
      <div className="flex aspect-square items-center justify-center bg-linen/60">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              {categoryIcon(item.category)}
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
        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.color}</p>

        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="badge-default px-2 py-0.5 text-[10px]">
              {tag}
            </span>
          ))}
        </div>

        {(item.lastWorn ?? item.season) && (
          <p className="text-[10px] text-muted-foreground">
            {item.lastWorn ? `Worn ${item.lastWorn}` : item.season}
          </p>
        )}
      </div>
    </div>
  );
}

function StatsBar({ items }: { items: WardrobeItem[] }) {
  const stats: { label: string; count: number }[] = [
    { label: 'Total', count: items.length },
    { label: 'Tops', count: items.filter((item) => item.category === 'Tops').length },
    {
      label: 'Bottoms',
      count: items.filter((item) => item.category === 'Bottoms').length,
    },
    { label: 'Shoes', count: items.filter((item) => item.category === 'Shoes').length },
    {
      label: 'Other',
      count: items.filter(
        (item) => item.category === 'Accessories' || item.category === 'Outerwear',
      ).length,
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
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('All');

  const filtered = MOCK_ITEMS.filter((item) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesCategory = activeTab === 'All' || item.category === activeTab;
    const matchesSearch =
      normalizedSearch === '' ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.color.toLowerCase().includes(normalizedSearch) ||
      item.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));

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
          <button
            onClick={() => navigate('/wardrobe/scan')}
            className="btn-primary btn-sm mt-1 shrink-0 gap-1.5"
          >
            <Scan className="h-4 w-4" />
            Scan item
          </button>
        </div>

        <StatsBar items={MOCK_ITEMS} />
        <ReadinessHint items={MOCK_ITEMS} />

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
              onClick={() => navigate('/wardrobe/scan')}
              className="btn-primary btn-md gap-2"
            >
              <Scan className="h-4 w-4" />
              Scan Your First Item
            </button>
          </div>
        )}
      </main>

      {MOCK_ITEMS.length > 0 && (
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
