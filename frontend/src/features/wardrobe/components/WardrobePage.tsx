import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, Shirt, Trash2 } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';

type Garment = {
  id: number;
  name: string;
  category: string;
  color: string;
  clean: boolean;
};

type FilterTab = 'all' | 'clean' | 'dirty';

const initialGarments: Garment[] = [
  { id: 1, name: 'Linen Button-Up', category: 'Shirt', color: 'Ivory', clean: true },
  { id: 2, name: 'Selvedge Denim', category: 'Pants', color: 'Indigo', clean: false },
  {
    id: 3,
    name: 'Cashmere Crewneck',
    category: 'Knitwear',
    color: 'Camel',
    clean: true,
  },
  {
    id: 4,
    name: 'Oversized Blazer',
    category: 'Outerwear',
    color: 'Charcoal',
    clean: true,
  },
];

export default function WardrobePage() {
  const navigate = useNavigate();
  const [garments, setGarments] = useState<Garment[]>(initialGarments);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filtered = garments.filter((g) => {
    if (activeFilter === 'clean') return g.clean;
    if (activeFilter === 'dirty') return !g.clean;
    return true;
  });

  function toggleStatus(id: number) {
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, clean: !g.clean } : g)),
    );
  }

  function removeGarment(id: number) {
    setGarments((prev) => prev.filter((g) => g.id !== id));
  }

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'clean', label: 'Clean' },
    { key: 'dirty', label: 'Dirty' },
  ];

  return (
    <div className="min-h-screen-safe bg-background pb-44">
      <TopNav />

      <main className="mx-auto max-w-xl px-6 py-10">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <h2>My Wardrobe</h2>
          <span className="rounded-full bg-rust px-3 py-1 font-sans text-sm font-medium text-cream">
            {garments.length}
          </span>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex gap-2">
          {filters.map(({ key, label }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={
                  isActive
                    ? 'rounded-full bg-rust px-5 py-2 font-sans text-sm font-medium text-cream'
                    : 'rounded-full border border-border bg-transparent px-5 py-2 font-sans text-sm font-medium text-foreground hover:bg-secondary'
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Garment list */}
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((garment) => (
              <GarmentCard
                key={garment.id}
                garment={garment}
                onToggle={toggleStatus}
                onRemove={removeGarment}
              />
            ))}
          </div>
        ) : (
          <EmptyState filter={activeFilter} onScan={() => navigate('/wardrobe/scan')} />
        )}
      </main>

      {/* Sticky bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-xl space-y-2 px-6 py-4">
          <button
            onClick={() => navigate('/wardrobe/scan')}
            className="btn-primary btn-lg w-full gap-2"
          >
            <Scan className="h-4 w-4" />
            Scan New Item
          </button>
          <button
            onClick={() => navigate('/outfit')}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-linen/70 font-sans text-base font-medium text-rust transition-colors hover:bg-linen"
          >
            <Shirt className="h-4 w-4" />
            Get Outfit Recommendation
          </button>
        </div>
      </div>
    </div>
  );
}

function GarmentCard({
  garment,
  onToggle,
  onRemove,
}: {
  garment: Garment;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="flex items-stretch gap-4 rounded-xl bg-linen/50 p-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-cream text-terracotta">
        <Shirt className="h-7 w-7" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <p className="font-sans font-semibold text-foreground">{garment.name}</p>
          <p className="text-xs text-muted-foreground">
            {garment.category} · {garment.color}
          </p>
        </div>
        <span
          className={
            garment.clean
              ? 'inline-flex w-fit rounded-md bg-sand/60 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-espresso'
              : 'inline-flex w-fit rounded-md bg-warning/20 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-rust'
          }
        >
          {garment.clean ? 'Clean' : 'Dirty'}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between">
        <button
          onClick={() => onRemove(garment.id)}
          aria-label="Remove garment"
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-muted-foreground">Laundered?</span>
          <ToggleSwitch checked={garment.clean} onChange={() => onToggle(garment.id)} />
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-rust' : 'bg-sand'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-cream shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function EmptyState({ filter, onScan }: { filter: FilterTab; onScan: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <Shirt className="h-8 w-8 text-muted-foreground" />
      </div>
      <h5 className="mb-1">No {filter} items</h5>
      <p className="helper-text mb-6">
        {filter === 'all'
          ? 'Scan your first garment to get started.'
          : `You have no ${filter} clothes right now.`}
      </p>
      {filter === 'all' && (
        <button onClick={onScan} className="btn-primary btn-md gap-2">
          <Scan className="h-4 w-4" />
          Scan Your First Item
        </button>
      )}
    </div>
  );
}
