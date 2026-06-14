# KAN-72 — UX Audit & Improvement Recommendations

**Status:** Audit complete — pending review & design decisions · **Date:** 2026-06-14 · **Owner:** Naqi

Audit of TheThinker's core user journeys, captured against the **actually-shipped
app** (real screens, not the `thethinker-design.pen` prototype). Method: drive the
running frontend with a seeded auth token and mocked API responses, screenshot each
step and its key states (empty / filled / validation / error), then cross-check
findings against the backend code.

Goal: make each flow feel intuitive and frictionless. Findings here feed the design
phase — **no redesign decisions are locked in this document.**

Flows:

1. [Onboarding](#1-onboarding) — ✅ audited
2. [Wardrobe scan / add](#2-wardrobe-scan--add) — ✅ audited
3. [Daily outfit recommendation](#3-daily-outfit-recommendation) — ✅ audited
4. [Calendar connection](#4-calendar-connection) — ✅ audited

Cross-cutting issues collected in [§5](#5-cross-cutting).

---

## 1. Onboarding

8-step wizard (`features/onboarding/components/OnboardingPage.tsx`), reached via a
`ProtectedRoute` right after registration.

**Step inventory:** 1) Style (required, single) · 2) Occasions (required, multi, has
Skip) · 3) Inspiration (required, multi, has Skip) · 4) Skin tone (required) · 5)
Body profile = body shape + height (both required) · 6) Face shape (optional) · 7)
Color palette (required) · 8) Location (required) + climate (optional).

### What works
- Visually polished and internally consistent; serif headings, good option
  descriptions/sub-labels, a progress bar + "Step X of 8".
- Helpful touches: the body-shape **guide accordion**, clear **Required/Optional**
  badges, location **validation** (red border + message), reassuring closing copy
  ("update anytime in Settings").

### Headline finding — collects ~11 inputs, the engine consumes ~1
Onboarding gathers style, occasions, inspiration, skin tone, body shape, height,
face shape, palette, location, climate. But tracing the recommendation path:

- `StartSession` (`infrastructure/external/ai/recommend_client.go`) sends the AI
  service **only wardrobe items** (id, sub_type, category, color, fit, season) —
  **no user profile at all**, so the Python stylist *cannot* use it.
- The rule-based fallback (`recommendation/service.go` → `ruleBasedOutfit`) uses only
  wardrobe items + weather + date.
- The only preference actually read in `service.go` is `use_ai` and `location`
  (for weather).

**So skin tone, body shape, face shape, palette, climate, occasions, and inspiration
are collected and stored but never consumed by recommendations today** — 6–7 screens
of (sometimes sensitive) questions with no payoff. This is the central
intuitiveness/trust problem and drives the redesign fork below.

### Other friction (ranked)
1. **Silent save failure** — at the end, `savePreferences(...).catch(() => {})` then
   navigates onward regardless (`OnboardingPage.tsx:231`). If the save fails, all 8
   steps are lost with zero feedback. Correctness/trust bug.
2. **Back on step 1 logs you out** — `handleBack` at step 0 clears the token
   (`:236`). The back arrow looks like in-flow nav but silently destroys the session;
   no confirmation.
3. **Design-system divergence** — onboarding is hardcoded to a different palette
   (`#fff8f5` / `#8e4925`) than the rest of the app (`--primary` terracotta,
   `.btn-primary`, `bg-card`). You land on Wardrobe and it looks like a different
   app. Also a maintenance smell (no design tokens).
4. **Inconsistent skip affordances** — steps 2 & 3 have "Skip for now"; 1, 4, 7 are
   hard-required; step 6 morphs "Skip/Next". No consistent rule and **no global
   "set up later" escape hatch** — a user who just wants to try the app must grind
   through most of it.
5. **Length / time-to-value** — 8 screens before seeing anything. Drop-off risk;
   works against the success criterion "a new user can complete onboarding without
   help."
6. **Fragile external images** — occasion cards use Google `aida-public` URLs (these
   expire) and inspiration uses Unsplash hotlinks; occasion has no `onError`
   fallback. (Mocked for capture — would render broken/empty if the URLs die.)
7. **Climate vs. location redundancy** — step 8 asks location *and* "typical
   climate," but location already drives the weather API.

