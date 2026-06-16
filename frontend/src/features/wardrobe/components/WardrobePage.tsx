import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Footprints,
  Plus,
  Search,
  Shirt,
  ShoppingBag,
  Trash2,
  Upload,
  Watch,
  X,
} from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';
import Select from '../../../shared/components/Select';
import ItemThumbnail from '../../../shared/components/ItemThumbnail';
import Skeleton from '../../../shared/components/Skeleton';
import { staggerContainer, fadeUpItem } from '../../../shared/motion';
import {
  deleteItem,
  listItems,
  updateItem,
  updateItemStatus,
  uploadItemImage,
} from '../api';
import type {
  AddItemPayload,
  ClothingCategory,
  ClothingFit,
  ClothingItem,
  ClothingSeason,
  ClothingStatus,
} from '../../../shared/api/types';
import { HexColorPicker } from 'react-colorful';
import {
  CATEGORIES,
  COLOR_SWATCHES,
  FITS,
  SEASONS,
  STATUSES,
  SUB_TYPES,
  colorLabel,
  type ClothingColor,
  type ClothingSubType,
} from '../options';
import { nearestNamedColor } from '../colorMatch';
import EyedropperImage from './EyedropperImage';

type WardrobeCategory = 'Tops' | 'Bottoms' | 'Shoes' | 'Outerwear' | 'Accessories';
type FilterTab = 'All' | WardrobeCategory;

const CATEGORY_TABS: FilterTab[] = [
  'All',
  'Tops',
  'Bottoms',
  'Shoes',
  'Outerwear',
  'Accessories',
];

// ── Form types ────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  category: ClothingCategory | '';
  sub_type: ClothingSubType | '';
  color: ClothingColor | '';
  fit: ClothingFit | '';
  season: ClothingSeason | '';
};

