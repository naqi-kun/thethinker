import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shirt, Sparkles, CalendarDays, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { listItems, WARDROBE_STATUS_EVENT } from '../../features/wardrobe/api';
import type { ClothingStatus } from '../api/types';

// The four primary destinations, mirroring design/thethinker-design.pen (frame
// v1JzHe). lucide has no coat-hanger/styler glyph, so Shirt + Sparkles stand in
// for the design's checkroom/styler icons.
const tabs: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/wardrobe', label: 'Wardrobe', Icon: Shirt },
  { to: '/outfit', label: 'Outfit', Icon: Sparkles },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/history', label: 'History', Icon: History },
];

const LAUNDERING_STATUSES: ClothingStatus[] = ['in_laundry'];

// Floating tab bar pinned to the bottom of the viewport, mobile only — on md
// and up the Sidebar rail takes over (`md:hidden` here). `fixed` so it hovers
// over scrolling content (pages reserve bottom padding so nothing hides behind
// it).
export default function BottomNav() {
  const location = useLocation();
  // Live count of items currently in the laundry basket (in_laundry),
  // surfaced as a badge on the Wardrobe tab.
  const [basketCount, setBasketCount] = useState(0);

  const refreshCount = useCallback(() => {
    listItems()
      .then((items) =>
        setBasketCount(
          items.filter((i) => LAUNDERING_STATUSES.includes(i.status as ClothingStatus))
            .length,
        ),
      )
      .catch(() => {
        /* non-critical badge — ignore transient failures */
      });
  }, []);

  // Refresh on mount, whenever a status change is broadcast, and on navigation
  // (covers status changes that happen on screens we don't directly observe).
  useEffect(() => {
    refreshCount();
    window.addEventListener(WARDROBE_STATUS_EVENT, refreshCount);
    return () => window.removeEventListener(WARDROBE_STATUS_EVENT, refreshCount);
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [location.pathname, refreshCount]);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 px-4 pt-2 md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-border bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
        {tabs.map(({ to, label, Icon }) => {
          const showBadge = to === '/wardrobe' && basketCount > 0;
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'font-semibold text-terracotta'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottomNavPill"
                      className="absolute inset-0 rounded-full bg-terracotta/10"
                      transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                    />
                  )}
                  <span className="relative">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {showBadge && (
                      <span
                        aria-label={`${basketCount} item${basketCount !== 1 ? 's' : ''} in laundry basket`}
                        className="badge-dirty absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none"
                      >
                        {basketCount > 9 ? '9+' : basketCount}
                      </span>
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