### Prioritized recommendations
**Quick wins** (small, high value)
- Fix the silent save failure (surface an error / retry; don't lose input).
- Fix back-on-step-1 logging you out.
- Add a consistent skip model + a global "Skip for now / finish later."
- Replace the expiring image URLs / add fallbacks; drop the redundant climate
  question.

**Larger redesigns** (design-led)
- **Shorten + re-justify the flow** to what drives recommendations (see fork below).
- **Re-skin onboarding to the app's design system** so it matches the rest of the app.

### Redesign fork — Trim vs Upgrade
The headline finding forces a decision. Two directions:

#### Fork A — Trim onboarding to what's used
**Idea:** reduce the *required* flow to the inputs that change recommendations today
(style, occasions, location); drop or defer the rest; re-skin to the design system.

**Implementation (frontend-only):**
- `OnboardingPage.tsx`: cut from 8 `step` branches to ~3 (Style, Occasions,
  Location). `TOTAL_STEPS → 3`; shrink the `progress` + `canProceed` array.
- `onboarding/api.ts`: drop unused fields from `OnboardingAnswers`; `buildPreferences`
  already only meaningfully maps `styles` + `location`.
- Fix the adjacent bugs in the same pass (silent save, back-clears-token).
- Re-skin to tokens (`bg-background`, `.btn-primary`, …) as a sub-task.
- **Backend: none.** `PUT /users/me/preferences` takes `styles` + freeform `answers`
  + `use_ai`; sending fewer keys is fine. No OpenAPI change.
- Tests: trim/replace onboarding tests; add "completes in 3 steps, saves, handles
  save failure."

**Effort:** small–medium, frontend-only, low risk, reversible.
**Pros:** fast time-to-value, less drop-off, no collect-and-ignore, visually
consistent. **Cons:** drops the richer profile (unused anyway); re-introduce later if
you invest in personalization.

#### Fork B — Upgrade the recommender to consume the profile
**Idea:** make skin tone / body shape / palette / occasions actually drive
recommendations, so the rich onboarding earns its keep.

**Implementation (3 layers + a contract):**
- **Domain/model:** promote the freeform `answers` map into a typed `UserProfile`
  (skin_tone, body_shape, height, palette, occasions…) on the user domain; persist
  it (a migration if you want typed columns, or keep JSON and read it).
- **Recommendation service** (`recommendation/service.go`): load the profile and
  thread it into both paths.
  - *AI path:* extend the `StartSession` payload (`recommend_client.go` wire types +
    the Python `/recommend/start` Pydantic model) with the profile; update the
    **Python LangGraph stylist** prompt/logic to weight palette/skin-tone/body-shape.
    This is the real work — prompt design + validation.
  - *Rule path* (`rule_recommender.go`): add rules — bias colour toward the chosen
    palette, fits toward body shape, etc. Each is logic + tests.
- **Contract:** OpenAPI changes for `/recommend/start` (and possibly a typed
  preferences schema); regenerate `schema.d.ts`. Spec-first per team rule.
- **Coordination:** the Python/LangGraph owner implements the prompt/logic in lockstep.
- **Validation:** the hard part — proving a "skin-tone-aware" rec is *better* needs a
  golden set + manual review; risk of subjective/wrong output.

**Effort:** large, cross-service (Go + Python + contract), multi-ticket, uncertain
quality payoff. **Pros:** deep personalization; onboarding becomes meaningful; a real
differentiator. **Cons:** big, touches the AI service, quality hard to guarantee,
slows the intuitiveness win.

#### Suggested middle path
Trim the *required* flow to the 3 used inputs now (Fork A) — bank the intuitiveness
+ visual-consistency win and fix the bugs — while keeping the profile questions as an
**optional, clearly-labelled "enhance your style profile"** that can be wired into
the recommender later (Fork B) when/if you invest there. Avoids collect-and-ignore
(it's explicitly optional + future-facing) without blocking on the big backend work.

---

## 2. Wardrobe scan / add

Camera-first flow (`AddItemPage.tsx`): live camera → capture → preview → classify →
`ReviewItemPage.tsx` (edit AI result) → save. Gallery upload is the alternative entry.

**States captured:** live camera (synthetic feed), no-camera fallback, AI review form.

### What works
- On a real device, the camera view is clean and direct: a big square viewfinder,
  a primary **Capture** and a secondary **Upload from Gallery**.
- The review screen pre-fills every field from the AI result and auto-suggests a
  name from colour + type; the **"Snaps to: …"** colour helper is a nice touch.
- Matches the app's design system (unlike onboarding).

### Friction (ranked)
1. **Camera-first punishes desktop.** On any device without a camera (i.e. the
   desktop the team develops/demos on), the first thing shown is a large box reading
   **"Camera access denied or not available on this device,"** with the only usable
   action — **Upload from Gallery** — demoted to a secondary button below it. The
   primary visual is effectively an error. Should detect no-camera and lead with
   upload (or make upload co-equal on desktop).
2. **Review field mislabeled "Occasion."** The field is bound to `form.category`
   (`ClothingCategory`, the same `CATEGORIES` options the edit modal labels
   **"Category"**) but the review screen labels it **"Occasion"**
   (`ReviewItemPage.tsx:201`). A garment's category (top/bottom/shoes) is not an
   occasion — confusing and inconsistent with the modal.
3. **Heavy review form for "confirm a scan."** Six fields (Name, Occasion/Category,
   Type, Colour, Fit, Season) plus a **full hex colour wheel**. For confirming an AI
   result this is a lot of work; the colour wheel in particular is overkill for
   adjusting a garment colour (this is exactly what KAN-81's in-image colour
   sampling would streamline). Consider trusting the AI defaults and surfacing edits
   only where needed.
4. **Single overall AI-confidence %.** "AI Confidence: 86%" is one number for the
   whole result — the user can't tell *which* field the AI was unsure about, so the
   "review and adjust" ask is unfocused. Per-field confidence (or highlighting
   low-confidence fields) would direct attention.
5. **Two-request save with weak partial-failure handling.** `handleConfirm` calls
   `addItem` then `uploadItemImage`; if the item is created but the image upload
   fails, the user sees a generic "Failed to save item" and may retry — creating a
   duplicate item with no image.
6. **No manual-add path.** Only camera or upload; an item you can't photograph can't
   be added. (Note: KAN-70 is intentionally replacing "Add Manually" with "Upload
   Image", so this is partly by design — flag for awareness.)

### Prioritized recommendations
**Quick wins**
- Detect no-camera and lead with Upload (swap primary/secondary, soften the empty
  state copy).
- Relabel review "Occasion" → "Category" to match the rest of the app.
- Make image-upload failure recoverable (retry the upload without re-creating the
  item; or create item+image atomically).

**Larger**
- Streamline the review step (trust AI defaults; replace the colour wheel with
  in-image sampling per KAN-81; optionally per-field confidence).

## 3. Daily outfit recommendation

`OutfitPage.tsx`: an editorial flat-lay of the recommended items on a cream canvas,
with weather + occasion badges, today's schedule, hashtags, a Refresh, and the
"Wear This Today" CTA. Tapping an item opens a swap bottom sheet.

**States captured:** recommendation, swap sheet, empty wardrobe.

### What works
- The flat-lay presentation is distinctive and on-brand; weather + occasion badges
  give quick context; the **swap bottom sheet** is clean and filters to same-slot
  alternatives.
- The **empty-wardrobe** state is clear and actionable ("Add some clothes…" → Go to
  Wardrobe).
- Uses the design system consistently.

### Friction (ranked)
1. **No "why this outfit" — and the reasoning already exists but is discarded.** The
   success criterion "user understands *why* an outfit was recommended" isn't met:
   there's a weather/occasion badge but no rationale. Notably, the AI service returns
   a `reasoning` string that the Go client **parses and then drops** —
   `aiRecommendation.Reasoning` is never mapped into `AIRec`
   (`recommend_client.go`), so it never reaches the UI. Surfacing it (e.g. "Picked
   for a clear 22° work day") would directly satisfy the criterion with data we
   already have.
2. **Swap affordance isn't discoverable.** Items are tappable to swap, but on mobile
   there's no visual cue — only a desktop hover tooltip hints at it. This fails the
   criterion "user can identify how to swap an item without instruction." Add an
   explicit affordance (e.g. a small swap icon on each item, or a "tap an item to
   swap" hint).
3. **Hashtags are low-value.** "#top #bottom #shoes" are literal category names, not
   meaningful style tags; they read as noise next to the useful "#work". Either make
   them meaningful (style/colour/season) or drop them.
4. **Minor:** the "Today's Schedule" panel still renders in the empty-wardrobe state
   (events but no outfit), which is slightly incongruous.

### Prioritized recommendations
**Quick wins**
- Surface the AI `reasoning` (map it through `AIRec` → response → UI). High value,
  data already exists.
- Add a visible swap affordance on outfit items.
- Drop or upgrade the category hashtags.

## 4. Calendar connection

`CalendarPage.tsx` ("Sync Your Life"): add a calendar by **ICS URL**. A top generic
ICS form, plus Google/Apple "Connect" panels that expand into instructions + an ICS
paste field. Connected calendars list with a "Synced via …" badge.

**States captured:** empty, provider panel expanded, connected.

### What works
- Clear synced feedback ("✓ Synced via ICS" + remove), a strong **privacy note**,
  and good step-by-step provider instructions.
- Consistent with the design system.

### Friction (ranked)
1. **"Connect Google/Apple" implies OAuth but is a manual ICS-link paste.** Tapping
   "Connect Google Calendar" sets the expectation of a Google sign-in; instead the
   user must open Google settings, find the **"Secret address in iCal format,"** and
   paste it. Big mental-model mismatch and the single biggest friction point. (The
   legacy OAuth `connect`/`disconnect` endpoints exist but are "not implemented
   end-to-end" — so there is no OAuth today.) This is the gap behind the ticket's
   "OAuth flow" item.
2. **Redundant dual entry.** The top "Add via ICS URL" form and the provider
   "Connect" panels do the *same thing* (both `addCalendar` with an ICS URL); the
   panels just add instructions. Two overlapping paths for one action is confusing.
3. **High technical friction to obtain an ICS link.** Finding Google's secret iCal
   address is a fiddly, multi-step task most users won't complete — real drop-off
   risk. (Inherent to the ICS approach.)
4. **Connection→outfit value is asserted, not shown.** Copy says events "tailor each
   outfit," but there's no indication of *how* occasion context is derived/used.

### Prioritized recommendations
**Quick wins**
- Set honest expectations: relabel "Connect" (e.g. "Add via calendar link") or add a
  one-line "this pastes a calendar link, not a sign-in" so users aren't surprised.
- Merge the redundant top ICS form into the provider-guided panels (one path).

**Larger**
- **Real OAuth** (Google/Apple sign-in) — the proper fix for #1 and #3, but a
  significant backend + OAuth-app-registration effort (the stubbed endpoints are a
  starting point).

---

## 5. Cross-cutting

Themes that recur across flows:

- **Collect-and-ignore data (biggest theme).** Onboarding gathers a rich profile the
  recommender never consumes (§1). The product *asks* far more than it *uses* —
  erodes trust and inflates effort. Resolve via the Trim-vs-Upgrade fork (§1).
- **Design-system inconsistency.** Onboarding is hand-rolled in a different palette
  than the token-based rest of the app (§1.3). The hand-off from onboarding to
  Wardrobe feels like two products.
- **Silent error swallowing.** `.catch(() => {})` patterns hide failures from the
  user — onboarding's preference save (§1) is the worst case (loses all input
  silently). Audit other best-effort calls for the same anti-pattern.
- **Two-request saves with weak partial-failure handling.** Review-item
  (addItem → uploadImage, §2.5) and similar flows can half-succeed and prompt a
  retry that duplicates data.
- **Interaction discoverability on mobile.** Tap-to-swap on the outfit page relies on
  a desktop-only hover hint (§3.2); touch users get no cue.
- **External image CDNs.** Onboarding hotlinks Google `aida-public` (ephemeral) and
  Unsplash images with inconsistent fallbacks (§1.6).
- **TopNav mobile overflow** — already filed as **KAN-91** (Lowest).
- **"Understand why" is underserved.** The app collects context (weather, occasion,
  events) but rarely *explains* its output — most acutely the discarded AI
  `reasoning` on the outfit page (§3.1).

---

## 6. Consolidated priorities

A first-pass ranking across all flows, to inform the redesign. **Not final** — for
discussion.

### Quick wins (small, high value — mostly correctness/clarity)
| # | Flow | Change |
|---|------|--------|
| Q1 | Onboarding | Stop swallowing the preference-save failure; surface error / retry |
| Q2 | Onboarding | Back on step 1 shouldn't silently log you out |
| Q3 | Outfit | Surface the AI `reasoning` that's already returned but dropped |
| Q4 | Outfit | Add a visible swap affordance on items (mobile) |
| Q5 | Scan | Detect no-camera → lead with Upload; soften empty state |
| Q6 | Scan | Relabel review "Occasion" → "Category" |
| Q7 | Calendar | Honest "Connect" copy (it's a link paste, not OAuth) |
| Q8 | Onboarding | Consistent skip model + global "set up later" |

### Larger redesigns (design-led / cross-layer)
| # | Flow | Change |
|---|------|--------|
| L1 | Onboarding | **Trim** the required flow to used inputs + re-skin to design system (§1 fork A) |
| L2 | Onboarding | _or_ **Upgrade** the recommender to consume the profile (§1 fork B) |
| L3 | Outfit/Scan | Streamline scan review; in-image colour sampling (ties to KAN-81) |
| L4 | Calendar | Real OAuth sign-in (replaces manual ICS) |
| L5 | Global | Unify onboarding onto the app's design system |

### Suggested first design target
Onboarding end-to-end (the entry experience, and where the "collect-and-ignore" and
design-inconsistency themes concentrate) — pursuing the **Trim + re-skin** direction,
folding in Q1/Q2/Q8 as part of the same redesign. Pilot it through Pencil → sign-off
→ implementation before touching the other flows.

---

## 7. Proposed directions (Naqi)

Solution ideas raised after the audit, with notes/refinements. Captured for design;
not yet scoped into tickets.

### 7.1 Logo / root → Wardrobe for signed-in users
Today `TopNav`'s logo links to `/` (marketing LandingPage) regardless of auth, so a
signed-in user lands on the sign-up page. **Better than just re-linking the logo:**
redirect `/` → `/wardrobe` when authenticated (fixes the logo *and* any direct `/`
visit). **Open Q:** is "home" the wardrobe or the daily **outfit** (the return-reason)?
**Effort:** XS, frontend. No deps.

### 7.2 Outfit reveal — "daily chest"
Turn the outfit reveal into a daily ritual instead of an instant render. Steer
**editorial ("today's edit, unlocked"), not loot-box**, to fit the brand. Concepts:
- **A. Wrapped reveal** — closed state → tap → flat-lay items cascade in. Reuses
  existing Motion stagger (`FlatLay`'s `tileEnter`). Low-ish effort, high delight.
- **B. Daily ritual + streak** — once/day open, instant re-open, streak counter.
  Needs persistence (localStorage MVP → backend for streaks/cross-device).
- **C. Reveal + "why"** — pair the reveal with the AI `reasoning` that's currently
  discarded (audit Q3). The reveal is the natural home for the rationale.

**DECIDED (2026-06-14): A + C with a once-a-day ceremony.**
- The **first open of the day** plays the full reveal: wrapped state → tap → flat-lay
  cascade → a **style summary** explaining *why this outfit* — tailored to weather +
  occasion — sourced from the AI `reasoning` the code currently discards (audit Q3).
  This personal "we chose this for you" moment is what makes the daily look special.
- **Subsequent refreshes** are instant swaps: **no ceremony, no style summary**. The
  reroll tool stays **unlimited** and never blocks a rushed user.
- **B (streaks/persistence)** deferred to a later pass.
- Persistence needed: a "revealed today" flag (localStorage for MVP).

**Effort:** M (frontend; reuses Motion + revives the discarded reasoning).

### 7.3 Calendar presence — connection-status pill
Surface a selling point: a chip ("Calendar not connected" → `/calendar`, or "Synced ·
Work") near the wardrobe header or in `TopNav`. Plugs audit §4 ("value asserted, not
shown"). **Notes:** label by calendar name/count, **not** "Google" (it's ICS, not
OAuth-known); if placed in `TopNav`, mind the existing mobile overflow (**KAN-91**).
**Effort:** S, frontend (reads `listCalendars`).

### 7.4 Wardrobe filter by wash status
Status filter (Clean/Worn/Laundry) beside the category tabs, ideally with counts.
**Depends on KAN-60** (`clothing_status`, in review). **Effort:** S, after KAN-60.

### 7.5 Bulk scan / multi-item
- **(a) Bulk upload** — N photos → classify each → batch review. Directly attacks the
  **cold-start** problem (empty wardrobe after onboarding). Frontend + minor backend.
  **DECIDED (2026-06-14): build this.** **Effort:** M.
- **(b) Multiple garments in one photo** — needs detection/segmentation in the Python
  AI service. **DECIDED: not now** (dropped — too much ML effort for the payoff).

---

## 8. Motion principles

**DECIDED (2026-06-14):** every screen transition gets a simple, consistent animation
— nothing appears abruptly — but motion stays **quiet** so the daily reveal remains
the one expressive moment.

- **One system, applied globally.** A single route-transition wrapper, not per-page
  bespoke animation. Standard: cross-fade + ~8px slide-up, ~200ms, ease-out.
- **Quiet everywhere, expressive once.** Page transitions are understated connective
  tissue. Reserve real choreography (the reveal's seal-bloom → garments settling) for
  the daily reveal alone, so it stays special.
- **Fast + accessible.** 150–250ms max; never block task completion. Respect
  `prefers-reduced-motion` (the app already ships a reduced-motion CSS block) — fall
  back to an instant cross-fade / no motion.
- **Entrances, not pops.** Lists and grids stagger-in (reuse the existing Motion
  stagger); content eases in on mount rather than snapping into place.
- **Feasibility:** Motion (Framer Motion) is already a dependency (FlatLay uses it); a
  global `AnimatePresence` route wrapper is a small one-time task — key routes by
  location so exit animations work under React Router.
