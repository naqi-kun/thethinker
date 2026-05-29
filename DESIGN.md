# TheThinker Design System

A warm & earthy mobile-first outfit recommendation app.

---

## Color Palette

### Brand Colors

| Token | Variable | Hex | Usage |
|-------|----------|-----|-------|
| Cream | `--cream` | `#FFFAF5` | Page background |
| Linen | `--linen` | `#F0E4D6` | Cards, secondary backgrounds |
| Sand | `--sand` | `#D4BDA8` | Borders, muted accents |
| Terracotta | `--terracotta` | `#C1714A` | Primary actions, CTAs |
| Rust | `--rust` | `#8B4E2F` | Hover states, accent |
| Espresso | `--espresso` | `#3D2B1F` | Text, headings |

Tailwind utilities auto-generated: `bg-cream`, `text-terracotta`, `border-sand`, etc.

### Semantic Tokens

| Token | Maps to | Usage |
|-------|---------|-------|
| `--background` | Cream | Page background |
| `--foreground` | Espresso | Body text |
| `--primary` | Terracotta | Primary interactive elements |
| `--primary-foreground` | Cream | Text on primary elements |
| `--secondary` | Linen | Secondary actions, card fills |
| `--muted` | Linen | Disabled states, placeholder backgrounds |
| `--muted-foreground` | Rust | Placeholder and subtle text |
| `--accent` | Rust | Accent highlights |
| `--border` | Sand | All borders |
| `--ring` | Terracotta | Focus rings |

### Status Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#4A8B5C` | Confirmed, clean garments |
| `--warning` | `#D4A03C` | Caution, dirty garments |
| `--destructive` | `#D93025` | Errors, danger actions |
| `--info` | `#5A8BC1` | Informational messages |

---

## Typography

Fonts are loaded via Google Fonts `<link>` tags in `index.html`.

| Role | Font | Tailwind Class | Variable |
|------|------|----------------|----------|
| Headings | DM Serif Display | `font-serif` | `--font-serif` |
| Body / UI | DM Sans | `font-sans` | `--font-sans` |
| Code | System monospace | `font-mono` | — |

### Heading Scale

Heading defaults are set globally in `frontend/src/app/styles.css` `@layer base` — no extra classes needed.

| Element | Default Classes | Size |
|---------|----------------|------|
| `<h1>` | `font-serif text-4xl md:text-5xl font-normal tracking-tight` | 36–48px |
| `<h2>` | `font-serif text-3xl md:text-4xl font-normal tracking-tight` | 30–36px |
| `<h3>` | `font-serif text-2xl md:text-3xl font-normal` | 24–30px |
| `<h4>` | `font-serif text-xl md:text-2xl font-normal` | 20–24px |
| `<h5>` | `font-sans text-lg font-semibold` | 18px |
| `<h6>` | `font-sans text-base font-semibold` | 16px |
| `<p>` | `font-sans text-base leading-relaxed` | 16px |
| `<small>` | `font-sans text-sm` | 14px |

---

## Spacing

Custom CSS variables for consistent spacing. Use with `style={{ padding: 'var(--space-md)' }}` or via standard Tailwind classes.

| Variable | Value | Tailwind Equivalent |
|----------|-------|---------------------|
| `--space-xs` | `0.25rem` | `p-1` / `gap-1` |
| `--space-sm` | `0.5rem` | `p-2` / `gap-2` |
| `--space-md` | `1rem` | `p-4` / `gap-4` |
| `--space-lg` | `1.5rem` | `p-6` / `gap-6` |
| `--space-xl` | `2rem` | `p-8` / `gap-8` |
| `--space-2xl` | `3rem` | `p-12` / `gap-12` |
| `--space-3xl` | `4rem` | `p-16` / `gap-16` |

---

## Border Radius

| Variable | Value | Used for |
|----------|-------|----------|
| `--radius-input` | `6px` | Form inputs, selects |
| `--radius-button` | `12px` | Buttons |
| `--radius-card` | `12px` | Cards, panels |
| `--radius-modal` | `20px` | Modals, dialogs |
| `--radius-pill` | `9999px` | Badges, pills, progress |

