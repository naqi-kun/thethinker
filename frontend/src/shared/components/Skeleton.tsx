import { cn } from '../utils/cn';

/**
 * Skeleton loading placeholder — a pulsing block in the muted/linen tone.
 * Compose page-shaped loaders by sizing/rounding via `className`
 * (e.g. <Skeleton className="aspect-[4/5] rounded-2xl" />).
 *
 * Decorative only: hidden from the accessibility tree. Pair the loading
 * region with an aria-busy / sr-only "Loading…" label where it matters.
 */
export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-linen', className)}
    />
  );
}
