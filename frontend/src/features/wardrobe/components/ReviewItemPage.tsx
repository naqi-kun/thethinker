import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { addItem, uploadItemImage } from '../api';
import type {
  AddItemPayload,
  ClassifyResult,
  ClothingCategory,
  ClothingFit,
  ClothingSeason,
} from '../../../shared/api/types';

type ClothingSubType =
  | 'shirt'
  | 't-shirt'
  | 'sweater'
  | 'hoodie'
  | 'jacket'
  | 'coat'
  | 'pants'
  | 'jeans'
  | 'shorts'
  | 'skirt'
  | 'dress'
  | 'shoes'
  | 'sneakers'
  | 'boots'
  | 'suit'
  | 'blazer';

type ClothingColor =
  | 'black'
  | 'white'
  | 'grey'
  | 'navy blue'
  | 'blue'
  | 'light blue'
  | 'red'
  | 'burgundy'
  | 'green'
  | 'olive'
  | 'beige'
  | 'brown'
  | 'yellow'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'multicolor';

type FormState = {
  category: ClothingCategory | '';
  sub_type: ClothingSubType | '';
  color: ClothingColor | '';
  fit: ClothingFit | '';
  season: ClothingSeason | '';
};

type PillOption<T extends string> = { value: T; label: string };

const CATEGORIES: PillOption<ClothingCategory>[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'sport', label: 'Sport' },
];

const FITS: PillOption<ClothingFit>[] = [
  { value: 'slim', label: 'Slim' },
  { value: 'regular', label: 'Regular' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'oversized', label: 'Oversized' },
];

const SEASONS: PillOption<ClothingSeason>[] = [
  { value: 'all', label: 'All Seasons' },
  { value: 'spring_summer', label: 'Spring / Summer' },
  { value: 'autumn_winter', label: 'Autumn / Winter' },
  { value: 'winter', label: 'Winter Only' },
];

const SUB_TYPES: PillOption<ClothingSubType>[] = [
  { value: 'shirt', label: 'Shirt' },
  { value: 't-shirt', label: 'T-Shirt' },
  { value: 'sweater', label: 'Sweater' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'jacket', label: 'Jacket' },
  { value: 'coat', label: 'Coat' },
  { value: 'blazer', label: 'Blazer' },
  { value: 'suit', label: 'Suit' },
  { value: 'pants', label: 'Pants' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'skirt', label: 'Skirt' },
  { value: 'dress', label: 'Dress' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'sneakers', label: 'Sneakers' },
  { value: 'boots', label: 'Boots' },
];

const COLOR_SWATCHES: Record<ClothingColor, string> = {
  black: '#1a1a1a',
  white: '#f0f0f0',
  grey: '#888888',
  'navy blue': '#1f3a5f',
  blue: '#4a6fa5',
  'light blue': '#6fa3c7',
  red: '#c0392b',
  burgundy: '#800020',
  green: '#27ae60',
  olive: '#6b7c39',
  beige: '#d4bda8',
  brown: '#795548',
  yellow: '#f1c40f',
  orange: '#e67e22',
  pink: '#e91e8c',
  purple: '#9b59b6',
  multicolor: 'linear-gradient(135deg, #e74c3c, #3498db, #2ecc71)',
};

const COLORS: PillOption<ClothingColor>[] = (
  Object.keys(COLOR_SWATCHES) as ClothingColor[]
).map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));

function ColorPill({
  color,
  selected,
  onSelect,
}: {
  color: ClothingColor;
  selected: ClothingColor | '';
  onSelect: (c: ClothingColor) => void;
}) {
  const swatch = COLOR_SWATCHES[color];
  const isGradient = swatch.startsWith('linear');
  return (
    <button
      type="button"
      onClick={() => onSelect(color)}
      className={`flex cursor-pointer items-center gap-1.5 transition-all ${
        selected === color ? 'badge-primary' : 'badge-outline'
      }`}
    >
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
        style={isGradient ? { backgroundImage: swatch } : { backgroundColor: swatch }}
      />
      {color.charAt(0).toUpperCase() + color.slice(1)}
    </button>
  );
}

function PillGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: PillOption<T>[];
  selected: T | '';
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`cursor-pointer transition-all ${
            selected === opt.value ? 'badge-primary' : 'badge-outline'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type ReviewState = { classifyResult: ClassifyResult; imageBlob: Blob };

export default function ReviewItemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ReviewState | null;

  useEffect(() => {
    if (!state?.classifyResult) {
      navigate('/wardrobe/add', { replace: true });
    }
  }, [state, navigate]);

  const { classifyResult, imageBlob } = state ?? {};

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageBlob) return;
    const url = URL.createObjectURL(imageBlob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  const [form, setForm] = useState<FormState>({
    category: (classifyResult?.category as ClothingCategory) ?? '',
    sub_type: (classifyResult?.sub_type as ClothingSubType) ?? '',
    color: (classifyResult?.color as ClothingColor) ?? '',
    fit: (classifyResult?.fit as ClothingFit) ?? '',
    season: (classifyResult?.season as ClothingSeason) ?? '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    form.category !== '' &&
    form.sub_type !== '' &&
    form.color !== '' &&
    form.fit !== '' &&
    form.season !== '';

  const confidencePct = classifyResult
    ? Math.round(classifyResult.confidence_score * 100)
    : 0;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const newItem = await addItem(form as AddItemPayload);
      if (imageBlob) {
        const file = new File([imageBlob], 'scan.jpg', { type: 'image/jpeg' });
        await uploadItemImage(newItem.id, file);
      }
      navigate('/wardrobe');
    } catch {
      setError('Failed to save item. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!state?.classifyResult) return null;

  return (
    <div className="min-h-screen-safe bg-background pb-24">
      <div className="container-app py-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => navigate('/wardrobe/add')}
            className="btn-ghost btn-icon"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h4 className="font-serif">Review Item</h4>
          <div className="h-11 w-11" />
        </div>

        {/* Scanned image */}
        {imageUrl && (
          <div className="mb-6 aspect-square overflow-hidden rounded-2xl">
            <img
              src={imageUrl}
              alt="Scanned item"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Confidence badge */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="badge-outline text-sm font-medium">
            AI Confidence: {confidencePct}%
          </span>
          <span className="text-sm text-muted-foreground">
            Review and adjust if needed
          </span>
        </div>

        {/* Editable form */}
        <form onSubmit={handleConfirm} className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Occasion
            </label>
            <PillGroup
              options={CATEGORIES}
              selected={form.category}
              onSelect={(value) => setForm((f) => ({ ...f, category: value }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Type
            </label>
            <PillGroup
              options={SUB_TYPES}
              selected={form.sub_type}
              onSelect={(value) => setForm((f) => ({ ...f, sub_type: value }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((opt) => (
                <ColorPill
                  key={opt.value}
                  color={opt.value}
                  selected={form.color}
                  onSelect={(value) => setForm((f) => ({ ...f, color: value }))}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Fit
            </label>
            <PillGroup
              options={FITS}
              selected={form.fit}
              onSelect={(value) => setForm((f) => ({ ...f, fit: value }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Season
            </label>
            <PillGroup
              options={SEASONS}
              selected={form.season}
              onSelect={(value) => setForm((f) => ({ ...f, season: value }))}
            />
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="btn-primary btn-lg w-full"
          >
            {submitting ? 'Saving…' : 'Add to Wardrobe'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/wardrobe/add')}
            className="btn-outline btn-lg w-full gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Retake Photo
          </button>
        </form>
      </div>
    </div>
  );
}
