import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Briefcase, Scan, Search, Shirt } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';
import type { ClothingCategory, ClothingItem } from '../../../shared/api/types';
import { listItems } from '../api';

type FilterTab = 'All' | ClothingCategory;

const CATEGORY_TABS: FilterTab[] = ['All', 'formal', 'casual', 'sport'];

function categoryIcon(category: ClothingCategory) {
  switch (category) {
    case 'formal':
      return <Briefcase className="h-5 w-5" />;
    case 'casual':
      return <Shirt className="h-5 w-5" />;
    case 'sport':
      return <Activity className="h-5 w-5" />;
  }
}

function ItemCard({ item }: { item: ClothingItem }) {
  return (
    <div className="card-interactive flex flex-col overflow-hidden">
      <div className="flex aspect-square items-center justify-center bg-linen/60">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.sub_type}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              {categoryIcon(item.category)}
            </div>
            <div
              className="h-4 w-4 rounded-full border border-border bg-muted"
              title={item.color}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        <p className="truncate text-sm font-semibold text-foreground">
          {item.sub_type}
        </p>
        <p className="text-xs text-muted-foreground capitalize">{item.color}</p>

        <span className="badge-default w-fit px-2 py-0.5 text-[10px] capitalize">
          {item.category}
        </span>

        {item.last_worn && (
          <p className="text-[10px] text-muted-foreground">
            Worn{' '}
            {new Date(item.last_worn).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

function StatsBar({ items }: { items: ClothingItem[] }) {
  const stats: { label: string; count: number }[] = [
    { label: 'Total', count: items.length },
    { label: 'Formal', count: items.filter((i) => i.category === 'formal').length },
    { label: 'Casual', count: items.filter((i) => i.category === 'casual').length },
    { label: 'Sport', count: items.filter((i) => i.category === 'sport').length },
  ];

  return (
    <div className="mb-6 grid grid-cols-4 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
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
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listItems()
      .then(setItems)
      .catch(() => setError('Failed to load wardrobe items.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesCategory = activeTab === 'All' || item.category === activeTab;
    const matchesSearch =
      normalizedSearch === '' ||
      item.sub_type.toLowerCase().includes(normalizedSearch) ||
      item.color.toLowerCase().includes(normalizedSearch) ||
      item.category.toLowerCase().includes(normalizedSearch);

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

        {loading ? (
          <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="py-20 text-center text-sm text-destructive">{error}</p>
        ) : (
          <>
            <StatsBar items={items} />

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by name, color, or style…"
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
                  className={`shrink-0 cursor-pointer capitalize transition-all ${
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
                    : items.length === 0
                      ? 'Scan your first item to build your wardrobe.'
                      : `No ${activeTab} items in your wardrobe yet.`}
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
