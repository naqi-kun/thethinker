import { ArrowRight } from 'lucide-react';

// Onboarding 1 · Welcome — intro screen shown right after registration.
const HERO_IMG = 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&q=80';

export default function WelcomeStep({
  onStart,
  onHaveAccount,
}: {
  onStart: () => void;
  onHaveAccount: () => void;
}) {
  return (
    <div className="flex min-h-screen-safe w-full max-w-md flex-col px-6 py-10">
      <div className="mb-8 text-center font-serif text-xl text-terracotta">
        TheThinker
      </div>

      <div className="mb-8 aspect-4/5 w-full overflow-hidden rounded-xl bg-card shadow-sm">
        <img
          src={HERO_IMG}
          alt="A flat-lay of neatly arranged clothing"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      <h1 className="mb-3 text-center">Your closet, styled daily.</h1>
      <p className="helper-text mb-auto text-center">
        Scan your wardrobe, sync your calendar, and get one outfit picked for your day —
        every morning.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button onClick={onStart} className="btn-primary btn-lg w-full">
          Get Started <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={onHaveAccount} className="btn-link btn-sm">
          I already have an account
        </button>
      </div>
    </div>
  );
}
