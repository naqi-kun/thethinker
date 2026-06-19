import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Aesthetic } from '../../../shared/aesthetics';
import { buildPreferences, savePreferences, EMPTY_ANSWERS } from '../api';
import type { OnboardingAnswers } from '../api';
import { getDeviceLocation, reverseGeocode } from '../geocode';
import WelcomeStep from './steps/WelcomeStep';
import AestheticStep from './steps/AestheticStep';
import LocationStep from './steps/LocationStep';
import DoneStep from './steps/DoneStep';

// 4-screen flow (Welcome → Aesthetic → Location → Done) that asks only what the
// recommender consumes: aesthetic (shared taxonomy, KAN-92) and city for weather.
type Step = 'welcome' | 'aesthetic' | 'location' | 'done';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);

  // Location step UI state
  const [resolving, setResolving] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function go(to: Step) {
    setStep(to);
  }

  function setAesthetic(aesthetic: Aesthetic) {
    setAnswers((a) => ({ ...a, aesthetic }));
  }

  function setLocation(location: string) {
    setAnswers((a) => ({ ...a, location }));
  }

  // Persist aesthetic + location, then reveal the "all set" screen. On failure
  // we stay on the Location step with an error and keep the user's input — the
  // old flow swallowed this error and navigated away regardless (KAN-94 bug).
  // Persist aesthetic + location, then reveal the "all set" screen. On failure
  // we stay on the Location step with an error and keep the user's input — the
  // old flow swallowed this error and navigated away regardless (KAN-94 bug).
  async function persistAndFinish(next: OnboardingAnswers) {
    try {
      await savePreferences(buildPreferences(next));
      setLocationError(null);
      go('done');
    } catch {
      setLocationError('Could not save your preferences. Please try again.');
    }
  }

  async function handleAllowLocation() {
    setResolving(true);
    setLocationError(null);
    try {
      const { lat, lon } = await getDeviceLocation();
      const city = await reverseGeocode(lat, lon);
      const next = { ...answers, location: city };
      setAnswers(next);
      await persistAndFinish(next);
    } catch {
      // Denied, timed out, or geocode failed — fall back to manual entry.
      setManualMode(true);
      setLocationError("We couldn't detect your location. Enter a city instead.");
    } finally {
      setResolving(false);
    }
  }

  switch (step) {
    case 'welcome':
      return (
        <div className="flex min-h-screen-safe justify-center bg-background">
          <WelcomeStep onStart={() => go('aesthetic')} />
        </div>
      );
    case 'aesthetic':
      return (
        <div className="flex min-h-screen-safe justify-center bg-background">
          <AestheticStep
            value={answers.aesthetic}
            onChange={setAesthetic}
            onContinue={() => go('location')}
            onSkip={() => go('location')}
            onBack={() => go('welcome')}
          />
        </div>
      );
    case 'location':
      return (
        <div className="flex min-h-screen-safe justify-center bg-background">
          <LocationStep
            value={answers.location}
            onChange={setLocation}
            onAllowLocation={handleAllowLocation}
            resolving={resolving}
            error={locationError}
            manualMode={manualMode}
            onEnterCity={() => setManualMode(true)}
            onSwitchToAuto={() => { setManualMode(false); setLocationError(null); }}
            onContinue={() => persistAndFinish(answers)}
            onSkip={() => persistAndFinish({ ...answers, location: '' })}
            onBack={() => go('aesthetic')}
          />
        </div>
      );
    case 'done':
      return (
        <div className="flex min-h-screen-safe justify-center bg-background">
          <DoneStep
            city={answers.location}
            onChangeCity={() => go('location')}
            onAddClothes={() => navigate('/wardrobe/add')}
            onLater={() => navigate('/wardrobe')}
          />
        </div>
      );
  }
}
