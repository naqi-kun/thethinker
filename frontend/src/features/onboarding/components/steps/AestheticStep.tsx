import { Check } from 'lucide-react';
import { AESTHETICS, type Aesthetic } from '../../../../shared/aesthetics';
import OnboardingHeader from './OnboardingHeader';

// "Basic" is featured as the plain-language default; the rest of the shared
// taxonomy (KAN-92) is offered as a grid of vibes. Single-select.
const VIBES = AESTHETICS.filter((a) => a !== 'Basic');

export default function AestheticStep({
  value,
  onChange,
  onContinue,
  onSkip,
  onBack,
}: {
  value: Aesthetic;
  onChange: (a: Aesthetic) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-screen-safe w-full max-w-md flex-col px-6 py-10">
      <OnboardingHeader step={1} total={2} onBack={onBack} />

      <h2 className="mb-2">What's your aesthetic?</h2>
      <p className="helper-text mb-6">
        Pick the vibe your wardrobe leans into — we'll tune your daily looks to match.
        Change it anytime.
      </p>

      <button
        onClick={() => onChange('Basic')}
        className={`mb-6 flex items-center justify-between rounded-xl border-2 p-4 text-left transition-colors ${
          value === 'Basic'
            ? 'border-primary bg-primary/10'
            : 'border-border bg-card hover:border-primary/50'
        }`}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-foreground">Basic</span>
          <span className="text-sm text-muted-foreground">
            Just keep it simple — put-together, no fuss.
          </span>
        </span>
        {value === 'Basic' && <Check className="h-5 w-5 shrink-0 text-primary" />}
      </button>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Or choose a vibe
      </p>
      <div className="mb-8 grid grid-cols-2 gap-2">
        {VIBES.map((vibe) => {
          const selected = value === vibe;
          return (
            <button
              key={vibe}
              onClick={() => onChange(vibe)}
              className={`flex items-center justify-between gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary/50'
              }`}
            >
              <span className="truncate">{vibe}</span>
              {selected && <Check className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-3">
        <button onClick={onContinue} className="btn-primary btn-lg w-full">
          Continue
        </button>
        <button onClick={onSkip} className="btn-link btn-sm">
          Skip for now
        </button>
      </div>
    </div>
  );
}
