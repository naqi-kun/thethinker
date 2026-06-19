import { useNavigate } from 'react-router-dom';
import {
  Scan,
  CalendarDays,
  Sparkles,
  ArrowRight,
  CloudSun,
} from 'lucide-react';

const trustItems = [
  { icon: Scan, label: 'Your wardrobe' },
  { icon: CalendarDays, label: 'Your calendar' },
  { icon: CloudSun, label: 'Live weather' },
] as const;

const steps = [
  {
    icon: Scan,
    title: 'Scan your wardrobe',
    description:
      'Photograph each item once. We learn your style from what you actually own.',
  },
  {
    icon: CalendarDays,
    title: 'Sync your schedule',
    description:
      'Connect your calendar so looks match your day — meetings, dinners, casual Fridays.',
  },
  {
    icon: Sparkles,
    title: 'Get styled daily',
    description:
      'Every morning, one complete outfit tailored to weather, occasion, and your taste.',
  },
] as const;

const flatLayItems = [
  { color: '#f0e4d6', className: 'left-[6%] top-[7%] h-[45%] w-[34%] rotate-[5deg]' },
  { color: '#4a4a4a', className: 'left-[37%] top-[18%] h-[44%] w-[34%] -rotate-[4deg]' },
  { color: '#c9a96e', className: 'left-[11%] top-[55%] h-[34%] w-[30%] rotate-[6deg]' },
  { color: '#a8a8b3', className: 'left-[47%] top-[59%] h-[29%] w-[25%] -rotate-[7deg]' },
] as const;

