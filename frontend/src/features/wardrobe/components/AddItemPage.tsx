import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  PenLine,
  RotateCcw,
  Scan,
  X,
} from 'lucide-react';
import { addItem, scanItem, uploadItemImage } from '../api';
import type {
  AddItemPayload,
  ClothingCategory,
  ClothingFit,
  ClothingSeason,
} from '../../../shared/api/types';

type PageState = 'pick' | 'camera' | 'camera-preview' | 'form' | 'busy';

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

const EMPTY_FORM: FormState = {
  category: '',
  sub_type: '',
  color: '',
  fit: '',
  season: '',
};

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

function ItemFormFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
}) {
  return (
    <>
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
    </>
  );
}

const HEADER_TITLES: Record<PageState, string> = {
  pick: 'Add Item',
  camera: 'Scan Item',
  'camera-preview': 'Scan Item',
  form: 'Add Manually',
  busy: 'Add Item',
};

export default function AddItemPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('pick');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [galleryFile, setGalleryFile] = useState<File | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    form.category !== '' &&
    form.sub_type !== '' &&
    form.color !== '' &&
    form.fit !== '' &&
    form.season !== '';

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (pageState === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [pageState]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function clearImage() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setGalleryFile(null);
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setPageState('camera');
    } catch {
      setError('Camera access denied or not available on this device.');
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setPageState('camera-preview');
    }, 'image/jpeg');
  }

  function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setGalleryFile(file);
    setCapturedUrl(URL.createObjectURL(file));
  }

  function goBackToPick() {
    clearImage();
    setForm(EMPTY_FORM);
    setError(null);
    stopCamera();
    setPageState('pick');
  }

  async function confirmCameraScan() {
    if (!capturedBlob) return;
    setPageState('busy');
    try {
      await scanItem(capturedBlob);
      clearImage();
      navigate('/wardrobe');
    } catch {
      setError('Scan failed. Please try again.');
      setPageState('camera-preview');
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const newItem = await addItem(form as AddItemPayload);
      if (galleryFile) {
        await uploadItemImage(newItem.id, galleryFile);
      }
      clearImage();
      navigate('/wardrobe');
    } catch {
      setError('Failed to save item. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen-safe bg-background pb-24">
      <div className="container-app py-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() =>
              pageState === 'pick' ? navigate('/wardrobe') : goBackToPick()
            }
            className="btn-ghost btn-icon"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h4 className="font-serif">{HEADER_TITLES[pageState]}</h4>
          <div className="h-11 w-11" />
        </div>

        {/* ── METHOD PICKER ───────────────────────────── */}
        {pageState === 'pick' && (
          <div className="flex flex-col gap-4">
            <p className="helper-text mb-2 text-center">
              How would you like to add this item?
            </p>

            <button
              onClick={startCamera}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:bg-linen/60 active:scale-[0.99]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta/10">
                <Camera className="h-6 w-6 text-terracotta" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Take a Photo</p>
                <p className="text-sm text-muted-foreground">
                  AI classifies the item automatically
                </p>
              </div>
            </button>

            <button
              onClick={() => setPageState('form')}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:bg-linen/60 active:scale-[0.99]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta/10">
                <PenLine className="h-6 w-6 text-terracotta" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Add Manually</p>
                <p className="text-sm text-muted-foreground">
                  Fill in details — optionally attach a photo
                </p>
              </div>
            </button>

            {error && (
              <p className="mt-2 text-center text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {/* ── CAMERA LIVE ─────────────────────────────── */}
        {pageState === 'camera' && (
          <>
            <div className="mb-6 aspect-square overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            </div>
            <button onClick={capturePhoto} className="btn-primary btn-lg w-full gap-2">
              <Camera className="h-5 w-5" />
              Capture
            </button>
          </>
        )}

        {/* ── CAMERA PREVIEW ──────────────────────────── */}
        {pageState === 'camera-preview' && capturedUrl && (
          <>
            <div className="mb-6 aspect-square overflow-hidden rounded-2xl">
              <img
                src={capturedUrl}
                alt="Captured item"
                className="h-full w-full object-cover"
              />
            </div>
            {error && (
              <p className="mb-4 text-center text-sm text-destructive">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={goBackToPick}
                className="btn-outline btn-lg flex-1 gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </button>
              <button
                onClick={confirmCameraScan}
                className="btn-primary btn-lg flex-1 gap-2"
              >
                <Scan className="h-4 w-4" />
                Scan Item
              </button>
            </div>
          </>
        )}

        {/* ── MANUAL FORM (with optional photo) ──────── */}
        {pageState === 'form' && (
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
            {/* Optional photo picker */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-espresso">
                Photo (optional)
              </label>
              {capturedUrl ? (
                <div className="relative aspect-video overflow-hidden rounded-2xl">
                  <img
                    src={capturedUrl}
                    alt="Selected item"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      clearImage();
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand bg-linen/40 py-8 text-muted-foreground transition-colors hover:bg-linen/70"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-sm">Upload from gallery</span>
                </button>
              )}
            </div>

            <ItemFormFields form={form} setForm={setForm} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="btn-primary btn-lg w-full"
            >
              {submitting ? 'Saving…' : 'Save to Wardrobe'}
            </button>
          </form>
        )}

        {/* ── BUSY ────────────────────────────────────── */}
        {pageState === 'busy' && (
          <div className="flex flex-col items-center gap-4 py-20">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Scanning your item…</p>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGalleryFile}
        />
      </div>
    </div>
  );
}
