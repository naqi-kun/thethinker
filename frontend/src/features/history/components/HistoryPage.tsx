import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Clock, Moon, RefreshCw, Shirt, Sun, Sunrise } from 'lucide-react';
import FlatLay from '../../../shared/components/FlatLay';
import Skeleton from '../../../shared/components/Skeleton';
import { ease, staggerContainer, fadeUpItem } from '../../../shared/motion';
import type { HistoryEntry, OutfitHistoryItem } from '../../../shared/api/types';
import type { ClothingItem } from '../../../shared/api/types';
import { listHistory } from '../api';
import DateRangePicker, { type DateRange } from './DateRangePicker';

type RangeFilter = 'week' | 'month' | 'season' | 'all';
type TodFilter = '' | 'morning' | 'afternoon' | 'evening';

const TOD_OPTIONS: { value: TodFilter; label: string; Icon: typeof Clock }[] = [
  { value: '', label: 'All', Icon: Clock },
  { value: 'morning', label: 'Morning', Icon: Sunrise },
  { value: 'afternoon', label: 'Afternoon', Icon: Sun },
  { value: 'evening', label: 'Evening', Icon: Moon },
];

const TOD_ICONS: Record<string, typeof Clock> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
};

const EARLIER_LABELS: Record<RangeFilter, string> = {
  week: 'Earlier this week',
  month: 'Earlier this month',
  season: 'Earlier this season',
  all: 'Earlier',
};

function toClothingItem(item: OutfitHistoryItem): ClothingItem {
  return {
    id: item.item_id,
    image_url: item.image_url ?? '',
    category: item.category as ClothingItem['category'],
    sub_type: item.sub_type,
    color: item.color as ClothingItem['color'],
    fit: (item.fit ?? undefined) as ClothingItem['fit'],
    season: (item.season ?? undefined) as ClothingItem['season'],
    status: 'clean',
  };
}

