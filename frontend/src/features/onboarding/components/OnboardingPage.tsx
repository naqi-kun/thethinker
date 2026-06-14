import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { token } from '../../../shared/api/token';
import { buildPreferences, savePreferences } from '../api';
import type { OnboardingAnswers } from '../api';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Waves,
  Coffee,
  Briefcase,
  Zap,
  Sun,
  Sunrise,
  Wind,
  Snowflake,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const TOTAL_STEPS = 8;

// ─── Data ────────────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  { label: 'Casual', icon: Waves },
  { label: 'Smart Casual', icon: Coffee },
  { label: 'Formal', icon: Briefcase },
  { label: 'Sporty', icon: Zap },
];

const OCCASION_OPTIONS = [
  {
    label: 'Work',
    description: 'Office & Business',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhZJ8R08WhiscLwcHee2QUOd9eczJyu52MsmGFUwITbQL6R5qma3GM0z8EzGxuf0DbBat4H_DBIomSsP0y_aVOlzxvi41mX2_JhqVYGubmB6wcLi9l9rKsZeUx26nmHPtL1RSLXWR8d44gcomGjeGsBKGUa4Ypabrf_mRDBeJvfJjIKDFQiiwE-HOnOfKu-9Jj-CRMs6BOCStxIbZvcQxtVgTaffYwGHo_kXf80JSD2iJ_jwrF_4grhBB7eNcK0DhqWS-pljgf7WQ',
  },
  {
    label: 'Casual',
    description: 'Daily & Errands',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAv21OCxRn0etjqiN51zBXfOm9IJuSgmm4c-RqUoxlev1Jtd85t_9UhCUmAv6GVAn67Uqgul6LNxppihlQ2VQ5ccbU5hnq6_Npd1k5WK-7o36hnQJkjHIGx_vnfHkRy3CXZi8hQY5sCxW2njYRxIsqViT9qHPSIE2K1IR1BbjVT1fcU4SIeVjpEcDytWaXb6eG96Uzt12M-_WmbkDHG_JPJzBXtQOEbct0I669k-pLatlXzPEePFBCNzvziySgxcIiKnZPY52g6P-o',
  },
  {
    label: 'Events',
    description: 'Dinners & Galas',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLnbLc6DGNzpts58QN6E-cN9I8INKByqaGBzJpFmRoom8vDH0D5zFimZRAa1BELZYp6y2ZDH7iC48qMi05R7jRnnLhb10aCh6EQTr8y1lU_LileSdVVlg2tNw0k7TOu4wNtwU8X8dThITQUuJDoebYT6jeyfycyc71mG6ncEQcPYxLcM3HGsoPa50kgzvt5Hhpa3MQUAFVgN3kOu0QjN0lhQr3r0Ho8ysnaob_L-r9iJ3k6Q4mFCtoNZsxVWAee5bJDZcNBUBviUw',
  },
  {
    label: 'Outdoor',
    description: 'Sport & Nature',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDxpucAw5Fg6o9RZeR_JPlr7L5hLTcX7WVorRQlrUYxpEUbpuRdwUK30JnF8TbCZQWr8qFxbfV37W6_VIUdeUX8iIIhf52uzc0e-PmjAoAiEcW6yi8zyfblq87GtLVjt4l8EZOopmxWwT7D7-tzcFpG7mqSbS6tWHCActYdzRlsdKN24rPkP-H5mLqw9XU5WhiCJA5nlEzTi9QKpMcBzS_1bHWrTk5TWIRydLDs4r_dWIYTPTveaJEXfEcm-3NzeufDqD4m6_9BqUE',
  },
];

