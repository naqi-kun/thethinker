# KAN-110 — Redesign Wardrobe scan/add into the bulk-upload flow

**Jira:** https://xsollaschoolteam3.atlassian.net/browse/KAN-110

**Type:** Story
**Epic / area:** Wardrobe — item ingestion
**Design source:** `design/thethinker-design.pen` → frames `Bulk Upload 1 · Add`, `Bulk Upload 2 · Tagging`, `Bulk Upload 3 · Review`, `Bulk Upload 4 · Edit Item`, `Edit Sheet`

## Summary

Upgrade the wardrobe "scan / add item" experience to match the new **Bulk Upload**
flow in the design file. Today a user can only add **one garment at a time** (live
camera → capture → classify → review one item). The new design lets a user drop in
**many photos at once**, watch them get auto-tagged in a batch, and confirm them in a
single review list — turning closet onboarding from a one-by-one chore into a single
pass.

## Background — current state

| Screen | Route | File | Behaviour |
|---|---|---|---|
| Add Item | `/wardrobe/add` | `frontend/src/features/wardrobe/components/AddItemPage.tsx` | Live camera, single capture **or** one gallery file; classifies one image |
| Review Item | `/wardrobe/add/review` | `frontend/src/features/wardrobe/components/ReviewItemPage.tsx` | Confirms a single classified item |

Limitations: no multi-file selection, no drag-and-drop, no batch progress, no
multi-item review list, no per-item edit sheet.

## Target design (from `thethinker-design.pen`)

1. **Bulk Upload 1 · Add** — header "Add Clothes", title "Add your closet",
   subtitle "Upload photos of your pieces and we'll tag and sort them for you — add
   as many as you like."
   - **Drop zone:** images icon · "Drag photos here" · "JPG or PNG · several at once"
     · **Browse Files** button (multi-select file input).
   - Secondary: **"Take a photo instead"** (camera) — keeps the existing single-shot path.
   - Tip: "Lay items on a plain background for the best tags."
2. **Bulk Upload 2 · Tagging** — batch progress. Grid of uploaded thumbnails, each
   with a **Done / Processing** badge; a progress bar with **Labelling → Categorising**
   labels; close (`x`) in header to cancel.
3. **Bulk Upload 3 · Review** — scrollable list of detected items. Each row: thumbnail,
   editable name, **category chip + colour chip** (with colour dot), and a **remove (`x`)**
   control. Sticky **"Add All"** CTA (check icon) commits the batch to the wardrobe.
4. **Bulk Upload 4 · Edit Item / Edit Sheet** — tapping a review row opens a bottom
   sheet to correct name, category, and colour before adding.

Use existing design-system tokens/classes (terracotta primary, linen cards, sand
borders, `rounded-2xl`, skeleton + stagger presets per `DESIGN.md`).

## Scope

- New multi-photo upload entry replacing/extending `AddItemPage` (drag-and-drop +
  multi-select `<input multiple>`); retain "Take a photo instead" → existing camera path.
- Batch tagging/progress screen driven off per-image classification calls.
- Multi-item review list with inline remove + edit sheet.
- "Add All" commits the confirmed batch.
- Wire new routes (e.g. `/wardrobe/add` → upload, `/wardrobe/add/tagging`,
  `/wardrobe/add/review`) and update `App.tsx`.

## Open questions / dependencies

- **Backend:** does `POST /wardrobe/scan` (and the AI classify service in
  `ai/classify.py`) support batch, or do we fan out N single-item calls from the
  client? Confirm before estimating — may need an OpenAPI change (**use the
  `add-endpoint` skill** if so, spec-first).
- Image storage limits / max files per batch.
- Concurrency + partial-failure handling (some photos fail to classify).

## Acceptance criteria

- [ ] User can select/drag **multiple** images on `/wardrobe/add`.
- [ ] "Take a photo instead" still opens the single-shot camera flow.
- [ ] Tagging screen shows per-item Done/Processing state and overall progress.
- [ ] Review list shows each detected item with editable name + category/colour chips
      and a remove control; edit sheet works.
- [ ] "Add All" persists every confirmed item to the wardrobe in one action.
- [ ] Matches `thethinker-design.pen` frames and `DESIGN.md` tokens; responsive to
      `max-w-lg` mobile container.
- [ ] Loading uses skeletons; list reveal uses the shared stagger preset.
- [ ] `pre-mr-check` passes (lint, format, type-check, tests, build).

## Out of scope

- Re-scanning / editing items already in the wardrobe.
- AI model/accuracy changes (covered by KAN-108 / KAN-109).
