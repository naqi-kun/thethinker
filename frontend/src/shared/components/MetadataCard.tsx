import { X } from 'lucide-react';
import type { ClothingItem } from '../api/types';

interface MetadataCardProps {
  item: ClothingItem;
  onClose?: () => void;
  onSwap?: () => void;
}

export default function MetadataCard({ item, onClose, onSwap }: MetadataCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-cream p-4 shadow-sm">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.sub_type}
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linen/80">
          <span className="text-xs capitalize text-muted-foreground">
            {item.sub_type[0]}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 font-medium capitalize text-espresso">{item.sub_type}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
            {item.color}
          </span>
          <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
            {item.category}
          </span>
          {item.season && item.season !== 'all' && (
            <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
              {item.season.replace(/_/g, ' ')}
            </span>
          )}
          {item.fit && (
            <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
              {item.fit}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {onSwap && (
          <button
            onClick={onSwap}
            className="rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-cream"
          >
            Swap
          </button>
        )}
      </div>
    </div>
  );
}
