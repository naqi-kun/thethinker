import { NavLink, Link } from 'react-router-dom';
import { User } from 'lucide-react';

const navItems = [
  { to: '/wardrobe', label: 'Wardrobe' },
  { to: '/outfit', label: 'Outfit' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/settings', label: 'Settings' },
];

export default function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link
          to="/wardrobe"
          className="font-serif text-xl font-medium text-terracotta hover:text-rust"
        >
          TheThinker
        </Link>

        <nav className="flex items-center gap-6 text-sm">
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

        <button
          aria-label="Account"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-rust text-cream"
        >
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
