import { MapPin, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import OnboardingHeader from './OnboardingHeader';
import { searchCities } from '../../geocode';

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
  onSwitchToAuto,
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
  onSwitchToAuto: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!manualMode || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    searchCities(value).then((results) => {
      if (!cancelled) setSuggestions(results);
    });
    return () => { cancelled = true; };
  }, [value, manualMode]);

  function selectSuggestion(city: string) {
    onChange(city);
    setSuggestions([]);
  }

  return (
    <div className="flex min-h-screen-safe w-full max-w-md flex-col px-6 py-10">
      <OnboardingHeader step={2} total={2} onBack={onBack} />

      <h2 className="mb-2">Where are you based?</h2>
      <p className="helper-text mb-8">
        We use your location to pick outfits for the day's weather. That's the only
        thing it's used for.
      </p>

      {/* The card is the primary location action in both modes. */}
      <button
        type="button"
        onClick={manualMode ? onSwitchToAuto : onAllowLocation}
        disabled={resolving}
        className="mb-8 flex w-full flex-col items-center gap-3 rounded-xl bg-card px-6 py-10 text-center transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {resolving ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <MapPin className="h-6 w-6" />
          )}
        </div>
        <p className="helper-text max-w-[14rem]">
          {resolving
            ? 'Finding your location…'
            : manualMode
              ? 'Tap to use automatic location instead'
              : 'Tap to allow location access'}
        </p>
      </button>

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
            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-border bg-card shadow-md">
                {suggestions.map((city) => (
                  <li key={city}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSuggestion(city);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {city}
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
        <button onClick={onEnterCity} className="btn-secondary btn-lg w-full">
          Enter a city instead
        </button>
      )}

      <p className="helper-text mt-6 text-center text-xs">
        Only used for weather, never shared
      </p>
    </div>
  );
}
