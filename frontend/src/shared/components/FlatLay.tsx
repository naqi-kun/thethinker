import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'motion/react';
import type { ClothingItem } from '../api/types';

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

const TILE_WELL_CLASS = 'bg-espresso/5';
const OVERFLOW_OVERLAY_CLASS = 'bg-espresso/60';

interface FlatLayProps {
  items: ClothingItem[];
  selectedItemId?: string | null;
  onSelectItem?: (item: ClothingItem | null) => void;
  variant?: 'scatter' | 'bento' | 'thumb';
  /** When true, bento/thumb tiles animate in with a staggered cascade. */
  animateIn?: boolean;
}

function ItemImage({ item, label = false }: { item: ClothingItem; label?: boolean }) {
  if (item.image_url) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${TILE_WELL_CLASS}`}>
        <img
          src={item.image_url}
          alt={item.sub_type}
          className="h-full w-full object-contain"
          loading="lazy"
        />
        {label && <span className="sr-only">{item.sub_type}</span>}
      </div>
    );
  }
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center ${TILE_WELL_CLASS}`}>
      {label && (
        <p className="text-xs capitalize text-muted-foreground">{item.sub_type}</p>
      )}
    </div>
  );
}

const tileEnter = {
  hidden: { opacity: 0, scale: 0.86, x: -24, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 280,
      damping: 30,
      mass: 0.85,
      delay: i * 0.055,
    },
  }),
};

function AnimatedTile({
  children,
  index,
  animateIn,
  className,
  style,
}: {
  children: ReactNode;
  index: number;
  animateIn: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  if (!animateIn) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      custom={index}
      variants={tileEnter}
      initial="hidden"
      animate="visible"
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* Collage grid matching the design's hero card: one large image on the
   left, one medium top-right, up to two small bottom-right. */
function Bento({ items, animateIn }: { items: ClothingItem[]; animateIn: boolean }) {
  const [main, topRight, ...rest] = items;
  const bottom = rest.slice(0, 2);
  const overflow = items.length - 4;

  return (
    <div className="flex h-[210px] w-full gap-2 overflow-hidden">
      <AnimatedTile
        index={0}
        animateIn={animateIn}
        className="min-h-0 flex-1 overflow-hidden"
        style={{ borderRadius: 12 }}
      >
        <ItemImage item={main} label />
      </AnimatedTile>
      {topRight && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <AnimatedTile
            index={1}
            animateIn={animateIn}
            className="min-h-0 flex-1 overflow-hidden"
            style={{ borderRadius: 12 }}
          >
            <ItemImage item={topRight} label />
          </AnimatedTile>
          {bottom.length > 0 && (
            <div className="flex min-h-0 flex-1 gap-2">
              {bottom.map((item, i) => (
                <AnimatedTile
                  key={item.id}
                  index={i + 2}
                  animateIn={animateIn}
                  className="relative min-h-0 flex-1 overflow-hidden"
                  style={{ borderRadius: 12 }}
                >
                  <ItemImage item={item} label />
                  {i === bottom.length - 1 && overflow > 0 && (
                    <div
                      className={`absolute inset-0 flex items-center justify-center ${OVERFLOW_OVERLAY_CLASS}`}
                    >
                      <span className="text-sm font-semibold text-cream">+{overflow}</span>
                    </div>
                  )}
                </AnimatedTile>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Compact 76x90 collage for collapsed history rows: first item fills the
   left half, up to two more stack on the right. */
function Thumb({ items, animateIn }: { items: ClothingItem[]; animateIn: boolean }) {
  const [main, ...rest] = items;
  const side = rest.slice(0, 2);

  return (
    <div
      className="flex h-[90px] w-[76px] shrink-0 gap-px overflow-hidden"
      style={{ borderRadius: 12 }}
    >
      <AnimatedTile index={0} animateIn={animateIn} className="flex-1 overflow-hidden">
        <ItemImage item={main} />
      </AnimatedTile>
      {side.length > 0 && (
        <div className="flex flex-1 flex-col gap-px">
          {side.map((item, i) => (
            <AnimatedTile
              key={item.id}
              index={i + 1}
              animateIn={animateIn}
              className="flex-1 overflow-hidden"
            >
              <ItemImage item={item} />
            </AnimatedTile>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FlatLay({
  items,
  selectedItemId,
  onSelectItem,
  variant = 'scatter',
  animateIn = false,
}: FlatLayProps) {
  const hasSelection = selectedItemId != null;

  if (items.length === 0) return null;

  if (variant === 'bento') return <Bento items={items} animateIn={animateIn} />;
  if (variant === 'thumb') return <Thumb items={items} animateIn={animateIn} />;

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
