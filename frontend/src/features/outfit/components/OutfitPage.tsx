import { useState } from 'react';
import { Briefcase, Check, RefreshCw, Sun } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';

type OutfitPiece = {
  name: string;
  size: 'large' | 'small';
  image: string;
};

type Outfit = {
  pieces: OutfitPiece[];
  tags: string[];
};

// To swap an image: find a photo on unsplash.com, right-click → Copy image address.
const outfits: Outfit[] = [
  {
    pieces: [
      {
        name: 'Structured Linen Shirt',
        size: 'large',
        image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800',
      },
      {
        name: 'Tailored Trousers',
        size: 'large',
        image: 'https://images.unsplash.com/photo-1594938374182-a57061dac3df?w=800',
      },
      {
        name: 'Cognac Loafers',
        size: 'small',
        image: 'https://images.unsplash.com/photo-1616406432452-07bc5938759d?w=500',
      },
      {
        name: 'Minimalist Timepiece',
        size: 'small',
        image: 'https://images.unsplash.com/photo-1655388643063-ce23f14ad35c?w=500',
      },
    ],
    tags: ['Minimalist', 'Workwear', 'Polished', 'Breathable'],
  },
  {
    pieces: [
      {
        name: 'White Oxford Shirt',
        size: 'large',
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
      },
      {
        name: 'Charcoal Chinos',
        size: 'large',
        image: 'https://images.unsplash.com/photo-1594938374182-a57061dac3df?w=800',
      },
      {
        name: 'White Sneakers',
        size: 'small',
        image: 'https://images.unsplash.com/photo-1616406432452-07bc5938759d?w=500',
      },
      {
        name: 'Leather Belt',
        size: 'small',
        image: 'https://images.unsplash.com/photo-1655388643063-ce23f14ad35c?w=500',
      },
    ],
    tags: ['Casual', 'Comfortable', 'Versatile', 'Light'],
  },
];

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export default function OutfitPage() {
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [accepted, setAccepted] = useState(false);

  const outfit = outfits[outfitIndex];
  const largePieces = outfit.pieces.filter((p) => p.size === 'large');
  const smallPieces = outfit.pieces.filter((p) => p.size === 'small');

  function shuffleOutfit() {
    setOutfitIndex((i) => (i + 1) % outfits.length);
  }

  return (
    <div className="min-h-screen-safe bg-background pb-28">
      <TopNav />

      <main className="mx-auto max-w-xl px-6 py-10">
        {/* Date heading */}
        <div className="mb-6 text-center">
          <h2 className="mb-3">{today}</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="badge-default gap-1.5">
              <Sun className="h-3.5 w-3.5 text-warning" />
              72°F · Sunny
            </span>
            <span className="badge-default gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-terracotta" />
              Client Meeting
            </span>
          </div>
        </div>

        {/* Outfit image grid card */}
        <div className="mb-6 rounded-xl border border-border bg-cream p-4">
          <div className="space-y-3">
            {largePieces.map((piece) => (
              <OutfitImage key={piece.name} piece={piece} />
            ))}
            <div className="grid grid-cols-2 gap-3">
              {smallPieces.map((piece) => (
                <OutfitImage key={piece.name} piece={piece} />
              ))}
            </div>
          </div>
        </div>

        {/* Shuffle */}
        <div className="mb-8 flex justify-center">
          <button onClick={shuffleOutfit} className="btn-outline btn-sm gap-2">
            <RefreshCw className="h-4 w-4" />
            Shuffle Outfit
          </button>
        </div>

        {/* Style notes */}
        <div className="mb-2">
          <h5 className="mb-3">Style Notes</h5>
          <div className="flex flex-wrap gap-2">
            {outfit.tags.map((tag) => (
              <span key={tag} className="badge-default">
                <span className="text-terracotta">#</span>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Sticky bottom action */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-xl px-6 py-4">
          <button
            onClick={() => setAccepted(true)}
            disabled={accepted}
            className="btn-primary btn-lg w-full gap-2"
          >
            {accepted ? 'Saved for today' : 'Wear This Today'}
            <Check className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OutfitImage({ piece }: { piece: OutfitPiece }) {
  const heightClass = piece.size === 'large' ? 'h-56' : 'h-36';
  return (
    <div className={`relative w-full overflow-hidden rounded-lg ${heightClass}`}>
      <img
        src={piece.image}
        alt={piece.name}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <span className="absolute bottom-3 left-3 rounded-full bg-cream/90 px-3 py-1 text-xs font-medium text-espresso shadow-sm backdrop-blur-sm">
        {piece.name}
      </span>
    </div>
  );
}
