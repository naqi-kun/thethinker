import { useRef, useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { User, Settings, LogOut } from 'lucide-react';
import { token } from '../api/token';

const navItems = [
  { to: '/wardrobe', label: 'Wardrobe' },
  { to: '/outfit', label: 'Outfit' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/history', label: 'History' },
];

export default function TopNav() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link
          to="/"
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

        {/* Profile button + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            aria-label="Account menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-rust text-cream transition-opacity hover:opacity-90"
          >
            <User className="h-4 w-4" />
          </button>

          {open && (
            <div className="absolute right-0 top-11 z-30 min-w-[176px] overflow-hidden rounded-xl border border-border bg-background shadow-lg">
              <button
                onClick={() => go('/settings')}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-foreground hover:bg-secondary"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Account settings
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => {
                  token.clear();
                  go('/');
                }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-foreground hover:bg-secondary"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
