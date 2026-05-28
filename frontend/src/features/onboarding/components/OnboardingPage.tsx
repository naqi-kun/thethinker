import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { token } from '../../../shared/api/token';
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
} from 'lucide-react';

type Answers = {
  style: string;
  occasions: string[];
  palette: string;
  climate: string;
};

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

const CLIMATE_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBQY5Kp7GItOiUt6jWhvPyLQMOlbA0SL-mPZuAaPmTBOt47L3TYjGwk93-Ik0PjarNkG3_KiwO9RQRAqvGTJU8bVCUGyOQQE4B_9fwf3mgpV_3xkWWdW3B3iJd1begrfzKxK3mG7raPRJMXmhqMtHxtzzPlDnLRF-sKSR38w0WMT1rUpPVnhoSRyICbJRhm52i0AUpex4_VymcDduTy5StLmHTBgdScfDLEGI1Jb_idcYIm-jzxNjyV7Oapii9rPtI7eCpwE_wojYE';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    style: '',
    occasions: [],
    palette: '',
    climate: '',
  });

  const progress = ((step + 1) / 4) * 100;

  const canProceed = [
    answers.style !== '',
    answers.occasions.length > 0,
    answers.palette !== '',
    answers.climate !== '',
  ][step];

  function handleNext() {
    if (step < 3) {
      setStep((s) => s + 1);
    } else {
      // TODO: POST answers to /api/users/me/preferences
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

  return (
    <div className="min-h-screen bg-[#fff8f5] flex flex-col items-center">
      {/* ── STEP 1: Style preference ── */}
      {step === 0 && (
        <div className="w-full max-w-[480px] px-6 pt-8 pb-10">
          <div className="h-1 w-full bg-[#d9c2b8] mb-10">
            <div
              className="h-1 bg-[#8e4925] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

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
                  <div className="w-10 h-10 rounded-full bg-[#fbddca] flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
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

      {/* ── STEP 2: Occasions (multi-select) ── */}
      {step === 1 && (
        <div className="w-full max-w-[480px] px-6 py-10 flex flex-col min-h-screen">
          <header className="flex flex-col items-center gap-4 mb-10">
            <span className="font-serif text-[24px] text-[#8e4925]">TheThinker</span>
            <div className="w-full h-1 bg-[#fbddca] overflow-hidden">
              <div
                className="h-full bg-[#8e4925] transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="w-full flex justify-between">
              <span className="text-[12px] text-[#87736b]">Personalizing Profile</span>
              <span className="text-[12px] text-[#8e4925] font-bold">Step 2 of 4</span>
            </div>
          </header>

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] mb-2">
            What do you dress for?
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-8">
            Select the occasions that define your weekly routine so we can tailor your
            daily suggestions.
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
              className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(142,73,37,0.15)] hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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

          <footer className="mt-10 text-center">
            <p className="text-[12px] text-[#87736b] italic">
              "Style is a way to say who you are without having to speak."
            </p>
          </footer>
        </div>
      )}

      {/* ── STEP 3: Color palette ── */}
      {step === 2 && (
        <div className="w-full max-w-[480px] px-6 pt-10 pb-10 flex flex-col min-h-screen">
          <header className="flex justify-between items-center mb-8">
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffeade] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#54433c]" />
            </button>
            <span className="font-serif text-[20px] text-[#8e4925]">TheThinker</span>
            <div className="w-10" />
          </header>

          <div className="w-full h-1 bg-[#ffe3d2] overflow-hidden mb-2">
            <div
              className="h-full bg-[#8e4925] transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-end mb-8">
            <span className="text-[12px] text-[#54433c]">Step 3 of 4</span>
          </div>

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] mb-2">
            Your color vibe?
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] mb-8">
            Select the palette that best reflects your personal aesthetic and the moods
            you want to project.
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

          <div className="mt-auto pt-8">
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full py-4 bg-[#8e4925] text-white text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#8e4925]/10 hover:bg-[#ac613b] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-center mt-6 text-[12px] text-[#54433c]">
              Step 3 of 4: Refining your aesthetic
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 4: Climate ── */}
      {step === 3 && (
        <div className="w-full max-w-[480px] px-6 py-10 flex flex-col">
          <header className="flex justify-center mb-10">
            <span className="font-serif text-[24px] text-[#8e4925]">TheThinker</span>
          </header>

          <div className="w-full mb-10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12px] text-[#54433c]">Step 4 of 4</span>
              <span className="text-[12px] text-[#8e4925] font-bold">100%</span>
            </div>
            <div className="h-1 bg-[#ffeade] w-full overflow-hidden">
              <div
                className="h-full bg-[#8e4925] transition-all duration-1000"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <h1 className="font-serif text-[30px] leading-[1.2] text-[#28180d] text-center mb-4">
            Where do you live?
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#54433c] text-center mb-8 opacity-80">
            This helps our AI recommend fabrics and layering strategies suited to your
            local environment.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {CLIMATE_OPTIONS.map(({ label, icon: Icon }) => {
              const selected = answers.climate === label;
              return (
                <button
                  key={label}
                  onClick={() => setAnswers((a) => ({ ...a, climate: label }))}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                    selected
                      ? 'border-[#8e4925] bg-[#fff1ea]'
                      : 'border-[#d9c2b8] bg-[#fff1ea] hover:shadow-sm'
                  }`}
                >
                  <Icon className="w-8 h-8 text-[#8e4925] mb-3" />
                  <span className="text-[15px] font-semibold text-[#28180d]">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-8 shadow-sm">
            <img
              src={CLIMATE_IMG}
              alt="Warm interior"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
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
              You can change your location settings anytime in the app.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