function FlatLayPreview() {
  return (
    <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-[#EADFD0] bg-cream md:h-[200px]">
      {flatLayItems.map(({ color, className }) => (
        <div
          key={color}
          className={`absolute rounded-[10px] shadow-md ${className}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function ContextChips() {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full border border-border bg-cream px-2.5 py-1 text-[11px] font-medium text-foreground">
        22°C · Sunny
      </span>
      <span className="rounded-full border border-border bg-cream px-2.5 py-1 text-[11px] font-medium text-foreground">
        Client Meeting
      </span>
    </div>
  );
}

function WhyCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-xl bg-linen p-2.5">
        <p className="text-xs leading-snug text-foreground">
          Neutral tones — sharp for your meeting without trying too hard.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-border bg-linen p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-terracotta" />
        <span className="text-[10px] font-semibold tracking-wider text-terracotta">
          WHY THIS LOOK
        </span>
      </div>
      <p className="text-xs leading-snug text-foreground">
        Neutral tones keep it sharp for your client meeting — polished without trying too hard.
      </p>
    </div>
  );
}

function ProductPreviewCard() {
  return (
    <div className="w-full rounded-[20px] border border-border bg-cream p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
          Today&apos;s Outfit
        </span>
        <span className="badge-clean gap-1 px-2 py-0.5 text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Ready
        </span>
      </div>
      <ContextChips />
      <div className="my-3">
        <FlatLayPreview />
      </div>
      <WhyCard compact />
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[320px] rounded-[32px] bg-espresso p-2.5 shadow-2xl shadow-espresso/20">
        <div className="flex flex-col gap-3 rounded-3xl bg-cream p-4">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-terracotta">
              TODAY&apos;S LOOK
            </p>
            <p className="font-serif text-[22px] text-espresso">Friday, June 19</p>
          </div>
          <ContextChips />
          <FlatLayPreview />
          <WhyCard />
          <div className="rounded-full bg-terracotta py-3 text-center text-[13px] font-semibold text-cream">
            Wear This Today
          </div>
        </div>
      </div>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">
        What you&apos;ll see every morning
      </p>
    </div>
  );
}

function scrollToHowItWorks() {
  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
}

export default function LandingPage() {
  const navigate = useNavigate();
  const goToLogin = () => navigate('/login');
  const goToRegister = () => navigate('/register');

  return (
    <div className="min-h-screen-safe bg-background">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-12 lg:py-5">
        <span className="font-serif text-xl text-terracotta lg:text-[22px]">
          TheThinker
        </span>
        <button
          onClick={goToLogin}
          className="rounded-full border border-border px-3.5 py-2 text-[13px] font-semibold text-foreground lg:px-[18px] lg:py-2.5 lg:text-sm"
        >
          Sign in
        </button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-2 lg:px-12 lg:pb-12 lg:pt-4">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex flex-col gap-3.5 text-center lg:flex-1 lg:gap-[18px] lg:text-left">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-terracotta lg:text-[11px] lg:tracking-[0.15em]">
              SCAN · SCHEDULE · STYLE
            </p>
            <h1 className="font-serif text-[34px] leading-[1.12] text-espresso lg:text-5xl lg:leading-[1.1]">
              Stop deciding what to wear.
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground lg:text-base">
              <span className="lg:hidden">
                Scan your wardrobe, sync your calendar, and get one outfit every morning —
                tailored to weather and your day.
              </span>
              <span className="hidden lg:inline">
                TheThinker scans your wardrobe, reads your calendar, and delivers one complete
                outfit every morning — tailored to the weather and your day.
              </span>
            </p>
            <div className="flex flex-col gap-3 pt-1 lg:flex-row lg:items-center">
              <button
                onClick={goToRegister}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-full py-[15px] text-[15px] lg:w-auto lg:px-6 lg:py-3.5"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={scrollToHowItWorks}
                className="hidden rounded-full border border-border px-5 py-3.5 text-sm font-semibold text-foreground lg:inline-flex"
              >
                See how it works
              </button>
            </div>
          </div>

          {/* Mobile: inline product card */}
          <div className="lg:hidden">
            <p className="mb-2.5 text-center text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
              WHAT YOU&apos;LL SEE EVERY MORNING
            </p>
            <ProductPreviewCard />
          </div>

          {/* Desktop: phone mockup */}
          <div className="hidden flex-1 justify-center lg:flex">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-linen">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3.5 px-5 py-4 lg:flex-row lg:justify-center lg:gap-8 lg:px-12 lg:py-5">
          {trustItems.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-terracotta lg:h-[18px] lg:w-[18px]" />
              <span className="text-[13px] font-semibold text-espresso lg:text-sm">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-10 lg:px-12 lg:py-14">
        <div className="mb-8 flex flex-col items-center gap-1.5 text-center lg:mb-10 lg:gap-2">
          <h2 className="text-[26px] lg:text-[32px]">How it works</h2>
          <p className="max-w-xl text-sm text-muted-foreground lg:text-[15px]">
            <span className="lg:hidden">Three steps to a confident morning.</span>
            <span className="hidden lg:inline">
              Three steps from closet chaos to a confident morning.
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:gap-6">
          {steps.map(({ icon: Icon, title, description }, i) => (
            <div
              key={title}
              className="flex gap-3.5 rounded-[14px] border border-border bg-cream p-4 lg:flex-col lg:gap-3 lg:rounded-2xl lg:p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-terracotta/10 lg:h-11 lg:w-11 lg:rounded-xl">
                <Icon className="h-[18px] w-[18px] text-terracotta lg:h-5 lg:w-5" />
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[9px] font-semibold tracking-wider text-muted-foreground lg:text-[10px]">
                  STEP {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mb-1 font-serif text-base text-espresso lg:text-lg">
                  {title}
                </h3>
                <p className="text-xs leading-snug text-muted-foreground lg:text-[13px] lg:leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Proof band */}
      <section className="bg-espresso text-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-8 text-center lg:flex-row lg:items-center lg:gap-10 lg:px-16 lg:py-12 lg:text-left">
          <div className="flex-1 space-y-2.5">
            <blockquote className="font-serif text-xl leading-snug lg:text-2xl lg:leading-[1.35]">
              &ldquo;I stopped opening my closet and staring. TheThinker just tells me what
              works.&rdquo;
            </blockquote>
            <p className="text-xs text-[#D4BDA8] lg:text-[13px]">— Early beta user</p>
          </div>
          <div className="flex flex-col items-center gap-1 lg:w-[180px] lg:items-start">
            <div className="flex items-center gap-2 lg:flex-col lg:items-start lg:gap-1">
              <span className="font-serif text-[28px] text-terracotta lg:text-4xl">
                &lt; 2 min
              </span>
              <span className="text-xs text-[#D4BDA8] lg:text-[13px] lg:leading-snug">
                to get dressed with confidence
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-linen/50 py-10 text-center lg:py-14">
        <div className="mx-auto max-w-lg px-5 lg:px-6">
          <h3 className="mb-3 text-2xl lg:text-[28px]">Ready to dress smarter?</h3>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground lg:mb-8 lg:text-[15px]">
            <span className="lg:hidden">
              Your wardrobe is full of great outfits. Let TheThinker surface them.
            </span>
            <span className="hidden lg:inline">
              Your wardrobe is already full of great outfits. Let TheThinker surface them.
            </span>
          </p>
          <button
            onClick={goToRegister}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full py-[15px] text-[15px] lg:w-auto lg:px-8 lg:py-4 lg:text-base"
          >
            Get started
            <ArrowRight className="h-4 w-4 lg:h-[18px] lg:w-[18px]" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-5 py-5 text-center lg:px-12 lg:py-6">
        <p className="text-[11px] text-muted-foreground lg:text-xs">
          © {new Date().getFullYear()} TheThinker · Scan · Schedule · Style
        </p>
      </footer>
    </div>
  );
}
