import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Check, RefreshCw, Shirt, Sun, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../../../shared/components/TopNav';
import { ApiError } from '../../../shared/api/client';
import type { ClothingItem, OutfitRecommendation } from '../../../shared/api/types';
import { acceptOutfit, getOutfit } from '../api';
import SwapBottomSheet from './SwapBottomSheet';

const MAX_ITEMS = 10;

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

// Editorial flat-lay slot positions — top/left as % of canvas, rotate in degrees
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
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [swappingItem, setSwappingItem] = useState<ClothingItem | null>(null);
  const [showToast, setShowToast] = useState(false);

  const fetchOutfit = useCallback(() => {
    setLoading(true);
    setError(null);
    setEmptyWardrobe(false);
    setAccepted(false);
    setSelectedItem(null);
    getOutfit()
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
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(t);
  }, [showToast]);

  const handleAccept = useCallback(async () => {
    if (!recommendation || accepting || accepted) return;
    const itemIds = recommendation.items.slice(0, MAX_ITEMS).map((i) => i.id);
    setAccepting(true);
    try {
      await acceptOutfit(itemIds);
      setAccepted(true);
      setShowToast(true);
      setSelectedItem(null);
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
      setSelectedItem(null);
      setAccepted(false);
    },
    [recommendation, swappingItem],
  );

  const displayItems: ClothingItem[] = recommendation?.items.slice(0, MAX_ITEMS) ?? [];
  const hashtags = recommendation ? deriveHashtags(recommendation) : [];

  return (
    <div className="min-h-screen-safe bg-background pb-28">
      <TopNav />

      {/* Save toast */}
      {showToast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-espresso px-5 py-2.5 text-sm font-medium text-cream shadow-lg">
          Outfit saved for today ✓
        </div>
      )}

      <main className="mx-auto max-w-xl px-6 py-10">
        <div className="mb-6 text-center">
          <h2 className="mb-3">{today}</h2>

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
            </div>
          )}
        </div>

        {events.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card/60 p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-terracotta" />
              Today's schedule
            </p>
            <ul className="space-y-2.5">
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
          <p className="py-20 text-center text-sm text-muted-foreground">
            Curating your outfit…
          </p>
        ) : emptyWardrobe ? (
          <div className="flex flex-col items-center py-20 text-center">
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
          <div className="flex flex-col items-center py-20 text-center">
            <p className="mb-4 text-sm text-destructive">{error}</p>
            <button onClick={fetchOutfit} className="btn-outline btn-sm gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : recommendation ? (
          <>
            {/* Editorial flat-lay canvas */}
            <div
              className="relative mb-4 w-full overflow-hidden rounded-2xl bg-cream"
              style={{ aspectRatio: '3/4' }}
              onClick={() => setSelectedItem(null)}
            >
              {displayItems.map((item, i) => {
                const slot = FLAT_LAY_SLOTS[i % FLAT_LAY_SLOTS.length];
                const isSelected = selectedItem?.id === item.id;
                const hasSelection = selectedItem !== null;
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
                      setSelectedItem(isSelected ? null : item);
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.sub_type}
                        className="h-36 w-full object-cover"
                        style={{ mixBlendMode: 'multiply' }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-36 w-full flex-col items-center justify-center gap-1 bg-linen/60">
                        <p className="text-xs font-medium capitalize text-espresso">
                          {item.sub_type}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {item.color}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Item metadata card — shown when an item is selected */}
            {selectedItem && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-cream p-4 shadow-sm">
                {selectedItem.image_url ? (
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.sub_type}
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linen/80">
                    <span className="text-xs capitalize text-muted-foreground">
                      {selectedItem.sub_type[0]}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 font-medium capitalize text-espresso">
                    {selectedItem.sub_type}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
                      {selectedItem.color}
                    </span>
                    <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
                      {selectedItem.category}
                    </span>
                    {selectedItem.season && selectedItem.season !== 'all' && (
                      <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
                        {selectedItem.season.replace(/_/g, ' ')}
                      </span>
                    )}
                    {selectedItem.fit && (
                      <span className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-espresso">
                        {selectedItem.fit}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSwappingItem(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-cream"
                  >
                    Swap
                  </button>
                </div>
              </div>
            )}

            {/* Style hashtags */}
            {hashtags.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <span key={tag} className="text-sm text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mb-8 flex justify-center">
              <button onClick={fetchOutfit} className="btn-outline btn-sm gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh Suggestion
              </button>
            </div>
          </>
        ) : null}
      </main>

      {recommendation && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto max-w-xl px-6 py-4">
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