Tailwind v4 aliases: `rounded-sm` (input) · `rounded-md` (button) · `rounded-lg` (card) · `rounded-xl` (modal) · `rounded-full` (pill)

---

## Button Variants

Defined in `@layer components` inside `frontend/src/app/styles.css`. Combine a **variant** class with a **size** class.

### Variants

| Class | Appearance | When to use |
|-------|-----------|-------------|
| `btn-primary` | Terracotta bg, cream text | Primary CTA ("Save Outfit") |
| `btn-secondary` | Linen bg, espresso text, sand border | Secondary action |
| `btn-outline` | Transparent, terracotta border | Alternate CTA |
| `btn-ghost` | Transparent, hover linen bg | Subtle / icon actions |
| `btn-link` | Transparent, terracotta text + underline | Inline links |

### Sizes

| Class | Height | Padding |
|-------|--------|---------|
| `btn-sm` | `h-9` (36px) | `px-4` |
| `btn-md` | `h-11` (44px) | `px-6` |
| `btn-lg` | `h-14` (56px) | `px-8` |
| `btn-icon` | `h-11 w-11` | None (square) |

```html
<button class="btn-primary btn-md">Save Outfit</button>
<button class="btn-outline btn-sm">View Details</button>
<button class="btn-ghost btn-icon"><IconComponent /></button>
```

---

## Badge Styles

Pill-shaped labels defined in `@layer components`. All badges share base padding `px-3 py-1` and `text-xs font-medium`.

| Class | Appearance | Use case |
|-------|-----------|----------|
| `badge-default` | Linen bg | Generic tag |
| `badge-primary` | Terracotta bg, cream text | Active, selected, new |
| `badge-accent` | Rust bg, cream text | Featured |
| `badge-success` | Green bg | Confirmed |
| `badge-warning` | Gold bg | Caution |
| `badge-outline` | Transparent, sand border | Neutral / inactive |
| `badge-clean` | Green tint bg, green border | Garment is clean |
| `badge-dirty` | Gold tint bg, gold border | Garment needs washing |

```html
<span class="badge-clean">Clean</span>
<span class="badge-dirty">Needs Wash</span>
<span class="badge-primary">New</span>
```

---

## Card Styles

| Class | Appearance | Use case |
|-------|-----------|----------|
| `card` | Linen bg, sand border, small shadow | Standard content container |
| `card-elevated` | Linen bg, large shadow, hover lift | Featured / hero content |
| `card-interactive` | Linen bg, hover terracotta border + shadow | Clickable outfit / garment tiles |

```html
<div class="card p-4">...</div>
<div class="card-interactive p-4 cursor-pointer" onClick={...}>...</div>
```

---

## Form Elements

| Class | Element |
|-------|---------|
| `input` | Text input (h-11, 6px radius) |
| `input-error` | Input with destructive border/ring |
| `textarea` | Multiline input (min-h-120px) |
| `select` | Dropdown with chevron arrow |
| `label` | Field label (`text-sm font-medium`) |
| `helper-text` | Hint below field (`text-muted-foreground`) |
| `error-text` | Error message (`text-destructive`) |
| `checkbox` | Checkbox with terracotta checked state |
| `radio` | Radio with terracotta checked state |

---

## Utility Classes

| Class | Purpose |
|-------|---------|
| `text-gradient` | Terracotta → Rust horizontal gradient text |
| `container-app` | Mobile-first centered container (`max-w-lg`, `px-4`) |
| `min-h-screen-safe` | `100dvh` — accounts for mobile browser chrome |
| `h-screen-safe` | Fixed `100dvh` height |
| `safe-area-top` | Padding for iOS notch / Dynamic Island |
| `safe-area-bottom` | Padding for iOS home indicator bar |

---

## Dark Mode

Add `class="dark"` to `<html>` to activate. Uses a warm dark palette.

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#FFFAF5` Cream | `#2A1F17` |
| `--foreground` | `#3D2B1F` Espresso | `#F0E4D6` Linen |
| `--card` | `#F0E4D6` Linen | `#3D2B1F` Espresso |
| `--primary` | `#C1714A` Terracotta | `#C1714A` Terracotta (unchanged) |
| `--muted-foreground` | `#8B4E2F` Rust | `#D4BDA8` Sand |
| `--border` | `#D4BDA8` Sand | `#5A4235` |

