# TheThinker — UX Notes: Changes, Decisions & Reasoning

**Owner:** Naqi · **Started:** 2026-06-14 (as the KAN-72 audit) · **Living doc**

Working record of our UX decisions and *why* we made them. It began as a full audit of
the four core flows (onboarding, wardrobe scan, daily outfit, calendar) — driving the
**real running app** with a seeded token + mocked APIs and cross-checking the backend —
and is now where we keep what we decided. Smaller actionable fixes are at the end;
parked questions after that.

---

## The core finding (what drives all of this)

Onboarding asks ~11 things; the recommender consumes ~**1**. Verified in code:

- The AI client (`recommend_client.go` `StartSession`) sends the stylist **only wardrobe
  items** (id, sub_type, category, color, fit, season) — no user profile.
- The rule-based fallback uses only wardrobe items + weather + date.
- The only preferences `service.go` reads are `use_ai` and `location` (for weather).
  **Occasion is hardcoded `"casual"`** (`service.go:121`); `calendarRepo` is injected but
  **unused** in `GetOutfit`.
- Settings *looks* like it edits the profile, but the Style/Fit pickers are **cosmetic**
  — local state, never loaded or saved.

So skin tone, body shape, face shape, palette, climate, occasions, and aesthetic are all
**collect-and-ignore** — sometimes-sensitive questions with no payoff. Fixing this (ask
only what we use, and actually use it) is the spine of every decision below.

---

## Decisions

### 1. Recommendation attributes — what we use & where it comes from · KAN-104 ✓

| Attribute | Feeds rec? | Source |
|---|---|---|
| Garment data (color, fit, type, season) | ✅ today | Wardrobe scan |
| Weather / temperature | ✅ today | Device location → weather API (lat/lon) |
| Occasion / formality | make dynamic | **Calendar event** — not onboarding |
| Aesthetic taste | ⏳ wire first | Onboarding |
| Body shape | ⏳ later, gated | Onboarding (capture) |
| Skin tone | ⛔ parked | Onboarding (capture) |
| Face shape, height, palette, climate | ❌ unused | Drop |

**The three-leg rule — a signal earns an onboarding slot only if it is:**
1. **Asked** in onboarding,
2. **Taken into account** — consumed by the recommender and *demonstrably steers the
   output* before it ships,
3. **Editable** later in Settings (persists + reloads) on the **same taxonomy**.

> Naqi: "every onboarding question should be asked *and* taken into account, but also
> changeable in preferences — I hate not having that option."

This is the discipline that stops collect-and-ignore from recurring.

**Sequencing ladder:**
1. Ship **aesthetic** into the prompt.
2. **Verify it steers** — *Bar 1:* same wardrobe, swap the label → a meaningfully
   different, on-brief pick; refine until it does.
3. Then **body shape**, same check — expect it to *barely* move the pick (only the coarse
   `fit` proxy exists), and **that failed check is the signal** to invest in garment
   metadata.
4. **Skin tone last**, gated on a real quality metric + a sensitivity review.

**Why this order:**
- All three signals cost the **same** to plumb (one line into `_build_prompt`; the
  recommender is an LLM over owned items — nothing trained). So choose on **value/risk,
  not cost**.
- **Aesthetic is cheapest to make real** — the LLM already knows "minimalist" /
  "streetwear", and acts on the color/fit/type items already carry.
- **Body type is data-starved** — its rules are about cut/silhouette, but items only store
  color/fit/sub_type/season. It stays cosmetic until garment metadata is enriched (richer
  tagging or CV). *That's* the real work — and it's on the body-type side, not aesthetic.
- **Skin tone** is the most sensitive and hardest to validate → last.

**Measurement gap:** there's no way today to tell if a signal makes recs *better* (only
untracked accept/regenerate). We ship on Bar 1 ("it steers") and treat "is it better" as a
follow-up once a metric exists.

### 2. Aesthetic taxonomy · KAN-92 / KAN-94 ✓

One **single-select** list shared across onboarding, Settings, and the prompt:

> **Basic** · Minimalist · Classic · Old Money · Streetwear · Y2K · Coquette ·
> Cottagecore · Boho · Parisian · Athleisure · Grunge · Preppy

- **Basic** is the plain-language default for people who don't care about fashion ("just
  keep it simple") and doubles as the skip answer. It avoids alienating them with
  "Coquette/Cottagecore" and keeps the recommender signal clean instead of random.
- **Single-select** gives the cleanest, testable steer (Bar 1). Replaces the old
  menswear-leaning inspiration set and the mismatched Settings list.

### 3. Occasion = a user-selected event · KAN-92 ✓

