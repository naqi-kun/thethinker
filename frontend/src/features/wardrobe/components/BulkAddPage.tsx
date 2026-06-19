import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  Images,
  Lightbulb,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';
import { classifyItem, addItemWithImage } from '../api';
import { ApiError } from '../../../shared/api/client';
import { staggerContainer, fadeUpItem } from '../../../shared/motion';
import { colorLabel, COLOR_SWATCHES, SUB_TYPES, type ClothingColor } from '../options';
import {
  itemIsComplete,
  mapWithConcurrency,
  seedFields,
  toPayload,
  toUploadFile,
  type ScanFields,
  type ScanItem,
} from '../bulkAdd';
import EditItemSheet from './EditItemSheet';

type Phase = 'upload' | 'tagging' | 'review';

// How many classify / create requests to keep in flight at once.
const CONCURRENCY = 3;

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SUB_TYPES.map((o) => [o.value, o.label]),
);

function ColorChip({ color }: { color: ClothingColor | '' }) {
  if (!color) return null;
  const swatch = COLOR_SWATCHES[color];
  return (
    <span className="badge-outline flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
        style={
          swatch.startsWith('linear')
            ? { backgroundImage: swatch }
            : { backgroundColor: swatch }
        }
      />
      {colorLabel(color)}
    </span>
  );
}

