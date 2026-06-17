import { MapPin, Loader2 } from 'lucide-react';
import OnboardingHeader from './OnboardingHeader';

// Onboarding 3 · Location. Leads with one-tap geolocation; "Enter a city
// instead" (or any geolocation failure) reveals a manual city field. The
// resolved city string is what weather is keyed by.
export default function LocationStep({
  value,
  onChange,
  onAllowLocation,
  resolving,
  error,
  manualMode,
  onEnterCity,
  onContinue,
  onSkip,
  onBack,
}: {
  value: string;
  onChange: (s: string) => void;
  onAllowLocation: () => void;
  resolving: boolean;
  error: string | null;
  manualMode: boolean;
  onEnterCity: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-screen-safe w-full max-w-md flex-col px-6 py-10">
      <OnboardingHeader step={2} total={2} onBack={onBack} />

      <h2 className="mb-2">Where are you based?</h2>
      <p className="helper-text mb-8">
        We use your location to pick outfits for the day's weather. That's the only
        thing it's used for.
      </p>

      <div className="mb-8 flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MapPin className="h-6 w-6" />
        </div>
        <p className="helper-text max-w-[14rem]">
          Weather-based outfits, tuned to where you are
        </p>
      </div>

      {error && <p className="error-text mb-4 text-center">{error}</p>}

      {manualMode ? (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && value.trim() && onContinue()}
              placeholder="e.g. New York, London, Tokyo"
              autoFocus
              aria-label="City or region"
              className="input pl-9"
            />
          </div>
          <button
            onClick={onContinue}
            disabled={!value.trim()}
            className="btn-primary btn-lg w-full"
          >
            Continue
          </button>
          <button onClick={onSkip} className="btn-link btn-sm self-center">
            Skip for now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={onAllowLocation}
            disabled={resolving}
            className="btn-primary btn-lg w-full"
          >
            {resolving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Finding you…
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" /> Allow Location
              </>
            )}
          </button>
          <button onClick={onEnterCity} className="btn-secondary btn-lg w-full">
            Enter a city instead
          </button>
        </div>
      )}

      <p className="helper-text mt-6 text-center text-xs">
        Only used for weather, never shared
      </p>
    </div>
  );
}
