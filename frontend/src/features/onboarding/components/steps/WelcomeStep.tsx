import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import BrandLogo from '../../../../shared/components/BrandLogo';
import { staggerContainer, fadeUpItem } from '../../../../shared/motion';

// Onboarding 1 · Welcome — intro screen shown right after registration.
const HERO_IMG = 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&q=80';

export default function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      className="flex min-h-screen-safe w-full max-w-md flex-col px-6 py-10"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeUpItem}>
        <BrandLogo className="mx-auto mb-8 w-44" />
      </motion.div>

      <motion.div
        variants={fadeUpItem}
        className="mb-8 aspect-4/5 w-full overflow-hidden rounded-xl bg-card shadow-sm"
      >
        <img
          src={HERO_IMG}
          alt="A flat-lay of neatly arranged clothing"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </motion.div>

      <motion.h1 variants={fadeUpItem} className="mb-3 text-center">
        Your closet, styled daily.
      </motion.h1>
      <motion.p variants={fadeUpItem} className="helper-text mb-auto text-center">
        Scan your wardrobe, sync your calendar, and get one outfit picked for your day —
        every morning.
      </motion.p>

      <motion.div variants={fadeUpItem} className="space-y-3">
        <motion.button
          onClick={onStart}
          whileTap={{ scale: 0.97 }}
          className="btn-primary btn-lg w-full"
        >
          Get Started <ArrowRight className="h-4 w-4" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
