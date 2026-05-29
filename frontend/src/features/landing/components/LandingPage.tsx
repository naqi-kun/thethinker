import { useNavigate } from 'react-router-dom';
import { Scan, CalendarDays, Sparkles, ArrowRight, Shirt } from 'lucide-react';

const steps = [
  {
    icon: Scan,
    title: 'Scan your wardrobe',
    description:
      'Photograph each clothing item once. TheThinker learns your style from what you actually own.',
  },
  {
    icon: CalendarDays,
    title: 'Sync your schedule',
    description:
      'Connect your calendar so recommendations match your day — board meeting, casual Friday, dinner out.',
  },
  {
    icon: Sparkles,
    title: 'Get styled for the day',
    description:
      'Every morning, receive a complete outfit tailored to your calendar, the weather, and your personal style.',
  },
];

// Mini outfit preview cards
function OutfitPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Background card (depth) */}
      <div className="absolute left-4 right-4 top-3 h-full rounded-2xl border border-border bg-linen opacity-60" />
      {/* Foreground card */}
      <div className="relative rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today's Outfit
          </span>
          <span className="badge-default gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Ready
          </span>
        </div>

        {/* Outfit grid preview */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            { label: 'White Oxford Shirt', color: '#f0e4d6' },
            { label: 'Charcoal Trousers', color: '#4a4a4a' },
            { label: 'Tan Loafers', color: '#c9a96e' },
            { label: 'Silver Watch', color: '#a8a8b3' },
          ].map(({ label, color }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-xl p-3"
              style={{ backgroundColor: color + '33' }}
            >
              <div
                className="h-8 w-8 rounded-full border border-border/50"
                style={{ backgroundColor: color }}
              />
              <span className="text-center text-[10px] font-medium text-foreground">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Context badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="badge-outline text-[10px]">☀️ 22°C · Sunny</span>
          <span className="badge-outline text-[10px]">📅 Client Meeting</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen-safe bg-background">
      {/* ── Nav ── */}
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <span className="font-serif text-xl font-medium text-terracotta">
          TheThinker
        </span>
        <button onClick={() => navigate('/login')} className="btn-outline btn-sm">
          Sign in
        </button>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-3xl px-6 pb-20 pt-12 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-terracotta shadow-lg">
          <Shirt className="h-8 w-8 text-cream" />
        </div>
        <h1 className="mb-4 text-gradient">TheThinker</h1>
        <p className="mb-3 font-serif text-2xl text-muted-foreground">
          Scan · Schedule · Style
        </p>
        <p className="mx-auto mb-10 max-w-md text-base text-muted-foreground">
          AI-powered outfit recommendations based on your wardrobe, calendar, and
          weather. Stop thinking about what to wear.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate('/login')}
            className="btn-primary btn-lg w-full gap-2 sm:w-auto"
          >
            Get started
            <ArrowRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate('/wardrobe')}
            className="btn-outline btn-lg w-full sm:w-auto"
          >
            View wardrobe
          </button>
        </div>
      </section>

      {/* ── Product preview ── */}
      <section className="bg-linen/50 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <p className="mb-10 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            What you'll see every morning
          </p>
          <OutfitPreview />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="mb-12 text-center">How it works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, description }, i) => (
            <div key={title} className="flex flex-col items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {i + 1}
                </p>
                <h5 className="mb-1.5">{title}</h5>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="border-t border-border bg-linen/30 py-16 text-center">
        <div className="mx-auto max-w-md px-6">
          <h3 className="mb-3">Ready to dress smarter?</h3>
          <p className="mb-8 text-muted-foreground">
            Your wardrobe is already full of great outfits. Let TheThinker surface them.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary btn-lg gap-2"
          >
            Get started
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TheThinker · Scan · Schedule · Style
        </p>
      </footer>
    </div>
  );
}
