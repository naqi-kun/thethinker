import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HexColorPicker } from 'react-colorful';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { addItem, uploadItemImage } from '../api';
import type {
  AddItemPayload,
  ClassifyResult,
  ClothingCategory,
  ClothingFit,
  ClothingSeason,
} from '../../../shared/api/types';
import Select from '../../../shared/components/Select';
import {
  CATEGORIES,
  COLOR_SWATCHES,
  FITS,
  SEASONS,
  SUB_TYPES,
  colorLabel,
  type ClothingColor,
  type ClothingSubType,
} from '../options';
import { nearestNamedColor, suggestName } from '../colorMatch';
import EyedropperImage from './EyedropperImage';

type FormState = {
  name: string;
  category: ClothingCategory | '';
  sub_type: ClothingSubType | '';
  color: ClothingColor | '';
  fit: ClothingFit | '';
  season: ClothingSeason | '';
};

type ReviewState = { classifyResult: ClassifyResult; imageBlob: Blob };

/** A hex to seed the colour wheel from a named colour (neutral for multicolor). */
function hexForColor(color: string): string {
  const swatch = COLOR_SWATCHES[color as ClothingColor];
  return swatch && swatch.startsWith('#') ? swatch : '#888888';
}

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
    name: suggestName(classifyResult?.color ?? '', classifyResult?.sub_type ?? ''),
    category: (classifyResult?.category as ClothingCategory) ?? '',
    sub_type: (classifyResult?.sub_type as ClothingSubType) ?? '',
    color: (classifyResult?.color as ClothingColor) ?? '',
    fit: (classifyResult?.fit as ClothingFit) ?? '',
    season: (classifyResult?.season as ClothingSeason) ?? '',
  });

  // The hex shown in the wheel; the saved value is always the snapped named colour.
  const [pickedHex, setPickedHex] = useState<string>(
    hexForColor(classifyResult?.color ?? ''),
  );
  // Live colour under the cursor while hovering the image; null reverts to committed.
  const [hoverColor, setHoverColor] = useState<ClothingColor | null>(null);
  // Once the user edits the name we stop auto-suggesting from colour + type.
  const [nameTouched, setNameTouched] = useState(false);

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

  // Re-derive the suggested name when colour/type change, until the user edits it.
  function reSuggestName(next: FormState): FormState {
    if (nameTouched) return next;
    return { ...next, name: suggestName(next.color, next.sub_type) };
  }

  function handleColorPick(hex: string) {
    setPickedHex(hex);
    setForm((f) => reSuggestName({ ...f, color: nearestNamedColor(hex) }));
  }

  function pickMulticolor() {
    setForm((f) => reSuggestName({ ...f, color: 'multicolor' }));
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const newItem = await addItem({
        name: form.name.trim(),
        category: form.category,
        sub_type: form.sub_type,
        color: form.color,
        fit: form.fit,
        season: form.season,
      } as AddItemPayload);
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

  const colorIsMulticolor = form.color === 'multicolor';
  // While hovering the image the indicator previews the sampled colour, otherwise
  // it shows the last committed colour.
  const previewColor = hoverColor ?? form.color;
  const previewSwatch = previewColor ? COLOR_SWATCHES[previewColor] : '';

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

        {/* Scanned image — hover to sample the garment colour, click to commit. */}
        {imageUrl && (
          <EyedropperImage
            src={imageUrl}
            alt="Scanned item"
            objectFit="cover"
            className="mb-6 aspect-square overflow-hidden rounded-2xl"
            onHover={setHoverColor}
            onPick={(c) => handleColorPick(hexForColor(c))}
          />
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
            <label
              htmlFor="item-name"
              className="block text-xs font-medium uppercase tracking-widest text-espresso"
            >
              Name
            </label>
            <input
              id="item-name"
              type="text"
              className="input"
              value={form.name}
              placeholder="e.g. Black T-Shirt"
              onChange={(e) => {
                setNameTouched(true);
                setForm((f) => ({ ...f, name: e.target.value }));
              }}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Occasion
            </label>
            <Select
              options={CATEGORIES}
              value={form.category}
              placeholder="Select occasion…"
              onChange={(value) => setForm((f) => ({ ...f, category: value }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Type
            </label>
            <Select
              options={SUB_TYPES}
              value={form.sub_type}
              placeholder="Select type…"
              onChange={(value) =>
                setForm((f) => reSuggestName({ ...f, sub_type: value }))
              }
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Color
            </label>
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
                  onClick={pickMulticolor}
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
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Fit
            </label>
            <Select
              options={FITS}
              value={form.fit}
              placeholder="Select fit…"
              onChange={(value) => setForm((f) => ({ ...f, fit: value }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Season
            </label>
            <Select
              options={SEASONS}
              value={form.season}
              placeholder="Select season…"
              onChange={(value) => setForm((f) => ({ ...f, season: value }))}
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
