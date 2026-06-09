import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Check, RefreshCw, Shirt, Sun } from 'lucide-react';
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

function ItemCard({ item, onClick }: { item: ClothingItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-lg text-left"
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
      <span className="absolute bottom-2 left-2 rounded-full bg-cream/90 px-2.5 py-0.5 text-xs font-medium text-espresso shadow-sm backdrop-blur-sm">
        {item.sub_type}
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-black/30 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
        swap
      </span>
    </button>
  );
}

export default function OutfitPage() {
  const navigate = useNavigate();
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [emptyWardrobe, setEmptyWardrobe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [swappingItem, setSwappingItem] = useState<ClothingItem | null>(null);

  const fetchOutfit = useCallback(() => {
    setLoading(true);
    setError(null);
    setEmptyWardrobe(false);
    setAccepted(false);
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

  const handleAccept = useCallback(async () => {
    if (!recommendation || accepting || accepted) return;
    const itemIds = recommendation.items.slice(0, MAX_ITEMS).map((i) => i.id);
    setAccepting(true);
    try {
      await acceptOutfit(itemIds);
      setAccepted(true);
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

  return (
    <div className="min-h-screen-safe bg-background pb-28">
      <TopNav />

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
            <div className="mb-6 rounded-xl border border-border bg-cream p-4">
              <div className="grid grid-cols-2 gap-3">
                {displayItems.map((item: ClothingItem) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => setSwappingItem(item)}
                  />
                ))}
              </div>
            </div>

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