---

## File Structure

```
frontend/
  index.html               ← Vite entry — Google Fonts <link> tags live here
  vite.config.ts           ← @tailwindcss/vite plugin configured here
  components.json          ← shadcn/ui config (style: new-york, css: src/app/styles.css)
  src/
    main.tsx               ← App entry — imports styles.css, wraps with BrowserRouter
    app/
      styles.css           ← Design tokens, component classes, utilities (Tailwind v4)
      App.tsx              ← Route definitions
    features/              ← Vertical slices (auth, onboarding, wardrobe, …)
    shared/
      utils/cn.ts          ← cn() helper (clsx + tailwind-merge)
```

## Adding shadcn Components

With the design system in place, install shadcn components via:

```bash
npx shadcn add button
npx shadcn add card
npx shadcn add input
```

shadcn reads `components.json` and places files in `components/ui/`. The components automatically use your CSS variables (`--primary`, `--border`, etc.).

---

## App-Specific Patterns

How the design system tokens map to each screen in TheThinker.

---

### Screen 1 — Login

**Goal:** Simple, warm entry point. Minimal friction.

| Element | Token / Class | Notes |
|---------|--------------|-------|
| Page background | `bg-background` (Cream) | Full-screen warm white |
| App name | `font-serif text-4xl text-espresso` | DM Serif Display heading |
| Tagline | `font-sans text-muted-foreground` | Rust-toned subtext |
| Email / Password fields | `input` | 6px radius, sand border |
| Sign In button | `btn-primary btn-lg w-full` | Full-width terracotta |
| "Sign up" link | `btn-link` | Inline terracotta text |

```html
<h1>TheThinker</h1>
<p class="text-muted-foreground">Dress for every moment.</p>
<input class="input" type="email" placeholder="Email" />
<input class="input" type="password" placeholder="Password" />
<button class="btn-primary btn-lg w-full">Sign In</button>
<button class="btn-link">Don't have an account? Sign up</button>
```

---

### Screen 2 — Personalized Questions (Onboarding)

**Goal:** Learn the user's style in a friendly, step-by-step flow.

| Element | Token / Class | Notes |
|---------|--------------|-------|
| Step progress | `progress-bar` + `progress-fill` | Shows how many questions remain |
| Step label | `font-sans text-sm text-muted-foreground` | "Step 2 of 5" |
| Question | `font-serif text-2xl text-espresso` | DM Serif Display |
| Option card | `card-interactive p-4` | Tappable choice cards |
| Selected option | `border-primary bg-primary/10` | Terracotta highlight |
| Selected badge | `badge-primary` | Confirms selection |
| Next button | `btn-primary btn-md` | Disabled until option chosen |
| Skip link | `btn-ghost btn-sm` | Low-emphasis escape |

```html
<div class="progress-bar"><div class="progress-fill" style="width: 40%"></div></div>
<p class="text-muted-foreground text-sm">Step 2 of 5</p>
<h3>What's your go-to style?</h3>
<div class="card-interactive p-4">Casual & Relaxed</div>
<div class="card-interactive p-4 border-primary bg-primary/10">
  Smart Casual <span class="badge-primary ml-2">Selected</span>
</div>
<button class="btn-primary btn-md">Next</button>
```

---

### Screen 3 — Clothes Status

**Goal:** Let users mark each garment as clean or dirty so the app only recommends wearable items.

| Element | Token / Class | Notes |
|---------|--------------|-------|
| Garment card | `card-interactive p-4` | Tappable, shows item photo + name |
| Clean status | `badge-clean` | Green tint — safe to recommend |
| Dirty status | `badge-dirty` | Gold tint — excluded from recommendations |
| Status toggle | `btn-outline btn-sm` | Toggle between Clean / Dirty |
| Section heading | `font-serif text-2xl` | "My Wardrobe" |
| Item count | `badge-default` | "12 items · 8 clean" |

```html
<h2>My Wardrobe</h2>
<span class="badge-default">12 items · 8 clean</span>

<!-- Garment card -->
<div class="card-interactive p-4 flex items-center gap-4">
  <img class="avatar-lg rounded-md" src="..." />
  <div>
    <h5>White Linen Shirt</h5>
    <span class="badge-clean">Clean</span>
  </div>
  <button class="btn-outline btn-sm ml-auto">Mark Dirty</button>
</div>
```

