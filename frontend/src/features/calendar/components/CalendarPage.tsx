import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  ExternalLink,
  Link2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Calendar as CalendarType,
  CalendarEvent,
} from '../../../shared/api/types';
import {
  addCalendar,
  getTodayEvents,
  ignoreEvent,
  listCalendars,
  removeCalendar,
  syncCalendar,
} from '../api';
import { ease, staggerContainer, fadeUpItem } from '../../../shared/motion';

type Provider = {
  id: 'google' | 'apple';
  name: string;
  subtitle: string;
  helpUrl: string;
  steps: string[];
};

const providers: Provider[] = [
  {
    id: 'google',
    name: 'Google Calendar',
    subtitle: 'Gmail Synchronization',
    helpUrl: 'https://calendar.google.com/calendar/r/settings',
    steps: [
      'Open Google Calendar settings on the web.',
      "Pick your calendar → 'Integrate calendar'.",
      "Copy the 'Secret address in iCal format' and paste it below.",
    ],
  },
  {
    id: 'apple',
    name: 'Apple Calendar',
    subtitle: 'iCloud Synchronization',
    helpUrl: 'https://www.icloud.com/calendar',
    steps: [
      'Open Calendar on iCloud.com or your Mac.',
      'Share the calendar → enable Public Calendar.',
      'Copy the link and paste it below (webcal links work too).',
    ],
  },
];

// Apple/iCloud share links use the webcal:// scheme, which is just HTTP(S)
// underneath. Normalize so the backend (which only accepts http/https) can fetch it.
function normalizeIcsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('webcal://')) {
    return 'https://' + trimmed.slice('webcal://'.length);
  }
  return trimmed;
}

