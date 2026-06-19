import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  CalendarClock,
  Check,
  MapPin,
  RefreshCw,
  Shirt,
  Shuffle,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import type {
  CalendarEvent,
  ClothingItem,
  OutfitRecommendation,
} from '../../../shared/api/types';
import { ease } from '../../../shared/motion';
import { getTodayEvents, ignoreEvent } from '../../calendar/api';
import { acceptOutfit, getOutfit, type OutfitOptions } from '../api';
import { hasRevealedToday, markRevealedToday } from '../revealStore';
import { SETTLE_STAGGER_S, settleSpring } from '../revealMotion';
import SwapBottomSheet from './SwapBottomSheet';
import WrappedCard from './WrappedCard';

const MAX_ITEMS = 10;

// "Dressing for" selection. 'auto' lets the server pick the day's most-formal
// event; 'everyday' forces relaxed daily wear; any other value is an event id.
type DressingFor = 'auto' | 'everyday' | string;

function selectionToOptions(selection: DressingFor): OutfitOptions {
  if (selection === 'auto') return {};
  if (selection === 'everyday') return { occasion: 'casual' };
  return { eventId: selection };
}

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

const WEATHER_STALE_AFTER_MS = 60 * 60 * 1000; // ~1h

// A weather reading older than ~1h is likely a cached last-known-good value
// served after a live lookup failed — surface an "as of" hint so the badge
// doesn't present stale conditions as current. Returns null for fresh readings
// or ones without an observed_at timestamp (e.g. legacy responses).
function staleWeatherHint(observedAt: string | undefined): string | null {
  if (!observedAt) return null;
  const observed = new Date(observedAt).getTime();
  if (Number.isNaN(observed)) return null;
  const ageMs = Date.now() - observed;
  if (ageMs < WEATHER_STALE_AFTER_MS) return null;
  const hours = Math.round(ageMs / (60 * 60 * 1000));
  if (hours < 24) return `as of ${hours}h ago`;
  return `as of ${Math.round(hours / 24)}d ago`;
}

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
  // Collect all items including accessories
  const allItems = [
    ...rec.items,
    ...(rec.watch ? [rec.watch] : []),
    ...(rec.bag ? [rec.bag] : []),
    ...(rec.belt ? [rec.belt] : []),
  ];
  const seasons = [
    ...new Set(allItems.flatMap((i) => (i.season ? [i.season] : []))),
  ].filter((s) => s !== 'all');
  seasons.forEach((s) => tags.push(s.replace(/_/g, '-')));
  const categories = [...new Set(allItems.map((i) => i.category))];
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
  const prefersReducedMotion = useReducedMotion();
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(
    null,
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dressingFor, setDressingFor] = useState<DressingFor>('auto');
  const [loading, setLoading] = useState(true);
  const [emptyWardrobe, setEmptyWardrobe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [swappingItem, setSwappingItem] = useState<ClothingItem | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Reveal ceremony (KAN-100). On the first open of the day the outfit is sealed
  // behind WrappedCard; tapping Reveal plays the staggered settle once. Returning
  // the same day skips straight to the flat-lay. Shuffles never replay the
  // ceremony — they just cross-fade in the new outfit.
  const [phase, setPhase] = useState<'wrapped' | 'revealed'>(() =>
    hasRevealedToday() ? 'revealed' : 'wrapped',
  );
  const [ceremony, setCeremony] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);

  const handleReveal = useCallback(() => {
    markRevealedToday();
    setCeremony(!prefersReducedMotion);
    setPhase('revealed');
  }, [prefersReducedMotion]);

  // Monotonic id of the most recent outfit request. Only that request may apply
  // its result, so an earlier/superseded response can never overwrite a newer
  // one (refresh races, fast navigation) — the core of the KAN-90 swap bug.
  const latestRequestId = useRef(0);
  // Guards the initial load against StrictMode's double-invoked mount effect,
  // which would otherwise start two independent AI sessions (two Claude calls,
  // one orphaned) and swap the outfit ~2s after load.
  const didInitialFetch = useRef(false);

  const fetchOutfit = useCallback(
    (sessionId?: string, selection: DressingFor = 'auto') => {
      const requestId = ++latestRequestId.current;
      setLoading(true);
      setError(null);
      setEmptyWardrobe(false);
      setAccepted(false);
      setSwappingItem(null);
      getOutfit(sessionId, selectionToOptions(selection))
        .then((rec) => {
          if (latestRequestId.current !== requestId) return; // superseded
          setRecommendation(rec);
        })
        .catch((err: unknown) => {
          if (latestRequestId.current !== requestId) return; // superseded
          if (err instanceof ApiError && err.status === 404) {
            setEmptyWardrobe(true);
          } else {
            setError('Unable to load outfit recommendation. Please try again.');
          }
        })
        .finally(() => {
          if (latestRequestId.current !== requestId) return; // superseded
          setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
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

  function handleDressingForChange(value: DressingFor) {
    // A new occasion changes the stylist's brief, which only applies when a
    // session starts — so drop the current session and fetch a fresh look.
    setDressingFor(value);
    fetchOutfit(undefined, value);
  }

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
    const itemIds = [
      ...recommendation.items.map((i) => i.id),
      ...(recommendation.watch ? [recommendation.watch.id] : []),
      ...(recommendation.bag ? [recommendation.bag.id] : []),
      ...(recommendation.belt ? [recommendation.belt.id] : []),
    ];
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
        // The user hand-picked this piece, so the AI's "why this look" rationale
        // no longer describes the outfit on screen — drop it (KAN-101).
        reasoning: undefined,
        items: recommendation.items.map((i) =>
          i.id === swappingItem.id ? replacement : i,
        ),
      });
      setSwappingItem(null);
      setAccepted(false);
    },
    [recommendation, swappingItem],
  );

  // Shuffle reuses the session to regenerate. It replays the staggered garment
  // settle (same as the reveal) but skips the seal — bumping the canvas key
  // forces the items to remount so the animation runs even when the new outfit
  // reuses some of the same item ids (KAN-100).
  const handleShuffle = useCallback(() => {
    setCeremony(!prefersReducedMotion);
    setShuffleKey((k) => k + 1);
    fetchOutfit(recommendation?.session_id, dressingFor);
  }, [fetchOutfit, recommendation, prefersReducedMotion, dressingFor]);

  // Combine main outfit items with accessories for display
  const displayItems: ClothingItem[] = (() => {
    if (!recommendation) return [];
    const items = [...recommendation.items];
    if (recommendation.watch) items.push(recommendation.watch);
    if (recommendation.bag) items.push(recommendation.bag);
    if (recommendation.belt) items.push(recommendation.belt);
    return items.slice(0, MAX_ITEMS);
  })();
  const hashtags = recommendation ? deriveHashtags(recommendation) : [];
  const weatherHint = recommendation?.weather
    ? staleWeatherHint(recommendation.weather.observed_at)
    : null;
  // During the ceremony the context "why" lands after the garments settle.
  const whyDelay = ceremony ? displayItems.length * SETTLE_STAGGER_S + 0.15 : 0;

  return (
    // Fills the app shell's content region as a column — canvas (flex-1) + CTA,
    // no inner scroll. Bottom padding clears the mobile floating tab bar (gone
    // on desktop, where the side rail takes over).
    <div className="flex h-full flex-col overflow-hidden pb-24 md:pb-4">
      {/* Save toast */}
      {showToast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-espresso px-5 py-2.5 text-sm font-medium text-cream shadow-lg">
          Outfit saved for today ✓
        </div>
      )}

      <main className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col px-6 py-4">
        <div className="mb-3 shrink-0 text-center">
          <h2 className="mb-2">{today}</h2>

          {recommendation && phase === 'revealed' && (
            <motion.div
              className="flex flex-wrap justify-center gap-2"
              initial={ceremony ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: whyDelay }}
            >
              {recommendation.weather && (
                <span className="badge-default gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-warning" />
                  {recommendation.weather.temperature}°C ·{' '}
                  {recommendation.weather.description}
                  {weatherHint && (
                    <span className="text-muted-foreground">· {weatherHint}</span>
                  )}
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
            </motion.div>
          )}
        </div>

        {events.length > 0 && phase === 'revealed' && (
          <div className="mb-3 flex shrink-0 items-center justify-center gap-2 text-sm">
            <label htmlFor="dressing-for" className="text-muted-foreground">
              Dressing for
            </label>
            <select
              id="dressing-for"
              value={dressingFor}
              onChange={(e) => handleDressingForChange(e.target.value)}
              disabled={loading}
              className="rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground disabled:opacity-60"
            >
              <option value="auto">✨ Best for today</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {formatEventTime(event)} · {event.title}
                </option>
              ))}
              <option value="everyday">Everyday</option>
            </select>
          </div>
        )}

        {events.length > 0 && phase === 'revealed' && (
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

        {emptyWardrobe ? (
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
        ) : phase === 'wrapped' ? (
          <WrappedCard
            loading={loading}
            prefersReducedMotion={!!prefersReducedMotion}
            onReveal={handleReveal}
          />
        ) : loading ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4"
            aria-busy="true"
          >
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-linen text-terracotta"
              animate={{ scale: [1, 1.1, 1], rotate: [0, -8, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="h-7 w-7" />
            </motion.div>
            <motion.p
              className="text-sm text-muted-foreground"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              Curating your outfit…
            </motion.p>
          </div>
        ) : recommendation ? (
          <>
            {/* Editorial flat-lay canvas — fills the remaining viewport height.
                Keyed by shuffleKey so a shuffle remounts the items and replays
                the staggered settle (the reveal animation, without the seal). */}
            <div className="flex min-h-0 flex-1 justify-center">
              <motion.div
                key={shuffleKey}
                className="relative h-full max-w-full rounded-2xl bg-cream"
                style={{ aspectRatio: '3/4' }}
                initial={ceremony ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, ease }}
              >
                {displayItems.map((item, i) => {
                  const slot = FLAT_LAY_SLOTS[i % FLAT_LAY_SLOTS.length];
                  return (
                    <motion.button
                      key={item.id}
                      className="group absolute rounded-xl"
                      style={{
                        top: slot.top,
                        left: slot.left,
                        width: slot.width,
                        zIndex: i + 1,
                      }}
                      initial={
                        ceremony
                          ? { opacity: 0, scale: 0.9, y: 18, rotate: slot.rotate - 6 }
                          : false
                      }
                      animate={{ opacity: 1, scale: 1, y: 0, rotate: slot.rotate }}
                      transition={
                        ceremony
                          ? { ...settleSpring, delay: i * SETTLE_STAGGER_S }
                          : { duration: 0 }
                      }
                      whileHover={{ scale: 1.05 }}
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
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>

            {/* "Why this look" — the AI's one-sentence rationale (KAN-101).
                Lands with the other context after the garments settle. Absent
                for the rule-based fallback, so the card simply doesn't render. */}
            {recommendation.reasoning && (
              <motion.div
                className="mt-3 flex shrink-0 items-start gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5"
                initial={ceremony ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease, delay: whyDelay }}
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Why this look
                  </p>
                  <p className="mt-0.5 text-sm leading-snug text-foreground">
                    {recommendation.reasoning}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Hashtags + shuffle on one compact row. Hashtags land after the
                garments settle during the reveal ceremony. */}
            <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
              <motion.div
                className="flex min-w-0 flex-wrap gap-2 overflow-hidden"
                initial={ceremony ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease, delay: whyDelay }}
              >
                {hashtags.map((tag) => (
                  <span key={tag} className="text-sm text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </motion.div>
              <button
                onClick={handleShuffle}
                className="btn-outline btn-sm shrink-0 gap-2"
              >
                <Shuffle className="h-4 w-4" />
                Shuffle
              </button>
            </div>
          </>
        ) : null}
      </main>

      {/* CTA in normal flow at the bottom of the viewport column — the canvas
          above is height-bounded, so items can never slide underneath it.
          Stays put while curating, just muted + disabled so a not-yet-ready
          outfit can't be accepted. Hidden while the outfit is still sealed. */}
      {phase === 'revealed' && (loading || recommendation) && (
        <div className="shrink-0 border-t border-border bg-background/95">
          <div className="mx-auto w-full max-w-xl px-6 py-3">
            <button
              onClick={handleAccept}
              disabled={loading || accepted || accepting}
              className={`btn-lg w-full gap-2 ${
                loading ? 'btn-secondary cursor-not-allowed opacity-70' : 'btn-primary'
              }`}
            >
              {accepted ? 'Saved for today' : accepting ? 'Saving…' : 'Wear This Today'}
              <Check className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {swappingItem && (
          <SwapBottomSheet
            key={swappingItem.id}
            item={swappingItem}
            outfitItemIds={displayItems.map((i) => i.id)}
            onSwap={handleSwap}
            onClose={() => setSwappingItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
