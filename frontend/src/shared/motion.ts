import type { Variants } from 'motion/react';

// Shared motion presets so entrance animations feel the same across screens.

// Material standard easing curve.
export const ease = [0.4, 0, 0.2, 1] as [number, number, number, number];

// Parent container: reveals children one after another.
// Pair with `initial="hidden" animate="visible"` on the list/grid wrapper.
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

// Child entrance: fade in while rising slightly. Apply to each item via
// `variants={fadeUpItem}` (it inherits hidden/visible from the container).
export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease } },
};
