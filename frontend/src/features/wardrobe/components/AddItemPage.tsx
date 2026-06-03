import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';
import { addItem } from '../api';
import type { AddItemPayload, ClothingCategory, ClothingFit, ClothingSeason } from '../../../shared/api/types';

type FormState = {
  category: ClothingCategory | '';
  sub_type: string;
  color: string;
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

const EMPTY: FormState = {
  category: '',
  sub_type: '',
  color: '',
  fit: '',
  season: '',
};

export default function AddItemPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    form.category !== '' &&
    form.sub_type.trim() !== '' &&
    form.color.trim() !== '' &&
    form.fit !== '' &&
    form.season !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await addItem(form as AddItemPayload);
      navigate('/wardrobe');
    } catch {
      setError('Failed to save item. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen-safe bg-background pb-24">
      <TopNav />

      <main className="container-app py-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/wardrobe')}
            className="btn-ghost btn-icon"
            aria-label="Back to wardrobe"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="mb-0.5">Add Item</h2>
            <p className="helper-text">Classify a piece of clothing for your wardrobe.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
            <label
              htmlFor="sub_type"
              className="block text-xs font-medium uppercase tracking-widest text-espresso"
            >
              Type
            </label>
            <input
              id="sub_type"
              type="text"
              className="input"
              placeholder="e.g. jeans, shirt, sneakers"
              value={form.sub_type}
              onChange={(e) => setForm((f) => ({ ...f, sub_type: e.target.value }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label
              htmlFor="color"
              className="block text-xs font-medium uppercase tracking-widest text-espresso"
            >
              Color
            </label>
            <input
              id="color"
              type="text"
              className="input"
              placeholder="e.g. navy blue, off-white"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
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
            {submitting ? 'Saving…' : 'Save to Wardrobe'}
          </button>
        </form>
      </main>
    </div>
  );
}