/** A hex to seed the colour wheel from a named colour (neutral for multicolor). */
function hexForColor(color: string): string {
  const swatch = COLOR_SWATCHES[color as ClothingColor];
  return swatch && swatch.startsWith('#') ? swatch : '#888888';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function subTypeToCategory(subType: string): WardrobeCategory {
  const s = subType.toLowerCase();
  if (
    ['shirt', 't-shirt', 'blouse', 'top', 'sweater', 'hoodie', 'tee'].some((t) =>
      s.includes(t),
    )
  )
    return 'Tops';
  if (['pants', 'jeans', 'trousers', 'shorts', 'skirt'].some((t) => s.includes(t)))
    return 'Bottoms';
  if (
    ['shoes', 'sneakers', 'boots', 'loafers', 'sandals', 'heels'].some((t) =>
      s.includes(t),
    )
  )
    return 'Shoes';
  if (
    ['jacket', 'coat', 'blazer', 'cardigan', 'outerwear', 'suit'].some((t) =>
      s.includes(t),
    )
  )
    return 'Outerwear';
  return 'Accessories';
}

function seasonLabel(season: ClothingSeason): string {
  switch (season) {
    case 'all':
      return 'All seasons';
    case 'spring_summer':
      return 'Spring / Summer';
    case 'autumn_winter':
      return 'Autumn / Winter';
    case 'winter':
      return 'Winter only';
  }
}

// last_worn is a full ISO date-time; show a compact friendly date on the card.
function formatWorn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Worn recently';
  return `Worn ${d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Used by the item-detail modal's no-image fallback. The wardrobe card renders
// its fallback through <ItemThumbnail>, which keeps its own copy of this logic;
// the modal stays on EyedropperImage (colour sampling) so it keeps these here.
function categoryIcon(category: WardrobeCategory) {
  switch (category) {
    case 'Tops':
      return <Shirt className="h-5 w-5" />;
    case 'Bottoms':
      return <ShoppingBag className="h-5 w-5" />;
    case 'Shoes':
      return <Footprints className="h-5 w-5" />;
    case 'Outerwear':
      return <Watch className="h-5 w-5" />;
    case 'Accessories':
      return <Watch className="h-5 w-5" />;
  }
}

function colorSwatch(color: string) {
  const map: Record<string, string> = {
    white: '#f5f5f5',
    black: '#1a1a1a',
    blue: '#4a6fa5',
    charcoal: '#4a4a4a',
    tan: '#c9a96e',
    navy: '#1f3a5f',
    silver: '#a8a8b3',
    grey: '#888888',
    gray: '#888888',
    red: '#c0392b',
    green: '#27ae60',
    brown: '#795548',
    beige: '#d4bda8',
  };
  return map[color.toLowerCase()] ?? '#d4bda8';
}

function itemToFormState(item: ClothingItem): FormState {
  return {
    name: item.name ?? '',
    category: (item.category as ClothingCategory) ?? '',
    sub_type: (item.sub_type as ClothingSubType) ?? '',
    color: (item.color as ClothingColor) ?? '',
    fit: (item.fit as ClothingFit) ?? '',
    season: (item.season as ClothingSeason) ?? '',
  };
}

function displayNameFor(item: ClothingItem): string {
  return item.name?.trim() || `${capitalize(item.color)} ${item.sub_type}`;
}

// ── ItemDetailModal ───────────────────────────────────────────────────────────

function ItemDetailModal({
  item,
  onClose,
  onSaved,
}: {
  item: ClothingItem;
  onClose: () => void;
  onSaved: (updated: ClothingItem) => void;
}) {
  const [form, setForm] = useState<FormState>(itemToFormState(item));
  const [pickedHex, setPickedHex] = useState<string>(hexForColor(item.color));
  const [hoverColor, setHoverColor] = useState<ClothingColor | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [status, setStatus] = useState<ClothingStatus>(item.status);
  const [savingStatus, setSavingStatus] = useState(false);

  const category = subTypeToCategory(item.sub_type);
  const displayName = displayNameFor(item);
  const colorIsMulticolor = form.color === 'multicolor';
  // Hovering the image previews the sampled colour; otherwise show the committed one.
  const previewColor = hoverColor ?? form.color;
  const previewSwatch = previewColor ? COLOR_SWATCHES[previewColor] : '';

  const isFormValid =
    form.category !== '' &&
    form.sub_type !== '' &&
    form.color !== '' &&
    form.fit !== '' &&
    form.season !== '';

  function handleColorPick(hex: string) {
    setPickedHex(hex);
    setForm((f) => ({ ...f, color: nearestNamedColor(hex) }));
  }

  async function handleSave() {
    if (!isFormValid) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateItem(item.id, {
        name: form.name.trim(),
        category: form.category,
        sub_type: form.sub_type,
        color: form.color,
        fit: form.fit,
        season: form.season,
      } as AddItemPayload);
      onSaved(updated);
      onClose();
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(next: ClothingStatus) {
    const previous = status;
    setStatus(next);
    setSavingStatus(true);
    setSaveError(null);
    try {
      const updated = await updateItemStatus(item.id, next);
      onSaved(updated);
    } catch {
      setStatus(previous);
      setSaveError('Failed to update status. Please try again.');
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-background pb-safe max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">{displayName}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Image preview */}
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-linen/60">
            {item.image_url && !imgError ? (
              <EyedropperImage
                src={item.image_url}
                alt={displayName}
                objectFit="contain"
                className="h-full w-full"
                onHover={setHoverColor}
                onPick={(c) => handleColorPick(hexForColor(c))}
                onImgError={() => setImgError(true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                  {categoryIcon(category)}
                </div>
                <div
                  className="h-5 w-5 rounded-full border border-border"
                  style={{ backgroundColor: colorSwatch(item.color) }}
                  title={item.color}
                />
              </div>
            )}
          </div>

          {/* Edit form */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="modal-item-name"
                className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Name
              </label>
              <input
                id="modal-item-name"
                type="text"
                className="input"
                value={form.name}
                placeholder="e.g. Black T-Shirt"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Category
              </p>
              <Select
                options={CATEGORIES}
                value={form.category}
                placeholder="Select category…"
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Type
              </p>
              <Select
                options={SUB_TYPES}
                value={form.sub_type}
                placeholder="Select type…"
                onChange={(v) => setForm((f) => ({ ...f, sub_type: v }))}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Color
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <HexColorPicker color={pickedHex} onChange={handleColorPick} />
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-6 w-6 shrink-0 rounded-full border border-black/10"
                      style={
                        previewSwatch.startsWith('linear')
                          ? { backgroundImage: previewSwatch }
                          : { backgroundColor: previewSwatch }
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      Snaps to:{' '}
                      <span className="font-medium text-foreground">
                        {previewColor ? colorLabel(previewColor) : '—'}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: 'multicolor' }))}
                    className={`flex w-fit cursor-pointer items-center gap-1.5 transition-all ${
                      colorIsMulticolor ? 'badge-primary' : 'badge-outline'
                    }`}
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundImage: COLOR_SWATCHES.multicolor }}
                    />
                    Multicolor
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Fit
              </p>
              <Select
                options={FITS}
                value={form.fit}
                placeholder="Select fit…"
                onChange={(v) => setForm((f) => ({ ...f, fit: v }))}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Season
              </p>
              <Select
                options={SEASONS}
                value={form.season}
                placeholder="Select season…"
                onChange={(v) => setForm((f) => ({ ...f, season: v }))}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </p>
              {/* Status saves immediately via its own endpoint, independent of
                  the "Save Changes" button below. */}
              <Select
                options={STATUSES}
                value={status}
                onChange={handleStatusChange}
                className={savingStatus ? 'opacity-60' : undefined}
              />
            </div>
          </div>

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline btn-md flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isFormValid || saving}
              className="btn-primary btn-md flex-1"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ItemCard ──────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onCardClick,
  onImageUploaded,
  onStatusChanged,
  onDeleted,
}: {
  item: ClothingItem;
  onCardClick: (item: ClothingItem) => void;
  onImageUploaded?: (id: string, imageUrl: string) => void;
  onStatusChanged?: (updated: ClothingItem) => void;
  onDeleted?: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const displayName = displayNameFor(item);
  const tags = [item.category, item.fit].filter(Boolean) as string[];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const updated = await uploadItemImage(item.id, file);
      onImageUploaded?.(item.id, updated.image_url ?? '');
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteItem(item.id);
      onDeleted?.(item.id);
    } catch {
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(next: ClothingStatus) {
    if (next === item.status) return;
    setSavingStatus(true);
    setStatusError(null);
    try {
      const updated = await updateItemStatus(item.id, next);
      onStatusChanged?.(updated);
    } catch {
      setStatusError('Could not update status.');
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div
      className="card-interactive flex flex-col overflow-hidden cursor-pointer"
      onClick={() => onCardClick(item)}
    >
      {/* topInset reserves pt-12 so the contained image clears the top controls
          (delete + status). */}
      <ItemThumbnail item={item} alt={displayName} topInset>
        {/* Delete confirmation overlay */}
        {confirming && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium text-foreground">Remove item?</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full bg-destructive px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm border border-border hover:bg-background transition-colors"
          title="Remove item"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {/* Quick status control — top-right overlay; stops propagation so it
            doesn't open the modal */}
        <select
          value={item.status}
          disabled={savingStatus}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleStatusChange(e.target.value as ClothingStatus)}
          aria-label="Item status"
          className="absolute right-2 top-2 cursor-pointer rounded-full border border-border bg-background/90 px-2 py-1 text-[10px] text-foreground shadow-sm backdrop-blur-sm disabled:opacity-60"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Upload button — stops propagation so it doesn't open the modal */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={uploading}
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm border border-border hover:bg-background transition-colors disabled:opacity-50"
          title="Upload image"
        >
          {uploading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <Upload className="h-3.5 w-3.5 text-foreground" />
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileChange}
        />
      </ItemThumbnail>

      <div className="flex flex-col gap-1.5 p-3">
        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
        <p className="text-xs text-muted-foreground">{item.color}</p>

        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="badge-default px-2 py-0.5 text-[10px]">
              {tag}
            </span>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">
          {item.last_worn
            ? formatWorn(item.last_worn)
            : item.season
              ? seasonLabel(item.season)
              : null}
        </p>

        {statusError && <p className="text-[10px] text-destructive">{statusError}</p>}
        {uploadError && <p className="text-[10px] text-destructive">{uploadError}</p>}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadinessHint({ items }: { items: ClothingItem[] }) {
  const cats = items.map((item) => subTypeToCategory(item.sub_type));
  const hasTops = cats.includes('Tops');
  const hasBottoms = cats.includes('Bottoms');
  const hasShoes = cats.includes('Shoes');
  const ready = hasTops && hasBottoms && hasShoes;
  const missing: string[] = [];
  if (!hasTops) missing.push('tops');
  if (!hasBottoms) missing.push('bottoms');
  if (!hasShoes) missing.push('shoes');

  return (
    <div
      className={`mb-6 rounded-xl border p-4 ${
        ready ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'
      }`}
    >
      <p className="text-sm font-semibold text-foreground">
        {ready ? 'Ready for outfit recommendations' : 'Almost ready'}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {ready
          ? 'You have enough items for daily outfit suggestions.'
          : `Add ${missing.join(', ')} to unlock outfit recommendations.`}
      </p>
    </div>
  );
}

function StatsBar({ items }: { items: ClothingItem[] }) {
  const cats = items.map((item) => subTypeToCategory(item.sub_type));
  const stats: { label: string; count: number }[] = [
    { label: 'Total', count: items.length },
    { label: 'Tops', count: cats.filter((c) => c === 'Tops').length },
    { label: 'Bottoms', count: cats.filter((c) => c === 'Bottoms').length },
    { label: 'Shoes', count: cats.filter((c) => c === 'Shoes').length },
    {
      label: 'Other',
      count: cats.filter((c) => c === 'Accessories' || c === 'Outerwear').length,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-5 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
      {stats.map(({ label, count }) => (
        <div key={label} className="flex flex-col items-center py-3">
          <span className="font-serif text-xl font-normal text-foreground">
            {count}
          </span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── WardrobePage ──────────────────────────────────────────────────────────────

export default function WardrobePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);

  useEffect(() => {
    listItems()
      .then(setItems)
      .catch(() => setError('Failed to load wardrobe items.'))
      .finally(() => setLoading(false));
  }, []);

  function handleImageUploaded(id: string, imageUrl: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, image_url: imageUrl } : item)),
    );
  }

  function handleItemUpdated(updated: ClothingItem) {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  const filtered = items.filter((item) => {
    const category = subTypeToCategory(item.sub_type);
    const normalizedSearch = search.trim().toLowerCase();
    const matchesCategory = activeTab === 'All' || category === activeTab;
    const displayName =
      `${item.name ?? ''} ${item.color} ${item.sub_type}`.toLowerCase();
    const matchesSearch =
      normalizedSearch === '' ||
      displayName.includes(normalizedSearch) ||
      item.color.toLowerCase().includes(normalizedSearch) ||
      item.category.includes(normalizedSearch) ||
      (item.fit?.includes(normalizedSearch) ?? false);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen-safe bg-background pb-24">
      <TopNav />

      <main className="container-app py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1">Wardrobe</h2>
            <p className="helper-text">Your scanned closet, always in order.</p>
          </div>
          <button
            onClick={() => navigate('/wardrobe/add')}
            className="btn-primary btn-sm mt-1 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>

        {loading ? (
          <div aria-busy="true">
            {/* stats bar */}
            <Skeleton className="mb-6 h-16 rounded-xl" />
            {/* readiness hint */}
            <Skeleton className="mb-6 h-17 rounded-xl" />
            {/* search field */}
            <Skeleton className="mb-4 h-11 rounded-md" />
            {/* category tabs */}
            <div className="mb-6 flex gap-2">
              {['w-12', 'w-14', 'w-20', 'w-16', 'w-24', 'w-28'].map((w, i) => (
                <Skeleton key={i} className={`h-7 ${w} rounded-full`} />
              ))}
            </div>
            {/* card grid */}
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-4/5 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : error ? (
          <p className="py-20 text-center text-sm text-destructive">{error}</p>
        ) : (
          <>
            <StatsBar items={items} />
            <ReadinessHint items={items} />

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by name, color, or style..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-9"
              />
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 cursor-pointer transition-all ${
                    activeTab === tab ? 'badge-primary' : 'badge-outline'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {filtered.length > 0 ? (
              // key by tab so switching categories replays the stagger; typing
              // in search keeps the container mounted (only new matches fade in).
              <motion.div
                key={activeTab}
                className="grid grid-cols-2 gap-3"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {filtered.map((item) => (
                  <motion.div key={item.id} variants={fadeUpItem}>
                    <ItemCard
                      item={item}
                      onCardClick={setSelectedItem}
                      onImageUploaded={handleImageUploaded}
                      onStatusChanged={handleItemUpdated}
                      onDeleted={handleDeleted}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                  <Shirt className="h-8 w-8 text-muted-foreground" />
                </div>
                <h5 className="mb-1">No items found</h5>
                <p className="helper-text mb-6">
                  {search
                    ? `No results for "${search}". Try a different search term.`
                    : items.length === 0
                      ? 'Scan your first item to build your wardrobe.'
                      : `You have no ${activeTab.toLowerCase()} in your wardrobe yet.`}
                </p>
                <button
                  onClick={() => navigate('/wardrobe/add')}
                  className="btn-primary btn-md gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Item
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="container-app py-4">
            <button
              onClick={() => navigate('/outfit')}
              className="btn-primary btn-lg w-full"
            >
              Get Outfit Recommendation
            </button>
          </div>
        </div>
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={handleItemUpdated}
        />
      )}
    </div>
  );
}