const INSPIRATION_OPTIONS = [
  {
    label: 'Minimalist',
    description: 'Clean lines, neutral tones',
    img: 'https://images.unsplash.com/photo-1490481560014-77c2b51a4a6a?w=400&q=80',
    bg: '#DDD8D2',
  },
  {
    label: 'Street Style',
    description: 'Urban, edgy, expressive',
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    bg: '#2D2D2D',
  },
  {
    label: 'Business',
    description: 'Polished & professional',
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    bg: '#3A3A4A',
  },
  {
    label: 'Casual Chic',
    description: 'Relaxed but put-together',
    img: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&q=80',
    bg: '#C8B89A',
  },
  {
    label: 'Athletic',
    description: 'Performance meets style',
    img: 'https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?w=400&q=80',
    bg: '#4A7C8A',
  },
  {
    label: 'Classic',
    description: 'Timeless, refined pieces',
    img: 'https://images.unsplash.com/photo-1516762689617-e1cfffed4669?w=400&q=80',
    bg: '#8A7A6A',
  },
];

const SKIN_TONE_OPTIONS = [
  { label: 'Very Fair', color: '#FDDBB4', note: 'Porcelain / Ivory' },
  { label: 'Fair', color: '#F5C89A', note: 'Light / Peach' },
  { label: 'Medium', color: '#E8A87C', note: 'Beige / Sand' },
  { label: 'Tan', color: '#C68642', note: 'Warm / Caramel' },
  { label: 'Deep', color: '#8D5524', note: 'Brown / Cocoa' },
  { label: 'Very Deep', color: '#4A2912', note: 'Dark / Ebony' },
];

const BODY_SHAPE_OPTIONS = [
  { label: 'Hourglass', description: 'Balanced bust & hips, defined waist' },
  { label: 'Pear', description: 'Hips wider than shoulders' },
  { label: 'Apple', description: 'Fuller midsection, slimmer legs' },
  { label: 'Rectangle', description: 'Even proportions throughout' },
  { label: 'Inv. Triangle', description: 'Shoulders wider than hips' },
  { label: 'Athletic', description: 'Muscular, defined proportions' },
];

const HEIGHT_OPTIONS = [
  { label: 'Petite', description: 'Under 5\'4" / 163 cm' },
  { label: 'Average', description: '5\'4"–5\'7" / 163–170 cm' },
  { label: 'Tall', description: '5\'8"+ / 173 cm+' },
];

const FACE_SHAPE_OPTIONS = [
  { label: 'Oval', description: 'Balanced, slightly longer' },
  { label: 'Round', description: 'Equal width & length' },
  { label: 'Square', description: 'Strong jaw, defined angles' },
  { label: 'Heart', description: 'Wide forehead, narrow chin' },
  { label: 'Diamond', description: 'Wide cheekbones, narrow top & bottom' },
  { label: 'Oblong', description: 'Longer face, high forehead' },
];

const PALETTE_OPTIONS = [
  { label: 'Neutrals', colors: ['#F5F5F5', '#E5E5E5', '#404040', '#171717'] },
  { label: 'Earth Tones', colors: ['#8e4925', '#54433c', '#A89F91', '#606C38'] },
  { label: 'Bold', colors: ['#B91C1C', '#1E3A8A', '#F59E0B', '#047857'] },
  { label: 'Pastels', colors: ['#FFD1DC', '#E0BBE4', '#957DAD', '#D4F0F0'] },
];

const CLIMATE_OPTIONS = [
  { label: 'Hot', icon: Sun },
  { label: 'Warm', icon: Sunrise },
  { label: 'Cool', icon: Wind },
  { label: 'Cold', icon: Snowflake },
];

const STYLE_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBgY9BEv4EjGch1d6jZktemkFedZvfr0wy5ZmA6HwKy7b93MVDKH5F14wCNzh0zH55dkOvY6Vo7PauTdOcZlwCmMAB3QHC5VQfPHkEL9dShGFany7DL635mP1D61bLeXa9j70w9hxfOuEBVck9-zDEUFZ__IAr-wyq-LolULE4i5beE3j7CvcDXqNw2-j0f6HR0THNNHG3LMFVloGVRzW3Vp9oh1JVuBJEk0A-njUIU9zgtLF9ZapDINvjmXyQSqc3AEdJR8n2C-4A';

// ─── Shared step header ───────────────────────────────────────────────────────

