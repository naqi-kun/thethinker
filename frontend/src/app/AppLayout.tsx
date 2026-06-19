import { useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import AppHeader from '../shared/components/AppHeader';
import BottomNav from '../shared/components/BottomNav';
import LaundryReminderSheet from '../features/wardrobe/components/LaundryReminderSheet';
import { pageTransition } from '../shared/motion';

// App shell for the in-app (post-onboarding) pages: a viewport-height column of
// a header, a scrollable content region, and (on mobile) the floating bottom tab
// bar. On desktop the nav lives in the header; the content region owns the
// scroll so the header and bar stay put.
export default function AppLayout() {
  const location = useLocation();
  // `useOutlet()` (not `<Outlet />`) hands us the active route element so
  // AnimatePresence can keep the outgoing page mounted long enough to play its
  // exit animation before the new one fades in.
  const outlet = useOutlet();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll to the top on every navigation — the scroll container persists
  // across route changes, so without this a new page can mount mid-scroll and
  // the fade-in looks broken.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-screen-safe flex-col bg-background">
      <AppHeader />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            // Pass the scroll region's full height through to the page so
            // height-driven layouts (e.g. OutfitPage's `h-full` flat-lay canvas)
            // still resolve. Without this the wrapper collapses to content
            // height and the canvas gets zero height. Scrollable pages overflow
            // this box normally, so the scroll container still scrolls.
            className="h-full"
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav />
      <LaundryReminderSheet />
    </div>
  );
}
