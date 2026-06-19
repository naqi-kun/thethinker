import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  GripVertical,
  RotateCcw,
  Shirt,
  ShoppingBag,
  X,
} from 'lucide-react';
import { listItems, updateItemStatus } from '../api';
import type { ClothingItem, ClothingStatus } from '../../../shared/api/types';

function displayNameFor(item: ClothingItem): string {
  return item.name?.trim() || `${capitalize(item.color)} ${item.sub_type}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LAUNDERING_STATUSES: ClothingStatus[] = ['in_laundry'];

function statusLabel(status: ClothingStatus): string {
  if (status === 'in_laundry') return 'In Laundry';
  return status;
}

// ── Item thumbnail helper ──────────────────────────────────────────────────────

function ItemThumb({ item, size = 'md' }: { item: ClothingItem; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  const iconDim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <div className={`${dim} flex-shrink-0 overflow-hidden rounded-lg bg-linen`}>
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={displayNameFor(item)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Shirt className={`${iconDim} text-muted-foreground`} />
        </div>
      )}
    </div>
  );
}

// ── LaundryPage ────────────────────────────────────────────────────────────────

export default function LaundryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wornItems, setWornItems] = useState<ClothingItem[]>([]);
  const [basketItems, setBasketItems] = useState<ClothingItem[]>([]);

  // Desktop drag-and-drop
  const [dragOverBasket, setDragOverBasket] = useState(false);
  const [dragOverWorn, setDragOverWorn] = useState(false);
  const draggingId = useRef<string | null>(null);
  const draggingFrom = useRef<'worn' | 'basket' | null>(null);

  // Mobile long-press selection
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  const [selectedForBasket, setSelectedForBasket] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-item saving indicator
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Done washing bottom sheet
  const [showDoneSheet, setShowDoneSheet] = useState(false);
  const [selectedForClean, setSelectedForClean] = useState<Set<string>>(new Set());
  const [markingClean, setMarkingClean] = useState(false);

  // Undo toast
  const [undoToast, setUndoToast] = useState<{ items: ClothingItem[] } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listItems()
      .then((items) => {
        setWornItems(items.filter((i) => i.status === 'worn'));
        setBasketItems(
          items.filter((i) => LAUNDERING_STATUSES.includes(i.status as ClothingStatus)),
        );
      })
      .finally(() => setLoading(false));

    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  // ── Basket actions ─────────────────────────────────────────────────────────

  async function moveToBasket(item: ClothingItem) {
    if (savingIds.has(item.id)) return;
    setSavingIds((prev) => new Set([...prev, item.id]));
    try {
      const updated = await updateItemStatus(item.id, 'in_laundry');
      setWornItems((prev) => prev.filter((i) => i.id !== item.id));
      setBasketItems((prev) => [...prev, updated]);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  // Move a laundering item back out to the "still worn" list.
  async function moveToWorn(item: ClothingItem) {
    if (savingIds.has(item.id)) return;
    setSavingIds((prev) => new Set([...prev, item.id]));
    try {
      const updated = await updateItemStatus(item.id, 'worn');
      setBasketItems((prev) => prev.filter((i) => i.id !== item.id));
      setWornItems((prev) => [...prev, updated]);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  // Put a worn item straight back into the wardrobe as clean — e.g. shoes that
  // were worn but don't need a wash cycle. It leaves the laundry flow entirely.
  async function moveToClean(item: ClothingItem) {
    if (savingIds.has(item.id)) return;
    setSavingIds((prev) => new Set([...prev, item.id]));
    try {
      await updateItemStatus(item.id, 'clean');
      setWornItems((prev) => prev.filter((i) => i.id !== item.id));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  // ── Desktop drag ───────────────────────────────────────────────────────────

  function handleDragStart(itemId: string, from: 'worn' | 'basket') {
    draggingId.current = itemId;
    draggingFrom.current = from;
  }

  function handleDragEnd() {
    draggingId.current = null;
    draggingFrom.current = null;
    setDragOverBasket(false);
    setDragOverWorn(false);
  }

  // Drop onto the basket zone: only worn items move in.
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = draggingId.current;
    if (id && draggingFrom.current === 'worn') {
      const item = wornItems.find((i) => i.id === id);
      if (item) void moveToBasket(item);
    }
    setDragOverBasket(false);
    draggingId.current = null;
    draggingFrom.current = null;
  }

  // Drop onto the worn list: only basket items move back out.
  function handleDropWorn(e: React.DragEvent) {
    e.preventDefault();
    const id = draggingId.current;
    if (id && draggingFrom.current === 'basket') {
      const item = basketItems.find((i) => i.id === id);
      if (item) void moveToWorn(item);
    }
    setDragOverWorn(false);
    draggingId.current = null;
    draggingFrom.current = null;
  }

  // ── Mobile long-press ──────────────────────────────────────────────────────

  function handleTouchStart(item: ClothingItem) {
    longPressTimer.current = setTimeout(() => {
      setMobileSelectMode(true);
      setSelectedForBasket((prev) => new Set([...prev, item.id]));
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function toggleMobileSelect(id: string) {
    setSelectedForBasket((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelectedToBasket() {
    const toMove = wornItems.filter((i) => selectedForBasket.has(i.id));
    for (const item of toMove) {
      await moveToBasket(item);
    }
    setSelectedForBasket(new Set());
    setMobileSelectMode(false);
  }

  function cancelMobileSelect() {
    setMobileSelectMode(false);
    setSelectedForBasket(new Set());
  }

  // ── Done washing ──────────────────────────────────────────────────────────

  function openDoneSheet() {
    setSelectedForClean(new Set(basketItems.map((i) => i.id)));
    setShowDoneSheet(true);
  }

  function toggleCleanSelect(id: string) {
    setSelectedForClean((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function markSelectedClean() {
    const toClean = basketItems.filter((i) => selectedForClean.has(i.id));
    if (!toClean.length) return;
    setMarkingClean(true);
    try {
      await Promise.all(toClean.map((i) => updateItemStatus(i.id, 'clean')));
      const cleanedIds = new Set(toClean.map((i) => i.id));
      setBasketItems((prev) => prev.filter((i) => !cleanedIds.has(i.id)));
      setSelectedForClean(new Set());
      setShowDoneSheet(false);

      // Show undo toast
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndoToast({ items: toClean });
      undoTimer.current = setTimeout(() => setUndoToast(null), 4000);
    } finally {
      setMarkingClean(false);
    }
  }

  async function undoMarkClean() {
    if (!undoToast) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const items = undoToast.items;
    setUndoToast(null);
    try {
      const reverted = await Promise.all(
        items.map((i) => updateItemStatus(i.id, 'in_laundry')),
      );
      setBasketItems((prev) => [...prev, ...reverted]);
    } catch {
      // silently ignore; items are gone from UI but backend retained clean status
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const staysInBasket = basketItems.length - selectedForClean.size;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen-safe bg-background">
        <div className="container-app py-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-full bg-linen" />
            <div className="space-y-1.5">
              <div className="h-2 w-12 animate-pulse rounded bg-linen" />
              <div className="h-6 w-24 animate-pulse rounded bg-linen" />
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-2 h-20 animate-pulse rounded-xl bg-linen" />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = basketItems.length === 0 && wornItems.length === 0;

  return (
    <div className="min-h-screen-safe bg-background">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container-app flex items-center gap-3 py-4">
          <button
            onClick={() => navigate('/wardrobe')}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Laundry
            </p>
            <h5 className="leading-none text-foreground">Basket</h5>
          </div>
          {basketItems.length > 0 && (
            <span className="badge-dirty relative px-3 py-1 text-xs">
              {basketItems.length} in basket
            </span>
          )}
        </div>
      </div>

      <div className="container-app space-y-6 py-6 pb-36">
        {/* ── Empty state ── */}
        {isEmpty && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">All clean!</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No worn items right now. Your wardrobe is fresh and ready.
            </p>
            <button
              onClick={() => navigate('/wardrobe')}
              className="btn-secondary btn-sm mt-2"
            >
              Back to wardrobe
            </button>
          </div>
        )}

        {/* ── The basket (also the drop target for worn items) ── */}
        {(basketItems.length > 0 || wornItems.length > 0) && (
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              In the basket
            </p>
            {basketItems.length > 0 && (
              <p className="mb-3 text-xs text-muted-foreground">
                Drag an item back out, or tap the arrow to keep wearing it.
              </p>
            )}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverBasket(true);
              }}
              onDragLeave={() => setDragOverBasket(false)}
              onDrop={handleDrop}
              className={`space-y-2 rounded-2xl border-2 border-dashed p-3 transition-all duration-150 ${
                dragOverBasket
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background'
              }`}
            >
              <AnimatePresence initial={false}>
                {basketItems.map((item) => {
                  const isSaving = savingIds.has(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: isSaving ? 0.5 : 1, y: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.18 }}
                      draggable={!isSaving}
                      onDragStart={() => handleDragStart(item.id, 'basket')}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all ${
                        isSaving
                          ? 'pointer-events-none'
                          : 'cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
                      <ItemThumb item={item} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {displayNameFor(item)}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.color}</p>
                      </div>
                      <span className="badge-default shrink-0 px-2 py-0.5 text-[10px]">
                        {isSaving
                          ? 'Moving…'
                          : statusLabel(item.status as ClothingStatus)}
                      </span>
                      <button
                        onClick={() => void moveToWorn(item)}
                        disabled={isSaving}
                        aria-label="Move back to worn"
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Drag-in prompt, inside the basket. Shown whenever there are
                  worn items to add; sits below anything already in the basket. */}
              {wornItems.length > 0 && (
                <div
                  className={`flex flex-col items-center gap-1 text-center ${
                    basketItems.length > 0
                      ? 'mt-1 border-t border-dashed border-border pt-3'
                      : 'py-6'
                  }`}
                >
                  <ShoppingBag
                    className={`h-7 w-7 transition-colors ${dragOverBasket ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <p
                    className={`text-sm font-medium transition-colors ${dragOverBasket ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    Drag worn items here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or tap an item below to add it
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Still worn ── */}
        {wornItems.length > 0 && (
          <section
            onDragOver={(e) => {
              if (draggingFrom.current === 'basket') {
                e.preventDefault();
                setDragOverWorn(true);
              }
            }}
            onDragLeave={() => setDragOverWorn(false)}
            onDrop={handleDropWorn}
            className={`rounded-2xl transition-all duration-150 ${
              dragOverWorn ? 'bg-primary/5 ring-2 ring-dashed ring-primary' : ''
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Still worn, still available
              </p>
              {mobileSelectMode && selectedForBasket.size > 0 && (
                <button
                  onClick={() => void addSelectedToBasket()}
                  className="btn-primary btn-sm text-xs"
                >
                  Add {selectedForBasket.size} to basket
                </button>
              )}
            </div>

            {!mobileSelectMode && (
              <p className="mb-3 text-xs text-muted-foreground">
                Tap to add to basket, or drag. Tap ✓ to put a piece back without
                washing. Long-press to multi-select on mobile.
              </p>
            )}

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {wornItems.map((item) => {
                  const isSelected = selectedForBasket.has(item.id);
                  const isSaving = savingIds.has(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: isSaving ? 0.5 : 1, y: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: 0.18 }}
                      draggable={!mobileSelectMode && !isSaving}
                      onDragStart={() => handleDragStart(item.id, 'worn')}
                      onDragEnd={handleDragEnd}
                      onTouchStart={() => handleTouchStart(item)}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                      onClick={() => {
                        if (isSaving) return;
                        if (mobileSelectMode) {
                          toggleMobileSelect(item.id);
                        } else {
                          void moveToBasket(item);
                        }
                      }}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all active:scale-[0.99] ${
                        isSelected && mobileSelectMode
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40'
                      } ${isSaving ? 'pointer-events-none' : ''}`}
                    >
                      {mobileSelectMode ? (
                        isSelected ? (
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 flex-shrink-0 text-muted-foreground/40" />
                        )
                      ) : (
                        <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
                      )}
                      <ItemThumb item={item} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {displayNameFor(item)}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.color}</p>
                      </div>
                      <span className="badge-dirty shrink-0 px-2 py-0.5 text-[10px]">
                        {isSaving ? 'Moving…' : 'Worn'}
                      </span>
                      {!mobileSelectMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void moveToClean(item);
                          }}
                          disabled={isSaving}
                          aria-label="Put back in wardrobe without washing"
                          title="Won't wash — put back in wardrobe"
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {mobileSelectMode && (
              <button
                onClick={cancelMobileSelect}
                className="mt-3 w-full text-sm text-muted-foreground"
              >
                Cancel selection
              </button>
            )}
          </section>
        )}
      </div>

      {/* ── Sticky bottom CTAs ── */}
      {!isEmpty && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm safe-area-bottom">
          <div className="container-app flex gap-3 py-4">
            {basketItems.length > 0 && (
              <button onClick={openDoneSheet} className="btn-primary btn-md flex-1">
                All done washing?
              </button>
            )}
            <button
              onClick={() => navigate('/wardrobe')}
              className={`btn-secondary btn-md ${basketItems.length === 0 ? 'flex-1' : ''}`}
            >
              {basketItems.length > 0 ? 'Add more' : 'Back to wardrobe'}
            </button>
          </div>
        </div>
      )}

      {/* ── Done washing bottom sheet ── */}
      <AnimatePresence>
        {showDoneSheet && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-espresso/10 backdrop-blur-[2px]"
              onClick={() => setShowDoneSheet(false)}
            />

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

                {/* Title */}
                <div className="flex items-center justify-between">
                  <h5 className="text-foreground">Select clean items</h5>
                  <button
                    onClick={() => setShowDoneSheet(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-secondary"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Checklist */}
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {basketItems.map((item) => {
                    const isChecked = selectedForClean.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleCleanSelect(item.id)}
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
                        <ItemThumb item={item} size="sm" />
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

                {/* Selection summary badge */}
                {selectedForClean.size > 0 && (
                  <div className="flex justify-center">
                    <span className="badge-primary text-xs">
                      {selectedForClean.size} selected
                      {staysInBasket > 0
                        ? ` · ${staysInBasket} stay${staysInBasket !== 1 ? 's' : ''} in basket`
                        : ''}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pb-2">
                  <button
                    onClick={() => setShowDoneSheet(false)}
                    className="btn-secondary btn-md flex-1"
                  >
                    Not yet
                  </button>
                  <button
                    onClick={() => void markSelectedClean()}
                    disabled={selectedForClean.size === 0 || markingClean}
                    className="btn-primary btn-md flex-1"
                  >
                    {markingClean ? 'Marking…' : 'Mark selected clean'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Undo toast ── */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            key="undo-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-0 right-0 z-60 flex justify-center px-4"
          >
            <div className="flex items-center gap-3 rounded-full border border-border bg-foreground px-4 py-2.5 shadow-lg">
              <p className="text-sm font-medium text-primary-foreground">
                {undoToast.items.length === 1
                  ? `${displayNameFor(undoToast.items[0])} marked clean`
                  : `${undoToast.items.length} items marked clean`}
              </p>
              <button
                onClick={() => void undoMarkClean()}
                className="text-sm font-semibold text-warning underline-offset-2 hover:underline"
              >
                Undo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
