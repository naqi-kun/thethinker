import { Link, NavLink } from 'react-router-dom';
import { Settings } from 'lucide-react';

const navItems = [
  { to: '/wardrobe', label: 'Wardrobe' },
  { to: '/outfit', label: 'Outfit' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/history', label: 'History' },
];

// App header (design frame eZQ1M): wordmark, the primary nav, and a settings
// gear. The nav links show on desktop (md+); on mobile the BottomNav takes over
// and the header stays slim (wordmark + gear). Sign-out lives inside Settings.
export default function AppHeader() {
  return (
    <header className="z-20 shrink-0 border-b border-border bg-background">
      <div className="mx-auto flex max-w-xl items-center justify-between px-6 py-3">
        <Link
          to="/"
          className="font-serif text-xl font-medium text-espresso hover:text-rust"
        >
          TheThinker
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm md:flex">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `pb-1 font-sans transition-colors ${
                  isActive
                    ? 'border-b-2 border-terracotta font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/settings"
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-rust transition-colors hover:bg-secondary"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
