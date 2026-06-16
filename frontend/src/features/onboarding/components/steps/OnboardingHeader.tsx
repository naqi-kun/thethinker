import { ArrowLeft } from 'lucide-react';

// Shared chrome for the two "quick setup" steps (Aesthetic, Location). Welcome
// and Done are intro/outro screens and don't show a step counter, matching the
// design (steps are counted 1..2).
export default function OnboardingHeader({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack: () => void;
}) {
  const progress = (step / total) * 100;
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-serif text-xl text-terracotta">TheThinker</span>
        <div className="w-9" />
      </div>
      <div className="progress-bar mb-2">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="helper-text">Quick setup</span>
        <span className="text-xs font-semibold text-primary">
          Step {step} of {total}
        </span>
      </div>
    </div>
  );
}
