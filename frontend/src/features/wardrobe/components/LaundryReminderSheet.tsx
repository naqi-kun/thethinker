/**
 * LaundryReminderSheet
 *
 * Appears once per day, after 6 PM, whenever the user has worn items that
 * haven't been sent to the laundry basket yet. Lets the user select which worn
 * items to move to in_laundry, then routes to the laundry basket to finish up.
 *
 * Dismiss state is persisted in localStorage so the sheet only surfaces once
 * per calendar day even if the user navigates between pages.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCircle2, Circle, Shirt, X } from 'lucide-react';
import { listItems, updateItemStatus } from '../api';
import type { ClothingItem } from '../../../shared/api/types';

// ── helpers ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'thethinker_laundry_reminder_dismissed';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isDismissedToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayKey();
  } catch {
    return false;
  }
}

function dismissToday(): void {
  try {
    localStorage.setItem(STORAGE_KEY, todayKey());
  } catch {
    // ignore — private-browsing environments may block writes
  }
}

/** Returns true between 18:00 and 23:59 local time. */
function isEvening(): boolean {
  const h = new Date().getHours();
  return h >= 18 && h < 24;
}

function displayNameFor(item: ClothingItem): string {
  const name = item.name?.trim();
  if (name) return name;
  const color = item.color.charAt(0).toUpperCase() + item.color.slice(1);
  return `${color} ${item.sub_type}`;
}

// ── component ──────────────────────────────────────────────────────────────────

export default function LaundryReminderSheet() {
  const navigate = useNavigate();
  const [wornItems, setWornItems] = useState<ClothingItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip immediately if already dismissed today or outside evening window.
    if (isDismissedToday() || !isEvening()) return;

    // Short delay so the reminder never fights page load animations.
    delayTimer.current = setTimeout(() => {
      listItems().then((items) => {
        const worn = items.filter((i) => i.status === 'worn');
        if (worn.length === 0) return;
        setWornItems(worn);
        setSelected(new Set(worn.map((i) => i.id))); // pre-select all
        setVisible(true);
      });
    }, 1500);

    return () => {
      if (delayTimer.current) clearTimeout(delayTimer.current);
    };
  }, []);

  function dismiss() {
    dismissToday();
    setVisible(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSendToLaundry() {
    const toMove = wornItems.filter((i) => selected.has(i.id));
    if (!toMove.length) {
      dismiss();
      return;
    }
    setSaving(true);
    try {
      await Promise.all(toMove.map((i) => updateItemStatus(i.id, 'in_laundry')));
      dismissToday();
      setVisible(false);
      navigate('/wardrobe/laundry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-espresso/10 backdrop-blur-[2px]"
            onClick={dismiss}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-background safe-area-bottom"
          >
            <div className="container-app space-y-4 py-5">
              {/* Handle */}
              <div className="mx-auto h-1 w-10 rounded-full bg-border" />

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-warning/15">
                    <Bell className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      9PM Check-in
                    </p>
                    <h5 className="leading-snug text-foreground">Anything to wash?</h5>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-secondary"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Info card */}
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  You wore{' '}
                  <span className="font-semibold text-foreground">
                    {wornItems.length} item{wornItems.length !== 1 ? 's' : ''}
                  </span>{' '}
                  today. Select what's going into the laundry and we'll track it for
                  you.
                </p>
              </div>

              {/* Worn item checklist */}
              <div className="max-h-52 space-y-2 overflow-y-auto">
                {wornItems.map((item) => {
                  const isChecked = selected.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99] ${
                        isChecked
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      }`}
                    >
                      {isChecked ? (
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 flex-shrink-0 text-muted-foreground/40" />
                      )}
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-linen">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={displayNameFor(item)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Shirt className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {displayNameFor(item)}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.color}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selection count badge */}
              {selected.size > 0 && (
                <div className="flex justify-center">
                  <span className="badge-dirty text-xs">
                    {selected.size} selected — move to basket
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pb-2">
                <button onClick={dismiss} className="btn-secondary btn-md flex-1">
                  Dismiss for today
                </button>
                <button
                  onClick={() => void handleSendToLaundry()}
                  disabled={selected.size === 0 || saving}
                  className="btn-primary btn-md flex-1"
                >
                  {saving ? 'Sending…' : 'Put selected in laundry'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
