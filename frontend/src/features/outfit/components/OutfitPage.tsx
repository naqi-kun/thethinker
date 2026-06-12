import { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  CalendarClock,
  Check,
  MapPin,
  RefreshCw,
  Shirt,
  Sun,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../../../shared/components/TopNav';
import { ApiError } from '../../../shared/api/client';
import type {
  CalendarEvent,
  ClothingItem,
  OutfitRecommendation,
} from '../../../shared/api/types';
import { getTodayEvents, ignoreEvent } from '../../calendar/api';
import { acceptOutfit, getOutfit } from '../api';
import SwapBottomSheet from './SwapBottomSheet';

const MAX_ITEMS = 10;

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

// Editorial flat-lay slots — a tight collage with slight overlaps, like a
// styled magazine board. top/left/width as % of canvas, rotate in degrees.
// Keep top% + width% ≤ ~92 so items never reach the canvas bottom edge.
// The first three slots fit the common top + bottom + shoes outfit.
const FLAT_LAY_SLOTS = [
  { top: '4%', left: '6%', width: '52%', rotate: -5 },
  { top: '16%', left: '44%', width: '50%', rotate: 4 },
  { top: '50%', left: '16%', width: '42%', rotate: -4 },
  { top: '46%', left: '54%', width: '38%', rotate: 7 },
  { top: '6%', left: '62%', width: '32%', rotate: 9 },
  { top: '56%', left: '2%', width: '32%', rotate: -8 },
  { top: '28%', left: '2%', width: '34%', rotate: -2 },
  { top: '58%', left: '58%', width: '32%', rotate: 6 },
];

function deriveHashtags(rec: OutfitRecommendation): string[] {
  const tags: string[] = [];
  if (rec.occasion) tags.push(rec.occasion);
  const seasons = [
    ...new Set(rec.items.flatMap((i) => (i.season ? [i.season] : []))),
  ].filter((s) => s !== 'all');
  seasons.forEach((s) => tags.push(s.replace(/_/g, '-')));
  const categories = [...new Set(rec.items.map((i) => i.category))];
  categories.forEach((c) => tags.push(c));
  return [...new Set(tags)].slice(0, 5);
}

function formatEventTime(event: CalendarEvent): string {
  if (event.all_day) return 'All day';
  return new Date(event.starts_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OutfitPage() {
  const navigate = useNavigate();
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(
    null,
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyWardrobe, setEmptyWardrobe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [swappingItem, setSwappingItem] = useState<ClothingItem | null>(null);
  const [showToast, setShowToast] = useState(false);

  const fetchOutfit = useCallback((sessionId?: string) => {
    setLoading(true);
    setError(null);
    setEmptyWardrobe(false);
    setAccepted(false);
    setSwappingItem(null);
    getOutfit(sessionId)
      .then(setRecommendation)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setEmptyWardrobe(true);
        } else {
          setError('Unable to load outfit recommendation. Please try again.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOutfit();
  }, [fetchOutfit]);

  useEffect(() => {
    // Today's calendar events are best-effort context; failures shouldn't block
    // the outfit view.
    getTodayEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(t);
  }, [showToast]);

  function handleIgnore(id: string) {
    // Optimistically drop it; ignored events are hidden server-side too.
    setEvents((prev) => prev.filter((e) => e.id !== id));
    ignoreEvent(id).catch(() => {
      // On failure, reload so the UI matches the server.
      getTodayEvents()
        .then(setEvents)
        .catch(() => undefined);
    });
  }

  const handleAccept = useCallback(async () => {
    if (!recommendation || accepting || accepted) return;
    const itemIds = recommendation.items.slice(0, MAX_ITEMS).map((i) => i.id);
    setAccepting(true);
    try {
      await acceptOutfit(itemIds, recommendation.session_id);
      setAccepted(true);
      setShowToast(true);
    } catch {
      setError('Could not save your outfit. Please try again.');
    } finally {
      setAccepting(false);
    }
  }, [recommendation, accepting, accepted]);

  const handleSwap = useCallback(
    (replacement: ClothingItem) => {
      if (!recommendation || !swappingItem) return;
      setRecommendation({
        ...recommendation,
        items: recommendation.items.map((i) =>
          i.id === swappingItem.id ? replacement : i,
        ),
      });
      setSwappingItem(null);
      setAccepted(false);
    },
    [recommendation, swappingItem],
  );

  const displayItems: ClothingItem[] = recommendation?.items.slice(0, MAX_ITEMS) ?? [];
  const hashtags = recommendation ? deriveHashtags(recommendation) : [];

  return (
    // Fixed viewport-height column: header, canvas (flex-1), CTA — no page scroll.
    <div className="flex h-screen-safe flex-col overflow-hidden bg-background">
      <TopNav />

      {/* Save toast */}
      {showToast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-espresso px-5 py-2.5 text-sm font-medium text-cream shadow-lg">
          Outfit saved for today ✓
        </div>
      )}

      <main className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col px-6 py-4">
        <div className="mb-3 shrink-0 text-center">
          <h2 className="mb-2">{today}</h2>

          {recommendation && (
            <div className="flex flex-wrap justify-center gap-2">
              {recommendation.weather && (
                <span className="badge-default gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-warning" />
                  {recommendation.weather.temperature}°C ·{' '}
                  {recommendation.weather.description}
                </span>
              )}
              {recommendation.occasion && (
                <span className="badge-default gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-terracotta" />
                  {recommendation.occasion}
                </span>
              )}
              {recommendation.recommender === 'rule_based' && (
                <span className="badge-default gap-1.5 text-muted-foreground">
                  <Shirt className="h-3.5 w-3.5" />
                  AI unavailable · using rule-based
                </span>
              )}
            </div>
          )}
        </div>

        {events.length > 0 && (
          <div className="mb-3 max-h-28 shrink-0 overflow-y-auto rounded-xl border border-border bg-card/60 p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-terracotta" />
              Today's schedule
            </p>
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="w-20 shrink-0 font-medium text-foreground">
                    {formatEventTime(event)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">
                      {event.title}
                    </span>
                    {event.location && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => handleIgnore(event.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Ignore ${event.title}`}
                    title="Ignore this event"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Curating your outfit…
          </p>
        ) : emptyWardrobe ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Shirt className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 font-medium">Your wardrobe is empty</p>
            <p className="mb-6 text-sm text-muted-foreground">
              Add some clothes before we can suggest an outfit.
            </p>
            <button
              onClick={() => navigate('/wardrobe')}
              className="btn-primary btn-sm"
            >
              Go to Wardrobe
            </button>
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="mb-4 text-sm text-destructive">{error}</p>
            <button onClick={() => fetchOutfit()} className="btn-outline btn-sm gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : recommendation ? (
          <>
            {/* Editorial flat-lay canvas — fills the remaining viewport height */}
            <div className="flex min-h-0 flex-1 justify-center">
              <div
                className="relative h-full max-w-full overflow-hidden rounded-2xl bg-cream"
                style={{ aspectRatio: '3/4' }}
              >
                {displayItems.map((item, i) => {
                  const slot = FLAT_LAY_SLOTS[i % FLAT_LAY_SLOTS.length];
                  return (
                    <button
                      key={item.id}
                      className="group absolute rounded-xl transition-transform duration-200 hover:scale-105"
                      style={{
                        top: slot.top,
                        left: slot.left,
                        width: slot.width,
                        transform: `rotate(${slot.rotate}deg)`,
                        zIndex: i + 1,
                      }}
                      onClick={() => setSwappingItem(item)}
                      aria-label={`Swap ${item.color} ${item.sub_type}`}
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.sub_type}
                          className="h-auto w-full"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-3/4 w-full flex-col items-center justify-center gap-1 rounded-xl bg-linen/60">
                          <p className="text-xs font-medium capitalize text-espresso">
                            {item.sub_type}
                          </p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {item.color}
                          </p>
                        </div>
                      )}
                      {/* Hover tooltip — details on hover, click swaps */}
                      <span className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-espresso/90 px-3 py-1.5 text-xs capitalize text-cream opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100">
                        {item.color} {item.sub_type} · {item.category}
                        {item.fit ? ` · ${item.fit}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hashtags + refresh on one compact row */}
            <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-2 overflow-hidden">
                {hashtags.map((tag) => (
                  <span key={tag} className="text-sm text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
              <button
                onClick={() => fetchOutfit(recommendation?.session_id)}
                className="btn-outline btn-sm shrink-0 gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </>
        ) : null}
      </main>

      {/* CTA in normal flow at the bottom of the viewport column — the canvas
          above is height-bounded, so items can never slide underneath it. */}
      {recommendation && (
        <div className="shrink-0 border-t border-border bg-background/95">
          <div className="mx-auto w-full max-w-xl px-6 py-3">
            <button
              onClick={handleAccept}
              disabled={accepted || accepting}
              className="btn-primary btn-lg w-full gap-2"
            >
              {accepted ? 'Saved for today' : accepting ? 'Saving…' : 'Wear This Today'}
              <Check className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {swappingItem && (
        <SwapBottomSheet
          item={swappingItem}
          outfitItemIds={displayItems.map((i) => i.id)}
          onSwap={handleSwap}
          onClose={() => setSwappingItem(null)}
        />
      )}
    </div>
  );
}