A compact **"Dressing for" dropdown** on the daily-reveal Wrapped page lists the day's
calendar events.
- **Default = most-formal event** (never underdressed); **"Everyday"** when there are
  none; changing it **regenerates** the look.
- `Event.Type → formal / casual / sport` (maps onto the existing wardrobe `Category`).
- Adds an optional **`occasion` / `event_id`** param to `GET /recommendations/outfit`
  (**spec-first**).
- Why user-selected over auto-inferred: more honest, and you often want to dress for the
  *next* thing rather than whatever a heuristic picks.

### 4. Onboarding overhaul · KAN-94 ✓ (designed in Pencil)

- **Flow:** Welcome → **Aesthetic** → Location → Done → **straight into bulk add-clothes**
  (fixes the empty-wardrobe cold-start). ~4 screens, down from 8.
- **Drop** the formality "Style" step (occasion comes from the calendar) and body shape /
  face shape / skin tone / palette / climate (deferred or dropped per KAN-104).
- **Location** becomes an "Allow location" permission (geolocation → weather by lat/lon)
  with a manual city fallback — not a survey question.
- **Re-skin** to the app's design tokens — today it's hardcoded to a different palette and
  looks like a different app on hand-off.
- **Bug fixes folded in:** the silent preference-save failure (`.catch(()=>{})` then
  navigates — loses all input) and back-on-step-1 silently logging you out.

### 5. Daily reveal — "daily chest" ✓

Make the reveal a once-a-day ritual — **editorial, not loot-box**.
- **First open of the day** plays the full reveal (wrapped → tap → flat-lay cascade → a
  "why this look" summary). Subsequent **refreshes are instant** swaps, no ceremony;
  reroll stays unlimited.
- **"Why this look" is a composite** (checked against the prompt): **context** (weather +
  occasion) from the backend's templated chips + **coordination** from the AI `reasoning`
  sentence the Go client currently parses and **discards** (`recommend_client.go`). The AI
  can't comment on weather/occasion (not in its prompt), so we don't fake it. *(Later:
  feed weather/occasion into the prompt for one richer sentence — needs a contract change
  + a live prose spike.)*
- The **event dropdown** (decision 3) lives here. **Streaks/persistence** deferred; MVP
  needs a "revealed today" flag.

### 6. Bulk upload ✓ · Motion ✓

- **Bulk upload** (N photos → classify each → batch review) — **build it**; directly fixes
  the post-onboarding cold-start. Multi-garments-in-one-photo **dropped** (too much ML for
  the payoff).
- **Motion:** one global route-transition system — **quiet everywhere, expressive once**
  (only the daily reveal gets real choreography). 150–250ms, cross-fade + ~8px slide,
  respect `prefers-reduced-motion`. Motion is already a dependency.

---

## Smaller fixes (actionable backlog)

Correctness/clarity wins the audit surfaced, independent of the big redesigns:

| Flow | Fix |
|---|---|
| Onboarding | Stop swallowing the preference-save failure; surface error / retry |
| Onboarding | Back on step 1 shouldn't log you out |
| Outfit | Surface the AI `reasoning` already returned but dropped |
| Outfit | Visible swap affordance on items (mobile has no cue today) |
| Outfit | Drop / upgrade the literal "#top #bottom #shoes" hashtags |
| Scan | Detect no-camera → lead with Upload (camera-first punishes desktop) |
| Scan | Relabel review **"Occasion" → "Category"** (it's bound to `category`) |
| Scan | Make image-upload failure recoverable (don't duplicate the item) |
| Calendar | Honest "Connect" copy — it's an ICS-link paste, not OAuth sign-in |
| Calendar | Merge the redundant top ICS form into the provider panels |

**Other directions (captured, not scoped):**
- **Logo / `/` → Wardrobe for signed-in users** — today the logo sends them to the
  marketing page. Open Q: is "home" the wardrobe or the daily outfit?
- **Calendar-status pill** near the wardrobe header — label by calendar name, not
  "Google" (it's ICS); mind `TopNav` overflow (KAN-91).
- **Wardrobe filter by wash status** — after KAN-60 (`clothing_status`).

---

## Parked / open questions

- **Body shape** — needs garment-metadata enrichment (cut / silhouette) before it's more
  than cosmetic.
- **Skin tone** — sensitive; needs a quality metric + a sensitivity review of the colour
  advice.
- **Rich-aesthetic depth** — further taxonomy expansion / per-aesthetic recommendation
  mapping is research, later.
- **Measurement loop** — no signal-quality metric exists; blocks "is it *better*" (Bar 2).
- **Real calendar OAuth** — replaces the manual ICS paste (the biggest calendar friction);
  significant backend + app-registration effort.
- **TopNav mobile overflow** — filed as KAN-91 (lowest).
