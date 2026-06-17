// Motion constants for the daily outfit reveal ceremony (KAN-100). Reuses the
// app's existing flat-lay spring + stagger so the reveal feels native.
import { ease } from '../../shared/motion';

// ~70ms between garments, per the design storyboard ("like laying clothes out
// on a table, not a confetti burst").
export const SETTLE_STAGGER_S = 0.07;

// Same gentle spring used by the shared FlatLay tile entrance.
export const settleSpring = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 30,
  mass: 0.85,
};

// How long the seal bloom plays before the flat-lay takes over. Drives both the
// seal animation and the phase switch, so the reveal can't hinge on an
// animation callback that jsdom never fires.
export const BLOOM_MS = 450;

export { ease };
