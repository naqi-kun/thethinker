import { Shirt } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen-safe bg-background">
      <div className="container-app py-12">

        <header className="mb-12 text-center">
          <span className="badge-primary mb-4 inline-flex items-center gap-1.5">
            <Shirt className="h-3.5 w-3.5" />
            Design System Preview
          </span>
          <h1 className="mb-3">TheThinker</h1>
          <p className="text-muted-foreground">
            Your warm &amp; earthy outfit recommendation companion.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-4">Color Palette</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { name: 'Cream',      bg: 'bg-cream',      text: 'text-espresso', hex: '#FFFAF5' },
              { name: 'Linen',      bg: 'bg-linen',      text: 'text-espresso', hex: '#F0E4D6' },
              { name: 'Sand',       bg: 'bg-sand',       text: 'text-espresso', hex: '#D4BDA8' },
              { name: 'Terracotta', bg: 'bg-terracotta', text: 'text-cream',    hex: '#C1714A' },
              { name: 'Rust',       bg: 'bg-rust',       text: 'text-cream',    hex: '#8B4E2F' },
              { name: 'Espresso',   bg: 'bg-espresso',   text: 'text-cream',    hex: '#3D2B1F' },
            ].map(({ name, bg, text, hex }) => (
              <div key={name} className={`${bg} ${text} rounded-lg p-3 text-center`}>
                <p className="text-xs font-semibold">{name}</p>
                <p className="font-mono text-xs opacity-70">{hex}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card mb-10 p-6">
          <h2 className="mb-6">Typography</h2>
          <h1>Outfit of the Day</h1>
          <h2>Style Recommendations</h2>
          <h3>Your Wardrobe</h3>
          <h4>Recent Outfits</h4>
          <h5>Filter by Season</h5>
          <h6>Sort Options</h6>
          <p className="mt-2">
            Dress thoughtfully. Build a wardrobe that reflects who you are—one outfit at a time.
          </p>
          <p className="text-gradient mt-2 font-serif text-xl">Warm tones for warm days.</p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary btn-md">Save Outfit</button>
            <button className="btn-secondary btn-md">View Details</button>
            <button className="btn-outline btn-md">Edit</button>
            <button className="btn-ghost btn-md">Cancel</button>
            <button className="btn-link btn-md">Learn more</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="btn-primary btn-sm">Small</button>
            <button className="btn-primary btn-md">Medium</button>
            <button className="btn-primary btn-lg">Large</button>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <span className="badge-default">Default</span>
            <span className="badge-primary">Primary</span>
            <span className="badge-accent">Accent</span>
            <span className="badge-success">Success</span>
            <span className="badge-warning">Warning</span>
            <span className="badge-outline">Outline</span>
            <span className="badge-clean">Clean</span>
            <span className="badge-dirty">Needs Wash</span>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4">Cards</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <h5 className="mb-1">Default Card</h5>
              <p className="text-sm text-muted-foreground">Subtle shadow, sand border.</p>
            </div>
            <div className="card-elevated p-4">
              <h5 className="mb-1">Elevated Card</h5>
              <p className="text-sm text-muted-foreground">Strong shadow, hover lift.</p>
            </div>
            <div className="card-interactive p-4">
              <h5 className="mb-1">Interactive Card</h5>
              <p className="text-sm text-muted-foreground">Hover for terracotta border.</p>
            </div>
          </div>
        </section>

      </div>
    </main>
  )
}