function StepHeader({
  displayStep,
  total,
  displayProgress,
  onBack,
}: {
  displayStep: number;
  total: number;
  displayProgress: number;
  onBack: () => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#ffeade] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-[#54433c]" />
        </button>
        <span className="font-serif text-[20px] text-[#8e4925]">TheThinker</span>
        <div className="w-9" />
      </div>
      <div className="w-full h-1 bg-[#ffeade] overflow-hidden mb-2">
        <div
          className="h-full bg-[#8e4925] transition-all duration-700 ease-in-out"
          style={{ width: `${displayProgress}%` }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[12px] text-[#87736b]">Personalizing Profile</span>
        <span className="text-[12px] text-[#8e4925] font-bold">
          Step {displayStep} of {total}
        </span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    style: '',
    occasions: [],
    inspiration: [],
    skinTone: '',
    bodyShape: '',
    height: '',
    faceShape: '',
    palette: '',
    location: '',
    climate: '',
  });
  const [showBodyGuide, setShowBodyGuide] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);

  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDisplayProgress(progress), 30);
    return () => clearTimeout(id);
  }, [progress]);

  const canProceed = [
    answers.style !== '',
    answers.occasions.length > 0,
    answers.inspiration.length > 0,
    answers.skinTone !== '',
    answers.bodyShape !== '' && answers.height !== '',
    true, // face shape is optional
    answers.palette !== '',
    answers.location.trim() !== '', // location is required for weather-aware recommendations
  ][step];

  async function handleNext() {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      await savePreferences(buildPreferences(answers)).catch(() => {});
      navigate('/wardrobe');
    }
  }

  function handleBack() {
    if (step === 0) {
      token.clear();
      navigate('/login');
    } else {
      setStep((s) => s - 1);
    }
  }

  function toggleOccasion(label: string) {
    setAnswers((a) => ({
      ...a,
      occasions: a.occasions.includes(label)
        ? a.occasions.filter((o) => o !== label)
        : [...a.occasions, label],
    }));
  }

  function toggleInspiration(label: string) {
    setAnswers((a) => ({
      ...a,
      inspiration: a.inspiration.includes(label)
        ? a.inspiration.filter((i) => i !== label)
        : [...a.inspiration, label],
    }));
  }

  const headerProps = {
    displayStep: step + 1,
    total: TOTAL_STEPS,
    displayProgress,
    onBack: handleBack,
  };

  return (
    <div className="min-h-screen bg-[#fff8f5] flex flex-col items-center">
      {/* ── STEP 1: Style ─────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="w-full max-w-[480px] px-6 pt-8 pb-10">
          <StepHeader {...headerProps} />

          <h1 className="font-serif text-[30px] leading-[1.2] tracking-[-0.01em] text-[#28180d] mb-2">
            What's your style?
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-8">
            Choose the aesthetic that best describes your daily approach to fashion.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-10">
            {STYLE_OPTIONS.map(({ label, icon: Icon }) => {
              const selected = answers.style === label;
              return (
                <button
                  key={label}
                  onClick={() => setAnswers((a) => ({ ...a, style: label }))}
                  className={`relative flex flex-col items-start p-5 rounded-xl transition-all duration-200 text-left active:scale-[0.98] shadow-[0_4px_12px_rgba(61,43,31,0.05)] ${
                    selected
                      ? 'border-2 border-[#8e4925] ring-2 ring-[#8e4925] bg-[#ffeade]'
                      : 'border border-transparent bg-[#fff1ea] hover:bg-[#ffeade]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#fbddca] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#8e4925]" />
                  </div>
                  <span className="text-[16px] font-medium text-[#54433c]">
                    {label}
                  </span>
                  {selected && (
                    <div className="absolute top-3 right-3">
                      <Check className="w-5 h-5 text-[#8e4925]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-10 shadow-sm">
            <img
              src={STYLE_IMG}
              alt="Fashion editorial"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#f2d4c2]/40 to-transparent" />
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STEP 2: Occasions ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="w-full max-w-[480px] px-6 py-10 flex flex-col min-h-screen">
          <StepHeader {...headerProps} />

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] mb-2">
            What do you dress for?
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-8">
            Select the occasions that define your weekly routine.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-10">
            {OCCASION_OPTIONS.map(({ label, description, img }) => {
              const selected = answers.occasions.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleOccasion(label)}
                  className={`flex flex-col p-4 rounded-xl border transition-all duration-200 text-left active:scale-[0.98] ${
                    selected
                      ? 'border-[#8e4925] bg-[#fbddca]'
                      : 'border-transparent bg-[#fff1ea] hover:border-[#d9c2b8]'
                  }`}
                >
                  <div className="h-32 w-full rounded-lg overflow-hidden mb-3">
                    <img src={img} alt={label} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[15px] font-semibold text-[#28180d]">
                      {label}
                    </span>
                    {selected && <Check className="w-4 h-4 text-[#8e4925] shrink-0" />}
                  </div>
                  <span className="text-[12px] text-[#54433c]">{description}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setStep((s) => s + 1)}
              className="w-full py-4 text-[#87736b] text-[15px] font-semibold rounded-xl hover:text-[#54433c] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Inspiration ───────────────────────────────────────────── */}
      {step === 2 && (
        <div className="w-full max-w-[480px] px-6 py-10 flex flex-col min-h-screen">
          <StepHeader {...headerProps} />

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] mb-2">
            What inspires you?
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-8">
            Select outfit aesthetics that resonate with you. Pick as many as you like.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-10">
            {INSPIRATION_OPTIONS.map(({ label, description, img, bg }) => {
              const selected = answers.inspiration.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleInspiration(label)}
                  className={`flex flex-col p-4 rounded-xl border transition-all duration-200 text-left active:scale-[0.98] ${
                    selected
                      ? 'border-[#8e4925] bg-[#fbddca]'
                      : 'border-transparent bg-[#fff1ea] hover:border-[#d9c2b8]'
                  }`}
                >
                  <div
                    className="h-28 w-full rounded-lg overflow-hidden mb-3 flex items-center justify-center"
                    style={{ backgroundColor: bg }}
                  >
                    <img
                      src={img}
                      alt={label}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[15px] font-semibold text-[#28180d]">
                      {label}
                    </span>
                    {selected && <Check className="w-4 h-4 text-[#8e4925] shrink-0" />}
                  </div>
                  <span className="text-[12px] text-[#54433c]">{description}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setStep((s) => s + 1)}
              className="w-full py-4 text-[#87736b] text-[15px] font-semibold rounded-xl hover:text-[#54433c] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Skin Tone ─────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="w-full max-w-[480px] px-6 py-10">
          <StepHeader {...headerProps} />

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] mb-2">
            Your skin tone
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-8">
            Helps us recommend colors and contrasts that flatter your natural
            complexion.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-10">
            {SKIN_TONE_OPTIONS.map(({ label, color, note }) => {
              const selected = answers.skinTone === label;
              return (
                <button
                  key={label}
                  onClick={() => setAnswers((a) => ({ ...a, skinTone: label }))}
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.98] ${
                    selected
                      ? 'border-[#8e4925] bg-[#ffeade]'
                      : 'border-transparent bg-[#fff1ea] hover:border-[#d9c2b8]'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-[#8e4925]" />
                    </div>
                  )}
                  <div
                    className="w-14 h-14 rounded-full mb-3 border-2 border-white shadow-md"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[13px] font-semibold text-[#28180d] text-center leading-tight">
                    {label}
                  </span>
                  <span className="text-[11px] text-[#87736b] text-center mt-0.5 leading-tight">
                    {note}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STEP 5: Body Profile ──────────────────────────────────────────── */}
      {step === 4 && (
        <div className="w-full max-w-[480px] px-6 py-10">
          <StepHeader {...headerProps} />

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] mb-2">
            Your body profile
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-4">
            Helps us recommend silhouettes and fits that work best for your shape.
          </p>

          {/* Body shape guide accordion */}
          <button
            onClick={() => setShowBodyGuide((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] text-[#8e4925] font-medium mb-5 hover:underline"
          >
            {showBodyGuide ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            How do I find my body shape?
          </button>

          {showBodyGuide && (
            <div className="mb-6 p-4 rounded-xl bg-[#fff1ea] border border-[#ffd4ba] text-[13px] text-[#54433c] space-y-1.5 leading-relaxed">
              <p className="font-semibold text-[#28180d]">Measure three key areas:</p>
              <p>
                • <strong>Shoulders</strong> — widest part of your upper body
              </p>
              <p>
                • <strong>Waist</strong> — narrowest part of your torso
              </p>
              <p>
                • <strong>Hips</strong> — widest part of your lower body
              </p>
              <p className="pt-1 text-[#87736b]">
                Compare the numbers to find your shape. If you're unsure, pick the
                closest match.
              </p>
            </div>
          )}

          {/* Body shape grid */}
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#87736b] mb-3">
            Body Shape
          </p>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {BODY_SHAPE_OPTIONS.map(({ label, description }) => {
              const selected = answers.bodyShape === label;
              return (
                <button
                  key={label}
                  onClick={() => setAnswers((a) => ({ ...a, bodyShape: label }))}
                  className={`relative flex flex-col p-3 rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${
                    selected
                      ? 'border-[#8e4925] bg-[#ffeade]'
                      : 'border-transparent bg-[#fff1ea] hover:border-[#d9c2b8]'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-3.5 h-3.5 text-[#8e4925]" />
                    </div>
                  )}
                  <span className="text-[13px] font-semibold text-[#28180d] leading-tight mb-1 pr-4">
                    {label}
                  </span>
                  <span className="text-[11px] text-[#87736b] leading-tight">
                    {description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Height */}
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#87736b] mb-3">
            Height
          </p>
          <div className="grid grid-cols-3 gap-3 mb-10">
            {HEIGHT_OPTIONS.map(({ label, description }) => {
              const selected = answers.height === label;
              return (
                <button
                  key={label}
                  onClick={() => setAnswers((a) => ({ ...a, height: label }))}
                  className={`relative flex flex-col p-4 rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${
                    selected
                      ? 'border-[#8e4925] bg-[#ffeade]'
                      : 'border-transparent bg-[#fff1ea] hover:border-[#d9c2b8]'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-3.5 h-3.5 text-[#8e4925]" />
                    </div>
                  )}
                  <span className="text-[14px] font-semibold text-[#28180d] mb-1 pr-4">
                    {label}
                  </span>
                  <span className="text-[11px] text-[#87736b] leading-tight">
                    {description}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STEP 6: Face Shape (optional) ────────────────────────────────── */}
      {step === 5 && (
        <div className="w-full max-w-[480px] px-6 py-10">
          <StepHeader {...headerProps} />

          <div className="flex items-start gap-3 mb-2">
            <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d]">
              Your face shape
            </h1>
            <span className="mt-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#8e4925] bg-[#ffeade] px-2 py-0.5 rounded-full">
              Optional
            </span>
          </div>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-8">
            Refines collar, neckline, and accessory recommendations. Tap to select or
            deselect.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-10">
            {FACE_SHAPE_OPTIONS.map(({ label, description }) => {
              const selected = answers.faceShape === label;
              return (
                <button
                  key={label}
                  onClick={() =>
                    setAnswers((a) => ({
                      ...a,
                      faceShape: a.faceShape === label ? '' : label,
                    }))
                  }
                  className={`relative flex flex-col p-3 rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${
                    selected
                      ? 'border-[#8e4925] bg-[#ffeade]'
                      : 'border-transparent bg-[#fff1ea] hover:border-[#d9c2b8]'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-3.5 h-3.5 text-[#8e4925]" />
                    </div>
                  )}
                  <span className="text-[13px] font-semibold text-[#28180d] leading-tight mb-1 pr-4">
                    {label}
                  </span>
                  <span className="text-[11px] text-[#87736b] leading-tight">
                    {description}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNext}
            className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-[#ac613b] transition-all active:scale-[0.98]"
          >
            {answers.faceShape ? 'Next' : 'Skip'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STEP 7: Color Palette ─────────────────────────────────────────── */}
      {step === 6 && (
        <div className="w-full max-w-[480px] px-6 py-10 flex flex-col min-h-screen">
          <StepHeader {...headerProps} />

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] mb-2">
            Your color vibe?
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-8">
            Select the palette that best reflects your personal aesthetic.
          </p>

          <div className="flex flex-col gap-4 mb-10">
            {PALETTE_OPTIONS.map(({ label, colors }) => {
              const selected = answers.palette === label;
              return (
                <button
                  key={label}
                  onClick={() => setAnswers((a) => ({ ...a, palette: label }))}
                  className={`p-5 rounded-xl text-left transition-all duration-200 border-2 shadow-[0_4px_12px_rgba(61,43,31,0.05)] active:scale-[0.98] ${
                    selected
                      ? 'border-[#8e4925] bg-[#fbddca]'
                      : 'border-transparent bg-[#fff1ea] hover:border-[#d9c2b8]'
                  }`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[14px] font-medium text-[#28180d]">
                      {label}
                    </span>
                    {selected && <Check className="w-4 h-4 text-[#8e4925]" />}
                  </div>
                  <div className="flex gap-2">
                    {colors.map((color) => (
                      <div
                        key={color}
                        className="w-10 h-10 rounded-full border border-[#d9c2b8]"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-auto">
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 8: Location & Climate ────────────────────────────────────── */}
      {step === 7 && (
        <div className="w-full max-w-[480px] px-6 py-10 flex flex-col">
          <StepHeader {...headerProps} />

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] text-center mb-4">
            Where are you based?
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] text-center mb-8 opacity-80">
            We'll use this for daily weather-based outfit recommendations tailored to
            your local forecast.
          </p>

          {/* Location input */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#87736b]">
                City or Region
              </p>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8e4925] bg-[#ffeade] px-2 py-0.5 rounded-full">
                Required
              </span>
            </div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#87736b]" />
              <input
                type="text"
                value={answers.location}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, location: e.target.value }))
                }
                placeholder="e.g. New York, London, Tokyo"
                aria-required="true"
                aria-invalid={answers.location.trim() === ''}
                className={`w-full pl-10 pr-4 py-3.5 rounded-xl bg-[#fff1ea] border text-[15px] text-[#28180d] placeholder:text-[#b8a49a] focus:outline-none transition-colors ${
                  locationTouched && answers.location.trim() === ''
                    ? 'border-[#c0392b] focus:border-[#c0392b]'
                    : 'border-[#d9c2b8] focus:border-[#8e4925]'
                }`}
                onBlur={() => setLocationTouched(true)}
              />
            </div>
            {locationTouched && answers.location.trim() === '' && (
              <p className="mt-2 text-[12px] text-[#c0392b]">
                Please enter your city or region — it's required for weather-based
                recommendations.
              </p>
            )}
          </div>

          {/* Climate */}
          <div className="mb-10">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#87736b] mb-3">
              Typical Climate
            </p>
            <div className="grid grid-cols-4 gap-3">
              {CLIMATE_OPTIONS.map(({ label, icon: Icon }) => {
                const selected = answers.climate === label;
                return (
                  <button
                    key={label}
                    onClick={() =>
                      setAnswers((a) => ({
                        ...a,
                        climate: a.climate === label ? '' : label,
                      }))
                    }
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.98] ${
                      selected
                        ? 'border-[#8e4925] bg-[#ffeade]'
                        : 'border-[#d9c2b8] bg-[#fff1ea] hover:shadow-sm'
                    }`}
                  >
                    <Icon className="w-6 h-6 text-[#8e4925] mb-2" />
                    <span className="text-[13px] font-semibold text-[#28180d]">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pb-8">
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl shadow-sm hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Get Started
            </button>
            <p className="mt-4 text-center text-[12px] text-[#54433c]">
              You can update your location anytime in Settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
