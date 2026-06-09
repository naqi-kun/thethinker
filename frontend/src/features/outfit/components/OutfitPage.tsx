import { useCallback, useEffect, useState } from 'react';
import { Briefcase, CalendarClock, Check, MapPin, RefreshCw, Sun } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';
import type {
  CalendarEvent,
  ClothingItem,
  OutfitRecommendation,
} from '../../../shared/api/types';
import { getTodayEvents } from '../../calendar/api';
import { getOutfit } from '../api';

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

function formatEventTime(event: CalendarEvent): string {
  if (event.all_day) return 'All day';
  return new Date(event.starts_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ItemCard({ item }: { item: ClothingItem }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.sub_type}
          className="h-48 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-linen/60">
          <p className="text-sm text-muted-foreground capitalize">{item.category}</p>
        </div>
      )}
      <span className="absolute bottom-3 left-3 rounded-full bg-cream/90 px-3 py-1 text-xs font-medium text-espresso shadow-sm backdrop-blur-sm">
        {item.sub_type}
      </span>
    </div>
  );
}

export default function OutfitPage() {
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(
    null,
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const fetchOutfit = useCallback(() => {
    setLoading(true);
    setError(null);
    setAccepted(false);
    getOutfit()
      .then(setRecommendation)
      .catch(() => setError('Unable to load outfit recommendation. Please try again.'))
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
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Curating your outfit…
          </p>
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
              <div className="space-y-3">
                {recommendation.items.map((item: ClothingItem) => (
                  <ItemCard key={item.id} item={item} />
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
              onClick={() => setAccepted(true)}
              disabled={accepted}
              className="btn-primary btn-lg w-full gap-2"
            >
              {accepted ? 'Saved for today' : 'Wear This Today'}
              <Check className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