export default function BulkAddPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('upload');
  const [items, setItems] = useState<ScanItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke every thumbnail object URL when the page unmounts.
  const itemsRef = useRef<ScanItem[]>([]);
  itemsRef.current = items;
  useEffect(() => {
    return () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url));
  }, []);

  // Identifies the active ingest batch. Starting a new batch supersedes any
  // still-classifying older one, so its late-arriving patches and final phase
  // flip are ignored (see ingestFiles).
  const batchRef = useRef(0);

  function patchItem(id: string, patch: Partial<ScanItem>) {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  // Turn picked files into scan items, then classify them in the background.
  async function ingestFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;

    const fresh: ScanItem[] = images.map((blob) => ({
      id: crypto.randomUUID(),
      blob,
      url: URL.createObjectURL(blob),
      status: 'processing',
      name: '',
      category: '',
      sub_type: '',
      color: '',
      fit: '',
      season: '',
    }));

    // This batch replaces whatever was on screen, so revoke the old thumbnails
    // and claim a fresh batch token before swapping in the new items.
    itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url));
    const batch = ++batchRef.current;

    setItems(fresh);
    setPhase('tagging');
    setError(null);

    await mapWithConcurrency(fresh, CONCURRENCY, async (item) => {
      try {
        const result = await classifyItem(item.blob);
        // A newer batch has taken over; this result no longer belongs on screen.
        if (batchRef.current !== batch) return;
        patchItem(item.id, {
          status: 'done',
          confidence: result.confidence_score,
          ...seedFields(result),
        });
      } catch (err) {
        if (batchRef.current !== batch) return;
        const notClothing = err instanceof ApiError && err.status === 422;
        patchItem(item.id, {
          status: 'failed',
          error: notClothing ? "Doesn't look like a clothing item." : 'Tagging failed.',
        });
      }
    });

    // Only the batch that is still current may advance the flow to review.
    if (batchRef.current === batch) setPhase('review');
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = '';
    void ingestFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    void ingestFiles(Array.from(e.dataTransfer.files));
  }

  function removeItem(id: string) {
    setItems((list) => {
      const target = list.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return list.filter((it) => it.id !== id);
    });
  }

  function saveEdit(id: string, fields: ScanFields) {
    patchItem(id, { ...fields, status: 'done', error: undefined, addError: undefined });
    setEditingId(null);
  }

  function cancel() {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    navigate('/wardrobe');
  }

  const doneItems = items.filter((it) => it.status === 'done');
  const unresolved = doneItems.filter((it) => !itemIsComplete(it)).length;
  const addable = doneItems.filter((it) => itemIsComplete(it));
  // Intentional "fix everything or remove it" gate: any incomplete item blocks
  // the whole batch rather than letting the user add only the complete ones.
  // (Product-confirmed UX intent — revisit with the team before relaxing.)
  const canAddAll = !submitting && addable.length > 0 && unresolved === 0;

  async function addAll() {
    if (!canAddAll) return;
    const batch = addable;
    setSubmitting(true);
    setError(null);

    // Commit each item independently and capture its own outcome, so one
    // failure no longer sinks the whole batch. addItemWithImage rolls back a
    // created-but-unimaged item on failure, so failures leave nothing behind
    // and stay safe to retry.
    const outcomes = await mapWithConcurrency(batch, CONCURRENCY, async (item) => {
      try {
        await addItemWithImage(toPayload(item), toUploadFile(item));
        return { id: item.id, ok: true as const };
      } catch (err) {
        const message =
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Could not be added.';
        return { id: item.id, ok: false as const, message };
      }
    });

    const savedIds = new Set(outcomes.filter((o) => o.ok).map((o) => o.id));
    const failures = new Map(
      outcomes.filter((o) => !o.ok).map((o) => [o.id, o.message]),
    );

    if (failures.size === 0) {
      items.forEach((it) => URL.revokeObjectURL(it.url));
      navigate('/wardrobe');
      return;
    }

    // Drop the items that saved (revoking their thumbnails) and tag the ones
    // that didn't, so the next Add All only re-attempts the genuine failures.
    setItems((list) =>
      list
        .filter((it) => {
          if (savedIds.has(it.id)) URL.revokeObjectURL(it.url);
          return !savedIds.has(it.id);
        })
        .map((it) =>
          failures.has(it.id) ? { ...it, addError: failures.get(it.id) } : it,
        ),
    );

    setError(
      savedIds.size > 0
        ? `Added ${savedIds.size} of ${batch.length}. ${failures.size} couldn’t be added — try again.`
        : 'Some items could not be added. Please try again.',
    );
    setSubmitting(false);
  }

  const editingItem = items.find((it) => it.id === editingId) ?? null;
  const taggedCount = items.filter((it) => it.status !== 'processing').length;

  return (
    <div className="min-h-screen-safe bg-background pb-28">
      <div className="container-app py-6">
        {/* ── HEADER ─────────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={cancel}
            className="btn-ghost btn-icon"
            aria-label={phase === 'upload' ? 'Go back' : 'Cancel'}
          >
            {phase === 'tagging' ? (
              <X className="h-5 w-5" />
            ) : (
              <ArrowLeft className="h-5 w-5" />
            )}
          </button>
          <h4 className="font-serif">
            {phase === 'upload'
              ? 'Add Clothes'
              : phase === 'tagging'
                ? 'Tagging'
                : 'Review'}
          </h4>
          <div className="h-11 w-11" />
        </div>

        {/* ── UPLOAD ─────────────────────────────────── */}
        {phase === 'upload' && (
          <>
            <div className="mb-6">
              <h2 className="mb-2">Add your Wardrobe</h2>
              <p className="text-muted-foreground">
                Upload photos of your pieces and we'll tag and sort them for you — add
                as many as you like.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`mb-4 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
                dragging
                  ? 'border-primary bg-linen'
                  : 'border-sand bg-card hover:border-primary'
              }`}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-linen">
                <Images className="h-7 w-7 text-primary" />
              </span>
              <span className="flex flex-col items-center gap-1">
                <span className="font-medium text-foreground">Tap to add photos</span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Camera className="h-4 w-4" />
                  Use your photo library or camera
                </span>
                <span className="text-sm text-muted-foreground">
                  JPG or PNG · several at once
                </span>
              </span>
            </button>

            <div className="mt-8 flex items-start gap-3 rounded-lg bg-linen p-4">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p className="text-sm text-muted-foreground">
                Lay items on a plain background for the best tags.
              </p>
            </div>
          </>
        )}

        {/* ── TAGGING ────────────────────────────────── */}
        {phase === 'tagging' && (
          <>
            <div className="mb-6">
              <h2 className="mb-2">Tagging your items</h2>
              <p className="text-muted-foreground">
                Identifying each piece and sorting it into your wardrobe.
              </p>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border bg-linen"
                >
                  <img
                    src={it.url}
                    alt=""
                    className={`h-full w-full object-cover ${
                      it.status === 'processing' ? 'opacity-50' : ''
                    }`}
                  />
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow-sm">
                    {it.status === 'processing' && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    )}
                    {it.status === 'done' && (
                      <Check className="h-3.5 w-3.5 text-success" />
                    )}
                    {it.status === 'failed' && (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {taggedCount} of {items.length} tagged
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-linen">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{
                  width: `${items.length ? (taggedCount / items.length) * 100 : 0}%`,
                }}
              />
            </div>
          </>
        )}

        {/* ── REVIEW ─────────────────────────────────── */}
        {phase === 'review' && (
          <>
            <p className="mb-5 text-muted-foreground">
              {doneItems.length > 0
                ? `We tagged ${doneItems.length} ${doneItems.length === 1 ? 'item' : 'items'}. Edit or remove before adding.`
                : 'We couldn’t tag any of those photos. Try again with clearer shots.'}
            </p>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3"
            >
              <AnimatePresence initial={false}>
                {items.map((it) => {
                  const incomplete = it.status === 'failed' || !itemIsComplete(it);
                  return (
                    <motion.div
                      key={it.id}
                      layout
                      variants={fadeUpItem}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="card flex items-center gap-3 p-3"
                    >
                      <img
                        src={it.url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingId(it.id)}
                        className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left"
                      >
                        <span className="flex w-full items-center gap-1.5 font-medium text-foreground">
                          <span className="truncate">{it.name || 'Untitled item'}</span>
                          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </span>
                        {incomplete ? (
                          <span className="badge-warning">
                            {it.status === 'failed' ? it.error : 'Needs details'}
                          </span>
                        ) : (
                          <span className="flex flex-wrap items-center gap-1.5">
                            {it.sub_type && (
                              <span className="badge-default">
                                {TYPE_LABELS[it.sub_type] ?? it.sub_type}
                              </span>
                            )}
                            <ColorChip color={it.color} />
                          </span>
                        )}
                        {it.addError && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {it.addError}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="btn-ghost btn-icon shrink-0"
                        aria-label={`Remove ${it.name || 'item'}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {items.length === 0 && (
              <button
                type="button"
                onClick={() => setPhase('upload')}
                className="btn-outline btn-lg mt-4 w-full"
              >
                Add photos
              </button>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* ── STICKY ADD ALL (review only) ─────────────── */}
      {phase === 'review' && items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur safe-area-bottom">
          <div className="container-app flex flex-col gap-2 py-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {unresolved > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Resolve {unresolved} {unresolved === 1 ? 'item' : 'items'} before
                adding.
              </p>
            )}
            <button
              type="button"
              onClick={addAll}
              disabled={!canAddAll}
              className="btn-primary btn-lg w-full gap-2"
            >
              <Check className="h-5 w-5" />
              {submitting
                ? 'Adding…'
                : `Add All${addable.length ? ` (${addable.length})` : ''}`}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingItem && (
          <EditItemSheet
            imageUrl={editingItem.url}
            fields={{
              name: editingItem.name,
              category: editingItem.category,
              sub_type: editingItem.sub_type,
              color: editingItem.color,
              fit: editingItem.fit,
              season: editingItem.season,
            }}
            onSave={(fields) => saveEdit(editingItem.id, fields)}
            onClose={() => setEditingId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