**Status color logic:**

| State | Badge | Background tint | Meaning |
|-------|-------|----------------|---------|
| Clean | `badge-clean` | `bg-success/15` | Will appear in recommendations |
| Dirty | `badge-dirty` | `bg-warning/15` | Hidden from recommendations |

---

### Screen 4 — Scan Wardrobe

**Goal:** Add new garments by photographing them.

| Element | Token / Class | Notes |
|---------|--------------|-------|
| Scan frame / overlay | `border-2 border-primary rounded-xl` | Terracotta viewfinder border |
| Instruction text | `font-sans text-sm text-muted-foreground` | Below the camera frame |
| Capture button | `btn-primary btn-icon` | Large circular button |
| Cancel | `btn-ghost btn-sm` | Low-emphasis exit |
| Detected item card | `card-elevated p-4` | Pops up after scan with detected details |
| Confirm badge | `badge-success` | "Item detected" |
| Save button | `btn-primary btn-md w-full` | "Add to Wardrobe" |

```html
<!-- After scan: item preview -->
<div class="card-elevated p-4">
  <span class="badge-success mb-2">Item detected</span>
  <h5>Blue Denim Jacket</h5>
  <p class="helper-text">Category: Outerwear</p>
  <button class="btn-primary btn-md w-full mt-4">Add to Wardrobe</button>
  <button class="btn-ghost btn-md w-full mt-2">Scan Again</button>
</div>
```

---

### Screen 5 — Outfit Recommendation

**Goal:** Show a curated outfit based on the user's calendar event and available clean garments.

| Element | Token / Class | Notes |
|---------|--------------|-------|
| Event banner | `bg-linen border border-border rounded-lg p-3` | Shows the upcoming event |
| Event label | `badge-accent` | Event type (e.g. "Work Meeting") |
| Event name | `font-sans font-semibold text-espresso` | Calendar event title |
| Outfit card | `card-elevated p-4` | Hero card for the recommended outfit |
| "Recommended" tag | `badge-primary` | Highlights AI pick |
| Garment chips | `badge-default` | Lists each piece (shirt, trousers, shoes) |
| Accept button | `btn-primary btn-lg w-full` | "Wear This Today" |
| See more button | `btn-secondary btn-md w-full` | "Show Other Options" |
| Clean indicator | `badge-clean` (small) | Confirms each item is clean |

```html
<!-- Event context -->
<div class="bg-linen rounded-lg border p-3 flex items-center gap-3">
  <span class="badge-accent">Work Meeting</span>
  <p class="font-semibold text-espresso">Design Review — 10:00 AM</p>
</div>

<!-- Outfit recommendation -->
<div class="card-elevated p-5 mt-4">
  <span class="badge-primary mb-3">Recommended for you</span>
  <h3>Smart Casual Look</h3>
  <div class="flex gap-2 flex-wrap mt-2">
    <span class="badge-default">White Linen Shirt <span class="badge-clean ml-1">✓</span></span>
    <span class="badge-default">Charcoal Trousers <span class="badge-clean ml-1">✓</span></span>
    <span class="badge-default">White Sneakers <span class="badge-clean ml-1">✓</span></span>
  </div>
  <button class="btn-primary btn-lg w-full mt-5">Wear This Today</button>
  <button class="btn-secondary btn-md w-full mt-2">Show Other Options</button>
</div>
```

---

### Design Decisions Summary

| Decision | Rationale |
|----------|-----------|
| Terracotta as primary | Warm and actionable — draws attention without aggression |
| Linen for cards | Slightly off-white creates warmth vs. a stark white card |
| Sand for borders | Soft separation — doesn't compete with content |
| DM Serif Display for headings only | Adds editorial character; body stays readable with DM Sans |
| badge-clean / badge-dirty in success/warning | Leverages intuitive color meaning (green = safe, gold = caution) |
| card-interactive for garments | Signals tappability; hover border in terracotta reinforces primary brand color |
| Mobile-first max-w-lg container | App is primarily used on-the-go while getting dressed |
