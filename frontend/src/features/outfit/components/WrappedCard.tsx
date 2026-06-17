import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { BLOOM_MS, ease } from '../revealMotion';

interface WrappedCardProps {
  /** The outfit is still being curated; the Reveal CTA stays disabled. */
  loading: boolean;
  /** Skip the bloom animation and reveal immediately. */
  prefersReducedMotion: boolean;
  /** Called once the seal has bloomed (or immediately under reduced motion). */
  onReveal: () => void;
}

// First open of the day: a sealed wrapper the user taps to unwrap today's look.
// On tap the seal blooms with a soft sparkle and dissolves, then the parent
// switches to the revealed flat-lay (KAN-100).
export default function WrappedCard({
  loading,
  prefersReducedMotion,
  onReveal,
}: WrappedCardProps) {
  const [blooming, setBlooming] = useState(false);

  function handleTap() {
    if (loading || blooming) return;
    if (prefersReducedMotion) {
      onReveal();
      return;
    }
    setBlooming(true);
    // Drive the phase switch off a timer rather than onAnimationComplete so the
    // reveal is deterministic (and testable in jsdom).
    window.setTimeout(onReveal, BLOOM_MS);
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-sand bg-linen p-8 text-center">
        {/* Seal — gently breathes while sealed, blooms outward on reveal. */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          {blooming && (
            <motion.span
              className="absolute inset-0 rounded-full border border-terracotta"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: BLOOM_MS / 1000, ease }}
            />
          )}
          <motion.div
            className="flex h-20 w-20 items-center justify-center rounded-full bg-terracotta text-cream"
            animate={blooming ? { scale: 1.9, opacity: 0 } : { scale: [1, 1.06, 1] }}
            transition={
              blooming
                ? { duration: BLOOM_MS / 1000, ease }
                : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <Sparkles className="h-8 w-8" />
          </motion.div>
        </div>

        <motion.div
          className="flex flex-col items-center gap-2"
          animate={blooming ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease }}
        >
          <h3 className="font-serif text-2xl text-espresso">Your look is ready</h3>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Curating today’s edit…'
              : 'Tap to unwrap the outfit we styled for your day.'}
          </p>
        </motion.div>

        <motion.button
          onClick={handleTap}
          disabled={loading || blooming}
          className="btn-primary btn-lg gap-2 disabled:cursor-not-allowed disabled:opacity-70"
          animate={blooming ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease }}
        >
          {loading ? 'Curating…' : 'Reveal'}
          <Sparkles className="h-5 w-5" />
        </motion.button>

        <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">
          A fresh edit every morning
        </p>
      </div>
    </div>
  );
}