function formatWornOn(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function TimeOfDayChip({
  timeOfDay,
  small = false,
}: {
  timeOfDay: string;
  small?: boolean;
}) {
  const Icon = TOD_ICONS[timeOfDay];
  return (
    <span
      className={`flex items-center gap-1 rounded-full border border-terracotta bg-terracotta/15 font-semibold capitalize text-terracotta ${
        small ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      }`}
    >
      {Icon && <Icon className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      {timeOfDay}
    </span>
  );
}

const layoutTransition = { type: 'tween' as const, duration: 0.45, ease };

export default function HistoryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeFilter>('week');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [tod, setTod] = useState<TodFilter>('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    (cursor?: string) => {
      const isFirstPage = !cursor;
      if (isFirstPage) {
        if (!hasLoadedRef.current) setLoading(true);
        else setRefreshing(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      // The API only accepts preset ranges; a custom range fetches
      // everything and narrows down client-side.
      listHistory({
        range: customRange ? 'all' : range,
        time_of_day: tod || undefined,
        cursor,
      })
        .then((res) => {
          const pageEntries = customRange
            ? res.entries.filter(
                (e) => e.worn_on >= customRange.from && e.worn_on <= customRange.to,
              )
            : res.entries;
          setEntries((prev) => {
            const next = isFirstPage ? pageEntries : [...prev, ...pageEntries];
            if (isFirstPage) setExpandedId(next[0]?.outfits[0]?.id ?? null);
            return next;
          });
          setNextCursor(res.next_cursor ?? null);
          hasLoadedRef.current = true;
          if (isFirstPage) setListKey((k) => k + 1);
        })
        .catch(() => setError('Unable to load outfit history. Please try again.'))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        });
    },
    [range, tod, customRange],
  );

  useEffect(() => {
    load();
  }, [load]);

  const outfits = entries.flatMap((entry) =>
    entry.outfits.map((outfit) => ({ outfit, wornOn: entry.worn_on })),
  );
  const hasActiveFilters = customRange !== null || tod !== '';

  return (
    <div className="pb-28 md:pb-8">
      <main className="mx-auto max-w-xl px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-terracotta">
            Your Atelier Journal
          </p>
          <h1 className="mb-1 font-serif text-3xl font-normal text-espresso">
            Outfit History
          </h1>
          <p className="text-sm text-muted-foreground">
            Every look you've worn, beautifully kept.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Date range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Date Range
              </p>
              <DateRangePicker value={customRange} onChange={setCustomRange} />
            </div>
            <div className="flex rounded-full border border-sand bg-linen p-1 gap-1">
              {(['week', 'month', 'season', 'all'] as RangeFilter[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setCustomRange(null);
                    setRange(r);
                  }}
                  className={`flex-1 rounded-full py-1.5 text-xs font-medium capitalize transition-colors ${
                    !customRange && range === r
                      ? 'bg-terracotta text-cream shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Time of day */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Time of Day
            </p>
            <div className="flex gap-1.5">
              {TOD_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value || 'all'}
                  onClick={() => setTod(value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-2 py-2 text-xs font-semibold transition-colors ${
                    tod === value
                      ? 'border-terracotta bg-terracotta/15 text-terracotta'
                      : 'border-sand bg-cream text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${tod === value ? '' : 'text-rust'}`}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="mb-4 text-sm text-destructive">{error}</p>
            <button onClick={() => load()} className="btn-outline btn-sm gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : outfits.length === 0 && !refreshing ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Shirt className="mb-4 h-10 w-10 text-muted-foreground" />
            {hasActiveFilters ? (
              <>
                <p className="mb-1 font-medium">No outfits match these filters</p>
                <p className="mb-6 text-sm text-muted-foreground">
                  Try widening the date range or time of day.
                </p>
              </>
            ) : (
              <>
                <p className="mb-1 font-medium">No outfits recorded yet</p>
                <p className="mb-6 text-sm text-muted-foreground">
                  Accept your first outfit suggestion to start your history.
                </p>
                <button
                  onClick={() => navigate('/outfit')}
                  className="btn-primary btn-sm"
                >
                  Get Today's Outfit
                </button>
              </>
            )}
          </div>
        ) : (
          <LayoutGroup>
            <AnimatePresence mode="wait">
              <motion.div
                key={listKey}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className={`space-y-4 ${refreshing ? 'pointer-events-none' : ''}`}
              >
                {outfits.map(({ outfit, wornOn }, index) => {
                  const clothingItems = outfit.items.map(toClothingItem);
                  const isExpanded = outfit.id === expandedId;

                  return (
                    <motion.section
                      key={outfit.id}
                      variants={fadeUpItem}
                      layout
                      transition={{ layout: layoutTransition }}
                    >
                      {index === 1 && (
                        <motion.p
                          layout="position"
                          transition={layoutTransition}
                          className="mb-3 mt-2 text-xs font-semibold uppercase tracking-widest text-terracotta"
                        >
                          {customRange ? 'Earlier' : EARLIER_LABELS[range]}
                        </motion.p>
                      )}
                      {/* One always-mounted card. Date morphs via layoutId;
                          thumb slides out and bento tiles cascade in on expand. */}
                      <motion.div
                        layout
                        transition={layoutTransition}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedId(isExpanded ? null : outfit.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedId(isExpanded ? null : outfit.id);
                          }
                        }}
                        style={{ borderRadius: 16, position: 'relative' }}
                        className={`cursor-pointer overflow-hidden border border-sand bg-linen ${
                          isExpanded ? 'p-4' : 'p-3'
                        }`}
                      >
                        {/* Header: row with thumb when collapsed, title bar when expanded */}
                        <motion.div
                          layout
                          transition={layoutTransition}
                          className={`relative flex ${
                            isExpanded
                              ? 'mb-3 items-start justify-between gap-3'
                              : 'items-center gap-3'
                          }`}
                        >
                          <AnimatePresence mode="popLayout" initial={false}>
                            {!isExpanded && (
                              <motion.div
                                key="thumb"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{
                                  opacity: 1,
                                  x: 0,
                                  transition: { duration: 0.22, ease, delay: 0.04 },
                                }}
                                exit={{
                                  opacity: 0,
                                  x: -10,
                                  transition: { duration: 0.18, ease },
                                }}
                              >
                                <FlatLay
                                  items={clothingItems}
                                  variant="thumb"
                                  animateIn
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="min-w-0 flex-1">
                            {isExpanded && index === 0 && (
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2, delay: 0.15 }}
                                className="text-xs font-semibold uppercase tracking-widest text-terracotta"
                              >
                                Most Recent
                              </motion.p>
                            )}
                            <motion.p
                              layoutId={`date-${outfit.id}`}
                              transition={layoutTransition}
                              className={`font-serif text-espresso ${
                                isExpanded ? 'text-xl' : 'text-lg'
                              }`}
                            >
                              {formatWornOn(wornOn)}
                            </motion.p>
                            <AnimatePresence mode="popLayout" initial={false}>
                              {!isExpanded && (
                                <motion.div
                                  key="summary"
                                  initial={{ opacity: 0 }}
                                  animate={{
                                    opacity: 1,
                                    transition: { duration: 0.2, delay: 0.15 },
                                  }}
                                  exit={{
                                    opacity: 0,
                                    transition: { duration: 0.12 },
                                  }}
                                  className="mt-1.5 space-y-1.5"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <TimeOfDayChip
                                      timeOfDay={outfit.time_of_day}
                                      small
                                    />
                                    {outfit.weather && (
                                      <span className="text-xs text-muted-foreground">
                                        {outfit.weather.temperature}°C
                                        {outfit.occasion ? ` · ${outfit.occasion}` : ''}
                                      </span>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <AnimatePresence mode="popLayout" initial={false}>
                            {isExpanded && (
                              <motion.span
                                key="worn"
                                initial={{ opacity: 0 }}
                                animate={{
                                  opacity: 1,
                                  transition: { duration: 0.2, delay: 0.2 },
                                }}
                                exit={{
                                  opacity: 0,
                                  transition: { duration: 0.12 },
                                }}
                                className="flex shrink-0 items-center gap-1.5 rounded-full border border-success bg-success/10 px-3 py-1 text-xs font-semibold text-success"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                Worn
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.div>

                        <AnimatePresence mode="popLayout" initial={false}>
                          {isExpanded && (
                            <motion.div
                              key="chips"
                              initial={{ opacity: 0 }}
                              animate={{
                                opacity: 1,
                                transition: { duration: 0.2, delay: 0.15 },
                              }}
                              exit={{
                                opacity: 0,
                                transition: { duration: 0.12 },
                              }}
                              className="mb-3 flex flex-wrap gap-2"
                            >
                              <TimeOfDayChip timeOfDay={outfit.time_of_day} />
                              {outfit.weather && (
                                <span className="rounded-full border border-sand bg-cream px-3 py-1 text-xs text-muted-foreground">
                                  {outfit.weather.temperature}°C ·{' '}
                                  {outfit.weather.description}
                                </span>
                              )}
                              {outfit.occasion && (
                                <span className="rounded-full border border-sand bg-cream px-3 py-1 text-xs capitalize text-muted-foreground">
                                  {outfit.occasion}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence mode="popLayout" initial={false}>
                          {isExpanded && (
                            <motion.div
                              key="bento"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            >
                              <FlatLay
                                items={clothingItems}
                                variant="bento"
                                animateIn
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </motion.section>
                  );
                })}

                {nextCursor && (
                  <button
                    onClick={() => load(nextCursor)}
                    disabled={loadingMore}
                    className="btn-outline btn-sm w-full"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </LayoutGroup>
        )}
      </main>
    </div>
  );
}
