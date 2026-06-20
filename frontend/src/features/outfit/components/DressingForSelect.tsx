import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { ease } from '../../../shared/motion';

export type DressingForOption = { value: string; label: string };

type Props = {
  value: string;
  options: DressingForOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * A polished listbox for the "Dressing for" control. Replaces the native
 * <select> so the open/close can animate and the menu matches the editorial
 * theme (pill trigger, soft popover, terracotta check on the active option).
 * Closes on outside click or Escape; the trigger stays keyboard-focusable.
 */
export default function DressingForSelect({
  value,
  options,
  onChange,
  disabled,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // A disabled control can't keep a menu open (e.g. a refresh kicks off mid-pick).
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium text-foreground transition-all duration-200 hover:border-terracotta/60 hover:bg-linen/60 hover:text-espresso hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-card disabled:hover:shadow-none ${
          open ? 'border-terracotta/60 bg-linen/60 text-espresso' : 'border-border bg-card'
        }`}
      >
        <span className="max-w-[12rem] truncate">{selected?.label ?? 'Select…'}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -6, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -6, scale: 0.96 }
            }
            transition={{ duration: 0.16, ease }}
            style={{ transformOrigin: 'top center' }}
            className="absolute left-1/2 top-full z-40 mt-2 max-h-64 w-max min-w-[13rem] max-w-[17rem] -translate-x-1/2 overflow-auto rounded-2xl border border-border bg-card p-1.5 shadow-lg"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-linen font-semibold text-espresso'
                        : 'text-foreground hover:bg-linen/60'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-terracotta" />
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
