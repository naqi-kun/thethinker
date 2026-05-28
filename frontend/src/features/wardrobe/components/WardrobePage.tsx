import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, Shirt, Trash2 } from 'lucide-react';

type Garment = {
  id: number;
  name: string;
  category: string;
  clean: boolean;
};

type FilterTab = 'all' | 'clean' | 'dirty';

const initialGarments: Garment[] = [
  { id: 1, name: 'White Linen Shirt', category: 'Tops',      clean: true  },
  { id: 2, name: 'Blue Denim Jeans',  category: 'Bottoms',   clean: true  },
  { id: 3, name: 'Grey Blazer',       category: 'Outerwear', clean: false },
  { id: 4, name: 'Black Sneakers',    category: 'Shoes',     clean: true  },
  { id: 5, name: 'Navy T-Shirt',      category: 'Tops',      clean: false },
  { id: 6, name: 'Khaki Chinos',      category: 'Bottoms',   clean: true  },
];

export default function WardrobePage() {
  const navigate = useNavigate();
  const [garments, setGarments] = useState<Garment[]>(initialGarments);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const cleanCount = garments.filter((g) => g.clean).length;
  const dirtyCount = garments.length - cleanCount;

  const filtered = garments.filter((g) => {
    if (activeFilter === 'clean') return g.clean;
    if (activeFilter === 'dirty') return !g.clean;
    return true;
  });

  function toggleStatus(id: number) {
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, clean: !g.clean } : g))
    );
  }

  function removeGarment(id: number) {
    setGarments((prev) => prev.filter((g) => g.id !== id));
  }

  const filters: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',   label: 'All',   count: garments.length },
    { key: 'clean', label: 'Clean', count: cleanCount      },
    { key: 'dirty', label: 'Dirty', count: dirtyCount      },
  ];

  return (
    <div className="min-h-screen-safe bg-background">
      <div className="container-app py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="mb-2">My Wardrobe</h2>
            <div className="flex gap-2">
              <span className="badge-default">{garments.length} items</span>
              <span className="badge-clean">{cleanCount} clean</span>
              {dirtyCount > 0 && (
                <span className="badge-dirty">{dirtyCount} dirty</span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate('/wardrobe/scan')}
            className="btn-primary btn-sm gap-1.5"
          >
            <Scan className="h-4 w-4" />
            Scan
          </button>
        </div>

        {/* Filter tabs */}
        <div className="mb-5 flex gap-2">
          {filters.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`badge-${activeFilter === key ? 'primary' : 'outline'} cursor-pointer transition-all`}
            >
              {label} {count > 0 && `(${count})`}
            </button>
          ))}
        </div>

        {/* Garment list */}
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((garment) => (
              <div
                key={garment.id}
                className="card-interactive flex items-center gap-4 p-4"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <Shirt className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans font-semibold text-foreground">
                    {garment.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{garment.category}</p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={garment.clean ? 'badge-clean' : 'badge-dirty'}>
                    {garment.clean ? 'Clean' : 'Dirty'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleStatus(garment.id)}
                      className="btn-ghost h-7 px-2 text-xs"
                    >
                      Mark {garment.clean ? 'Dirty' : 'Clean'}
                    </button>
                    <button
                      onClick={() => removeGarment(garment.id)}
                      className="btn-ghost h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Shirt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h5 className="mb-1">No {activeFilter} items</h5>
            <p className="helper-text mb-6">
              {activeFilter === 'all'
                ? 'Scan your first garment to get started.'
                : `You have no ${activeFilter} clothes right now.`}
            </p>
            {activeFilter === 'all' && (
              <button
                onClick={() => navigate('/wardrobe/scan')}
                className="btn-primary btn-md gap-2"
              >
                <Scan className="h-4 w-4" />
                Scan Your First Item
              </button>
            )}
          </div>
        )}

      </div>

      {garments.length > 0 && (
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
