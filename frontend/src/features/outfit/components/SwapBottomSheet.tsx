import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { listItems } from '../../wardrobe/api';
import type { ClothingItem } from '../../../shared/api/types';

type Slot = 'top' | 'bottom' | 'footwear' | 'other';

const SLOT_MAP: Record<string, Slot> = {
  shirt: 'top',
  't-shirt': 'top',
  sweater: 'top',
  hoodie: 'top',
  jacket: 'top',
  coat: 'top',
  blazer: 'top',
  suit: 'top',
  pants: 'bottom',
  jeans: 'bottom',
  shorts: 'bottom',
  skirt: 'bottom',
  dress: 'bottom',
  shoes: 'footwear',
  sneakers: 'footwear',
  boots: 'footwear',
};

function slotOf(subType: string): Slot {
  return SLOT_MAP[subType.toLowerCase()] ?? 'other';
}

interface Props {
  item: ClothingItem;
  outfitItemIds: string[];
  onSwap: (replacement: ClothingItem) => void;
  onClose: () => void;
}

export default function SwapBottomSheet({
  item,
  outfitItemIds,
  onSwap,
  onClose,
}: Props) {
  const [alternatives, setAlternatives] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const itemSlot = slotOf(item.sub_type);
    listItems(item.category)
      .then((items) =>
        setAlternatives(
          items.filter(
            (i) =>
              i.id !== item.id &&
              !outfitItemIds.includes(i.id) &&
              slotOf(i.sub_type) === itemSlot &&
              (i.season === item.season || i.season === 'all' || item.season === 'all'),
          ),
        ),
      )
      .finally(() => setLoading(false));
  }, [item, outfitItemIds]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-background shadow-xl">
        <div className="mx-auto max-w-xl">
          {/* Handle + header */}
          <div className="flex items-center justify-between px-6 pb-3 pt-4">
            <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
            <h3 className="font-medium capitalize text-espresso">
              Swap {item.sub_type}
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Alternatives list */}
          <div className="max-h-72 overflow-y-auto px-6 pb-8">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : alternatives.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No other {item.category} items in your wardrobe.
              </p>
            ) : (
              <div className="space-y-2">
                {alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    onClick={() => onSwap(alt)}
                    className="flex w-full items-center gap-4 rounded-xl border border-border bg-cream p-3 text-left transition-colors hover:border-terracotta/50 hover:bg-linen/60"
                  >
                    {alt.image_url ? (
                      <img
                        src={alt.image_url}
                        alt={alt.sub_type}
                        className="h-14 w-14 flex-shrink-0 rounded-lg object-contain"
                      />
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-linen/80">
                        <span className="text-xs capitalize text-muted-foreground">
                          {alt.sub_type[0]}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium capitalize text-espresso">
                        {alt.sub_type}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {alt.color} · {alt.fit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
