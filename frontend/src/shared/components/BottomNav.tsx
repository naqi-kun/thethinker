import { NavLink } from 'react-router-dom';
import { Shirt, Sparkles, CalendarDays, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// The four primary destinations, mirroring design/thethinker-design.pen (frame
// v1JzHe). lucide has no coat-hanger/styler glyph, so Shirt + Sparkles stand in
// for the design's checkroom/styler icons.
const tabs: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/wardrobe', label: 'Wardrobe', Icon: Shirt },
  { to: '/outfit', label: 'Outfit', Icon: Sparkles },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/history', label: 'History', Icon: History },
];

// Floating tab bar pinned to the bottom of the viewport, mobile only — on md
// and up the Sidebar rail takes over (`md:hidden` here). `fixed` so it hovers
// over scrolling content (pages reserve bottom padding so nothing hides behind
// it).
export default function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-30 px-4 pb-4 pt-2 md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-border bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'bg-terracotta/10 font-semibold text-terracotta'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
