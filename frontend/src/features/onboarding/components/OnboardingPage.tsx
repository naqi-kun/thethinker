import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check,
  Shirt, Star, Briefcase, Zap,
  Laptop, Coffee, Sparkles, Mountain,
  Circle, Leaf, Flame, Flower2,
  Sun, Thermometer, CloudRain, Snowflake,
} from 'lucide-react';

type Option = {
  label: string;
  description: string;
  icon: React.ElementType;
};

type Step = {
  question: string;
  hint: string;
  options: Option[];
};

const steps: Step[] = [
  {
    question: "What's your go-to style?",
    hint: 'This helps us understand your fashion personality.',
    options: [
      { label: 'Casual & Relaxed', description: 'Comfort comes first',       icon: Shirt     },
      { label: 'Smart Casual',     description: 'Polished but laid-back',    icon: Star      },
      { label: 'Formal',           description: 'Sharp and professional',    icon: Briefcase },
      { label: 'Sporty & Active',  description: 'Built to move',             icon: Zap       },
    ],
  },
  {
    question: 'What occasions do you mainly dress for?',
    hint: "We'll prioritize outfits that suit your lifestyle.",
    options: [
      { label: 'Work & Office',    description: 'Weekday professional looks',  icon: Laptop    },
      { label: 'Casual Outings',   description: 'Everyday errands & hangouts', icon: Coffee    },
      { label: 'Events & Dining',  description: 'Special occasions',           icon: Sparkles  },
      { label: 'Outdoor & Sport',  description: 'Active adventures',           icon: Mountain  },
    ],
  },
  {
    question: "What's your preferred color palette?",
    hint: 'Your recommendations will lean towards these tones.',
    options: [
      { label: 'Neutrals',      description: 'Black, white, and grey',  icon: Circle  },
      { label: 'Earth Tones',   description: 'Brown, beige, and olive', icon: Leaf    },
      { label: 'Bold & Bright', description: 'Vivid, standout colors',  icon: Flame   },
      { label: 'Soft Pastels',  description: 'Light, gentle tones',     icon: Flower2 },
    ],
  },
  {
    question: "What's your local climate like?",
    hint: 'This shapes the type of clothing we recommend.',
    options: [
      { label: 'Hot & Sunny',   description: 'Warm most of the year',   icon: Sun         },
      { label: 'Warm & Mild',   description: 'Comfortable year-round',  icon: Thermometer },
      { label: 'Cool & Rainy',  description: 'Layers and light jackets', icon: CloudRain  },
      { label: 'Cold & Wintry', description: 'Heavy layers essential',  icon: Snowflake   },
    ],
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(steps.length).fill(''));

  const step = steps[currentStep];
  const selected = answers[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  function selectOption(label: string) {
    const updated = [...answers];
    updated[currentStep] = label;
    setAnswers(updated);
  }

  function handleNext() {
    if (isLast) {
      // TODO: send answers to API, then go to wardrobe
      navigate('/wardrobe');
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (currentStep === 0) {
      navigate('/');
    } else {
      setCurrentStep((s) => s - 1);
    }
  }

  return (
    <div className="min-h-screen-safe bg-background">

      {/* Progress bar — fixed at top */}
      <div className="progress-bar fixed left-0 right-0 top-0 z-10 rounded-none">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="container-app py-16">

        {/* Header */}
        <div className="mb-8">
          <button onClick={handleBack} className="btn-ghost btn-sm mb-6 -ml-2 gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p className="mb-2 font-sans text-sm font-medium text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </p>
          <h2 className="mb-2">{step.question}</h2>
          <p className="helper-text">{step.hint}</p>
        </div>

        {/* Options */}
        <div className="mb-10 grid grid-cols-2 gap-3">
          {step.options.map(({ label, description, icon: Icon }) => {
            const isSelected = selected === label;
            return (
              <button
                key={label}
                onClick={() => selectOption(label)}
                className={`card-interactive flex flex-col items-start gap-3 p-4 text-left ${
                  isSelected ? 'border-primary bg-primary/10 shadow-md' : ''
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {isSelected
                    ? <Check className="h-4 w-4" />
                    : <Icon className="h-4 w-4" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Next */}
        <button
          onClick={handleNext}
          disabled={!selected}
          className="btn-primary btn-lg w-full"
        >
          {isLast ? 'Get Started' : 'Next'}
        </button>

      </div>
    </div>
  );
}
