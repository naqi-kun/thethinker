import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';
import { connectCalendar, disconnectCalendar } from '../api';

type Provider = {
  id: 'google' | 'apple';
  name: string;
  subtitle: string;
};

const providers: Provider[] = [
  { id: 'google', name: 'Google Calendar', subtitle: 'Gmail Synchronization' },
  { id: 'apple', name: 'Apple Calendar', subtitle: 'iCloud Synchronization' },
];

export default function CalendarPage() {
  const [connected, setConnected] = useState<Record<Provider['id'], boolean>>({
    google: false,
    apple: false,
  });
  const [loading, setLoading] = useState<Record<Provider['id'], boolean>>({
    google: false,
    apple: false,
  });
  const [error, setError] = useState<string | null>(null);

  async function connect(id: Provider['id']) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      // auth_code comes from an OAuth popup in the full implementation
      await connectCalendar(id, '');
      setConnected((prev) => ({ ...prev, [id]: true }));
    } catch {
      setError(`Failed to connect ${id} calendar. Please try again.`);
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function disconnect(id: Provider['id']) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      await disconnectCalendar();
      setConnected((prev) => ({ ...prev, [id]: false }));
    } catch {
      setError(`Failed to disconnect ${id} calendar. Please try again.`);
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="min-h-screen-safe bg-background">
      <TopNav />

      <main className="mx-auto max-w-xl px-6 py-12">
        <div className="mb-8 text-center">
          <h2 className="mb-3">Sync Your Life</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Connect your calendar to let TheThinker suggest outfits based on your upcoming
            events and local weather.
          </p>
        </div>

        {error && (
          <p className="mb-4 text-center text-sm text-destructive">{error}</p>
        )}

        <div className="mb-8 space-y-3">
          {providers.map((provider) => {
            const isConnected = connected[provider.id];
            const isLoading = loading[provider.id];

            return (
              <div
                key={provider.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card/60 p-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-terracotta">
                  <Calendar className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-sans font-semibold text-foreground">{provider.name}</p>
                  {isConnected ? (
                    <p className="flex items-center gap-1 text-xs text-success">
                      <Check className="h-3 w-3" />
                      Connected
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{provider.subtitle}</p>
                  )}
                </div>

                {isConnected ? (
                  <button
                    onClick={() => disconnect(provider.id)}
                    disabled={isLoading}
                    className="btn-link shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {isLoading ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={() => connect(provider.id)}
                    disabled={isLoading}
                    className="btn-primary btn-sm shrink-0 disabled:opacity-50"
                  >
                    {isLoading ? 'Connecting…' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="relative mb-8 overflow-hidden rounded-xl bg-gradient-to-br from-sand via-linen to-cream p-6"
          style={{ minHeight: '140px' }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-espresso/10 to-transparent" />
          <div className="relative">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Thoughtful Curation
            </p>
            <p className="font-serif text-lg italic text-espresso">
              &ldquo;Style is a way to say who you are without having to speak.&rdquo;
            </p>
          </div>
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          TheThinker values your privacy. We only access event titles and{' '}
          <span className="text-terracotta underline">locations</span> to provide context
          for your outfit{' '}
          <span className="text-terracotta underline">recommendations</span>. Your
          calendar data is never shared with third parties.
        </p>
      </main>
    </div>
  );
}