const todayLabel = new Date().toLocaleDateString('en-US', {
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

export default function CalendarPage() {
  const [calendars, setCalendars] = useState<CalendarType[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // Until the first calendar list resolves we don't know whether to show the
  // schedule or the connect prompt — hold off on rendering either.
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [name, setName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The most recently added calendar — gets a one-shot highlight on entry.
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Per-provider connect panel state.
  const [openProvider, setOpenProvider] = useState<Provider['id'] | null>(null);
  const [providerUrl, setProviderUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  // The "Add via ICS URL" form is a power-user path, so it stays collapsed
  // below the provider cards until tapped.
  const [icsOpen, setIcsOpen] = useState(false);
  // True while the on-open background resync is in flight (shows a subtle hint).
  const [autoSyncing, setAutoSyncing] = useState(false);
  // Guards against React StrictMode's double-mount firing the resync twice.
  const didAutoSync = useRef(false);

  useEffect(() => {
    listCalendars()
      .then((cals) => {
        setCalendars(cals);
        // Refresh from the providers on open so the user sees current events
        // without waiting for the background ticker — but only kick it off once
        // per mount, and only when there's something to sync.
        if (cals.length > 0 && !didAutoSync.current) {
          didAutoSync.current = true;
          void autoSyncAll(cals);
        }
      })
      .catch(() => setError('Failed to load your calendars.'))
      .finally(() => setLoadingCalendars(false));
    // Run once on mount; autoSyncAll is stable enough for this passive refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshEvents();
  }, []);

  function refreshEvents() {
    // Today's events are best-effort context; a failure just leaves the
    // schedule empty rather than blocking the page.
    getTodayEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }

  // Re-fetch every calendar from its source in the background, then refresh the
  // schedule. Non-blocking: the stored snapshot is already on screen, so this
  // just swaps in fresher data when it arrives. Per-calendar failures are
  // ignored — a flaky feed shouldn't surface an error on a passive refresh.
  async function autoSyncAll(cals: CalendarType[]) {
    setAutoSyncing(true);
    try {
      const results = await Promise.allSettled(
        cals.map(async (c) => ({ id: c.id, cal: await syncCalendar(c.id) })),
      );
      const updated = new Map<string, CalendarType>();
      for (const r of results) {
        if (r.status === 'fulfilled') updated.set(r.value.id, r.value.cal);
      }
      setCalendars((prev) => prev.map((c) => updated.get(c.id) ?? c));
      refreshEvents();
    } finally {
      setAutoSyncing(false);
    }
  }

  // Check if a calendar with the provider's name already exists (by name, not source)
  function hasProviderConnected(providerName: string): boolean {
    return calendars.some((cal) => cal.name === providerName);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!icsUrl.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const created = await addCalendar(name.trim(), normalizeIcsUrl(icsUrl));
      setCalendars((prev) => [...prev, created]);
      setJustAddedId(created.id);
      setName('');
      setIcsUrl('');
      setIcsOpen(false);
      refreshEvents();
    } catch {
      setError('Could not add that calendar. Check the ICS URL and try again.');
    } finally {
      setAdding(false);
    }
  }

  async function handleConnectProvider(provider: Provider) {
    if (!providerUrl.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const created = await addCalendar(provider.name, normalizeIcsUrl(providerUrl));
      setCalendars((prev) => [...prev, created]);
      setJustAddedId(created.id);
      setProviderUrl('');
      setOpenProvider(null);
      refreshEvents();
    } catch {
      setError(`Could not connect ${provider.name}. Check the link and try again.`);
    } finally {
      setConnecting(false);
    }
  }

  function toggleProvider(id: Provider['id']) {
    setError(null);
    setProviderUrl('');
    setOpenProvider((prev) => (prev === id ? null : id));
  }

  async function handleSync(id: string) {
    setSyncingId(id);
    setError(null);
    try {
      const updated = await syncCalendar(id);
      setCalendars((prev) => prev.map((c) => (c.id === id ? updated : c)));
      refreshEvents();
    } catch {
      setError('Could not re-sync that calendar. Please try again.');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      await removeCalendar(id);
      setCalendars((prev) => prev.filter((c) => c.id !== id));
      refreshEvents();
    } catch {
      setError('Could not remove that calendar. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }

  // Optimistically hide an event from outfit recommendations.
  function handleIgnore(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    ignoreEvent(id).catch(() => {
      // On failure, reload so the UI matches the server.
      refreshEvents();
    });
  }

  const connected = calendars.length > 0;
  const unconnectedProviders = providers.filter(
    (provider) => !hasProviderConnected(provider.name),
  );

  // The collapsible "Add via ICS URL" card — rendered below the provider cards
  // in both the connected and connect-first views.
  const icsCard = (
    <motion.div variants={fadeUpItem} className="mb-8">
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <button
          type="button"
          onClick={() => setIcsOpen((v) => !v)}
          aria-expanded={icsOpen}
          className="flex w-full items-center gap-4 text-left"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-terracotta">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-sans font-semibold text-foreground">Add via ICS URL</p>
            <p className="text-xs text-muted-foreground">
              Any calendar with an iCal link
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              icsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <AnimatePresence>
          {icsOpen && (
            <motion.div
              key="ics-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease }}
              className="overflow-hidden"
            >
              <form
                onSubmit={handleAdd}
                className="mt-4 space-y-3 border-t border-border pt-4"
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name (optional, e.g. Work)"
                  className="input w-full"
                />
                <input
                  type="url"
                  value={icsUrl}
                  onChange={(e) => setIcsUrl(e.target.value)}
                  placeholder="https://example.com/calendar.ics"
                  required
                  className="input w-full"
                />
                <button
                  type="submit"
                  disabled={adding || !icsUrl.trim()}
                  className="btn-primary btn-sm w-full gap-2 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {adding ? 'Adding…' : 'Add Calendar'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  // Provider connectors (Google / Apple via their iCal link).
  const providerCards = unconnectedProviders.length > 0 && (
    <motion.div variants={fadeUpItem}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {connected ? 'More sync options' : 'Connect a calendar'}
      </p>
      <div className="mb-8 space-y-3">
        {unconnectedProviders.map((provider) => {
          const isOpen = openProvider === provider.id;
          return (
            <div
              key={provider.id}
              className="rounded-xl border border-border bg-card/60 p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-terracotta">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans font-semibold text-foreground">
                    {provider.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{provider.subtitle}</p>
                </div>
                <button
                  onClick={() => toggleProvider(provider.id)}
                  className="btn-primary btn-sm shrink-0"
                >
                  {isOpen ? 'Cancel' : 'Connect'}
                </button>
              </div>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    key="panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 border-t border-border pt-4">
                      <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                        {provider.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      <a
                        href={provider.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:underline"
                      >
                        Open {provider.name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={providerUrl}
                          onChange={(e) => setProviderUrl(e.target.value)}
                          placeholder="Paste your calendar link here"
                          className="input w-full"
                        />
                        <button
                          onClick={() => handleConnectProvider(provider)}
                          disabled={connecting || !providerUrl.trim()}
                          className="btn-primary btn-sm w-full gap-2 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          {connecting ? 'Connecting…' : `Connect ${provider.name}`}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );

  const privacyNote = (
    <motion.p
      variants={fadeUpItem}
      className="text-center text-xs leading-relaxed text-muted-foreground"
    >
      TheThinker values your privacy. We only read event titles, times, and{' '}
      <span className="text-terracotta underline">locations</span> to provide context
      for your outfit{' '}
      <span className="text-terracotta underline">recommendations</span>. Your calendar
      data is never shared with third parties.
    </motion.p>
  );

  return (
    <div className="pb-28 md:pb-8">
      <main className="mx-auto max-w-xl px-6 py-12">
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="mb-4 text-center text-sm text-destructive"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {loadingCalendars ? null : connected ? (
          // ── CONNECTED: schedule first, manage calendars below ──────────────
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            <motion.div variants={fadeUpItem} className="mb-6 text-center">
              <h2 className="mb-1">{todayLabel}</h2>
              <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                Today's schedule
                {autoSyncing && (
                  <span className="inline-flex items-center gap-1 text-xs text-terracotta">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Syncing…
                  </span>
                )}
              </p>
            </motion.div>

            <motion.div variants={fadeUpItem} className="mb-10">
              {events.length > 0 ? (
                <ul className="space-y-3">
                  {events.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start gap-4 rounded-xl border border-border bg-card/60 p-4"
                    >
                      <span className="w-20 shrink-0 text-sm font-semibold text-foreground">
                        {formatEventTime(event)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {event.title}
                        </span>
                        {event.location && (
                          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => handleIgnore(event.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Ignore ${event.title}`}
                        title="Hide from recommendations"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
                  <CalendarClock className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium text-foreground">
                    Nothing on your calendar today
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Enjoy the open day — we'll still style you for the weather.
                  </p>
                </div>
              )}
            </motion.div>

            <motion.p
              variants={fadeUpItem}
              className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Your calendars
            </motion.p>
            <motion.div variants={fadeUpItem} className="mb-8 space-y-3">
              <AnimatePresence initial={false}>
                {calendars.map((cal) => (
                  <motion.div
                    key={cal.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      // Newly added calendars flash a green ring once, then settle.
                      boxShadow:
                        cal.id === justAddedId
                          ? [
                              '0 0 0 2px rgba(74,139,92,0.55)',
                              '0 0 0 6px rgba(74,139,92,0)',
                            ]
                          : '0 0 0 0 rgba(74,139,92,0)',
                    }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.35, ease }}
                    onAnimationComplete={() => {
                      if (cal.id === justAddedId) setJustAddedId(null);
                    }}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card/60 p-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-terracotta">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans font-semibold text-foreground">
                        {cal.name || 'Calendar'}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-success">
                        <Check className="h-3 w-3" />
                        Synced via {cal.source.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSync(cal.id)}
                      disabled={syncingId === cal.id || removingId === cal.id}
                      className="btn-link shrink-0 text-sm font-medium text-muted-foreground hover:text-terracotta disabled:opacity-50"
                      aria-label={`Re-sync ${cal.name || 'calendar'}`}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${syncingId === cal.id ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <button
                      onClick={() => handleRemove(cal.id)}
                      disabled={removingId === cal.id || syncingId === cal.id}
                      className="btn-link shrink-0 text-sm font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                      aria-label={`Remove ${cal.name || 'calendar'}`}
                    >
                      {removingId === cal.id ? 'Removing…' : <Trash2 className="h-4 w-4" />}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {providerCards}
            {icsCard}
            {privacyNote}
          </motion.div>
        ) : (
          // ── NOT CONNECTED: ask the user to connect before any schedule ─────
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            <motion.div variants={fadeUpItem} className="mb-8 text-center">
              <h2 className="mb-3">Sync Your Life</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Connect a calendar and TheThinker will surface the day's events right
                here — and tailor each outfit to where you're headed.
              </p>
            </motion.div>

            {providerCards}
            {icsCard}
            {privacyNote}
          </motion.div>
        )}
      </main>
    </div>
  );
}
