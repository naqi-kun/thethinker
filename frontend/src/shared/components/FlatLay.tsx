import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'motion/react';
import type { ClothingItem } from '../api/types';

/* Matches the history card's layoutTransition so tiles and card morph in sync. */
const morphTransition = {
  type: 'tween' as const,
  duration: 0.45,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

const FLAT_LAY_SLOTS = [
  { top: '4%', left: '4%', rotate: -8 },
  { top: '6%', left: '53%', rotate: 6 },
  { top: '44%', left: '22%', rotate: -5 },
  { top: '40%', left: '56%', rotate: 9 },
  { top: '66%', left: '5%', rotate: 4 },
  { top: '63%', left: '51%', rotate: -7 },
  { top: '22%', left: '29%', rotate: -3 },
  { top: '76%', left: '30%', rotate: 5 },
];

interface FlatLayProps {
  items: ClothingItem[];
  selectedItemId?: string | null;
  onSelectItem?: (item: ClothingItem | null) => void;
  variant?: 'scatter' | 'bento' | 'thumb';
  /* Shared-element scope: when set, each tile gets a layoutId of
     `${morphId}-tile-${item.id}` so the same item morphs between the
     thumb and bento variants of the same outfit. */
  morphId?: string;
}

function MorphTile({
  morphKey,
  className,
  style,
  children,
}: {
  morphKey?: string;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (!morphKey) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      layoutId={morphKey}
      transition={morphTransition}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function ItemImage({ item, label = false }: { item: ClothingItem; label?: boolean }) {
  if (item.image_url) {
    return (
      <img
        src={item.image_url}
        alt={item.sub_type}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-sand/60">
      {label && (
        <p className="text-xs capitalize text-muted-foreground">{item.sub_type}</p>
      )}
    </div>
  );
}

/* Collage grid matching the design's hero card: one large image on the
   left, one medium top-right, up to two small bottom-right. */
function Bento({ items, morphId }: { items: ClothingItem[]; morphId?: string }) {
  const [main, topRight, ...rest] = items;
  const bottom = rest.slice(0, 2);
  const overflow = items.length - 4;
  const tileKey = (item: ClothingItem) =>
    morphId ? `${morphId}-tile-${item.id}` : undefined;

  return (
    <MorphTile
      morphKey={morphId ? `${morphId}-frame` : undefined}
      className="flex h-[210px] w-full gap-2"
    >
      <MorphTile
        morphKey={tileKey(main)}
        className="flex-1 overflow-hidden"
        style={{ borderRadius: 12 }}
      >
        <ItemImage item={main} label />
      </MorphTile>
      {topRight && (
        <div className="flex flex-1 flex-col gap-2">
          <MorphTile
            morphKey={tileKey(topRight)}
            className="flex-1 overflow-hidden"
            style={{ borderRadius: 12 }}
          >
            <ItemImage item={topRight} label />
          </MorphTile>
          {bottom.length > 0 && (
            <div className="flex flex-1 gap-2">
              {bottom.map((item, i) => (
                <MorphTile
                  key={item.id}
                  morphKey={tileKey(item)}
                  className="relative flex-1 overflow-hidden"
                  style={{ borderRadius: 12 }}
                >
                  <ItemImage item={item} label />
                  {i === bottom.length - 1 && overflow > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-espresso/50">
                      <span className="text-sm font-semibold text-cream">
                        +{overflow}
                      </span>
                    </div>
                  )}
                </MorphTile>
              ))}
            </div>
          )}
        </div>
      )}
    </MorphTile>
  );
}

/* Compact 76x90 collage for collapsed history rows: first item fills the
   left half, up to two more stack on the right. */
function Thumb({ items, morphId }: { items: ClothingItem[]; morphId?: string }) {
  const [main, ...rest] = items;
  const side = rest.slice(0, 2);
  const tileKey = (item: ClothingItem) =>
    morphId ? `${morphId}-tile-${item.id}` : undefined;

  return (
    <MorphTile
      morphKey={morphId ? `${morphId}-frame` : undefined}
      className="flex h-[90px] w-[76px] shrink-0 gap-px overflow-hidden"
      style={{ borderRadius: 12 }}
    >
      <MorphTile morphKey={tileKey(main)} className="flex-1 overflow-hidden">
        <ItemImage item={main} />
      </MorphTile>
      {side.length > 0 && (
        <div className="flex flex-1 flex-col gap-px">
          {side.map((item) => (
            <MorphTile
              key={item.id}
              morphKey={tileKey(item)}
              className="flex-1 overflow-hidden"
            >
              <ItemImage item={item} />
            </MorphTile>
          ))}
        </div>
      )}
    </MorphTile>
  );
}

export default function FlatLay({
  items,
  selectedItemId,
  onSelectItem,
  variant = 'scatter',
  morphId,
}: FlatLayProps) {
  const hasSelection = selectedItemId != null;

  if (items.length === 0) return null;

  if (variant === 'bento') return <Bento items={items} morphId={morphId} />;
  if (variant === 'thumb') return <Thumb items={items} morphId={morphId} />;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-cream"
      style={{ aspectRatio: '3/4' }}
      onClick={() => onSelectItem?.(null)}
    >
      {items.map((item, i) => {
        const slot = FLAT_LAY_SLOTS[i % FLAT_LAY_SLOTS.length];
        const isSelected = selectedItemId === item.id;
        return (
          <button
            key={item.id}
            className="absolute overflow-hidden rounded-xl transition-all duration-200"
            style={{
              top: slot.top,
              left: slot.left,
              width: '42%',
              transform: `rotate(${slot.rotate}deg)`,
              opacity: hasSelection && !isSelected ? 0.35 : 1,
              outline: isSelected ? '2.5px solid #c1714a' : 'none',
              outlineOffset: '2px',
              zIndex: isSelected ? 10 : i + 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectItem?.(isSelected ? null : item);
            }}
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.sub_type}
                className="h-36 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-36 w-full flex-col items-center justify-center gap-1 bg-linen/60">
                <p className="text-xs font-medium capitalize text-espresso">
                  {item.sub_type}
                </p>
                <p className="text-xs capitalize text-muted-foreground">{item.color}</p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
