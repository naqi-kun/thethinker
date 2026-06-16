import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Check, ExternalLink, Link2, Plus, Trash2 } from 'lucide-react';
import type { Calendar as CalendarType } from '../../../shared/api/types';
import { addCalendar, listCalendars, removeCalendar } from '../api';
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

export default function CalendarPage() {
  const [calendars, setCalendars] = useState<CalendarType[]>([]);
  const [name, setName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The most recently added calendar — gets a one-shot highlight on entry.
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Per-provider connect panel state.
  const [openProvider, setOpenProvider] = useState<Provider['id'] | null>(null);
  const [providerUrl, setProviderUrl] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    listCalendars()
      .then(setCalendars)
      .catch(() => setError('Failed to load your calendars.'));
  }, []);

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

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      await removeCalendar(id);
      setCalendars((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError('Could not remove that calendar. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="pb-28 md:pb-8">
      <main className="mx-auto max-w-xl px-6 py-12">
        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div variants={fadeUpItem} className="mb-8 text-center">
            <h2 className="mb-3">Sync Your Life</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Add a calendar with its ICS link and TheThinker will surface the day's
              events on your home screen to tailor each outfit.
            </p>
          </motion.div>

          {error && (
            <p className="mb-4 text-center text-sm text-destructive">{error}</p>
          )}

          {/* Add via ICS URL */}
          <motion.form
            variants={fadeUpItem}
            onSubmit={handleAdd}
            className="mb-8 rounded-xl border border-border bg-card/60 p-5"
          >
            <p className="mb-3 flex items-center gap-2 font-sans font-semibold text-foreground">
              <Link2 className="h-4 w-4 text-terracotta" />
              Add a calendar via ICS URL
            </p>
            <div className="space-y-3">
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
            </div>
          </motion.form>

          {/* Added calendars */}
          {calendars.length > 0 && (
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
                      onClick={() => handleRemove(cal.id)}
                      disabled={removingId === cal.id}
                      className="btn-link shrink-0 text-sm font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                      aria-label={`Remove ${cal.name || 'calendar'}`}
                    >
                      {removingId === cal.id ? (
                        'Removing…'
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Provider connectors (Google / Apple via their calendar link) */}
          <motion.div variants={fadeUpItem}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              More sync options
            </p>
            <div className="mb-8 space-y-3">
              {providers.map((provider) => {
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
                        <p className="text-xs text-muted-foreground">
                          {provider.subtitle}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleProvider(provider.id)}
                        className="btn-primary btn-sm shrink-0"
                      >
                        {isOpen ? 'Cancel' : 'Connect'}
                      </button>
                    </div>

                    {isOpen && (
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
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.p
            variants={fadeUpItem}
            className="text-center text-xs leading-relaxed text-muted-foreground"
          >
            TheThinker values your privacy. We only read event titles, times, and{' '}
            <span className="text-terracotta underline">locations</span> to provide
            context for your outfit{' '}
            <span className="text-terracotta underline">recommendations</span>. Your
            calendar data is never shared with third parties.
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
