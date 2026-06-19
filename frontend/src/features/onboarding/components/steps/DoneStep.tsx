import { Check, Plus } from 'lucide-react';

// Onboarding 4 · Done — preferences are already saved by the time we land here
// (persisted on the Location→Done transition), so this screen only routes the
// user into filling their wardrobe.
export default function DoneStep({
  onAddClothes,
  onLater,
}: {
  onAddClothes: () => void;
  onLater: () => void;
}) {
  return (
    <div className="flex min-h-screen-safe w-full max-w-md flex-col items-center px-6 py-10 text-center">
      <div className="mb-8 mt-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-10 w-10" />
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Scan · Schedule · Style
      </p>
      <h2 className="mb-3">You're all set.</h2>
      <p className="helper-text mb-auto max-w-xs">
        Now let's fill your closet so TheThinker can style you — adding a few pieces
        only takes a minute.
      </p>

      <div className="mt-8 flex w-full flex-col items-center gap-3">
        <button onClick={onAddClothes} className="btn-primary btn-lg w-full">
          <Plus className="h-4 w-4" /> Add My Clothes
        </button>
        <button onClick={onLater} className="btn-link btn-sm">
          I'll do this later
        </button>
      </div>
    </div>
  );
}
