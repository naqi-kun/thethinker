# Outfit History — Feature Description & Integration Analysis

> Ticket: Build outfit history page showing past accepted outfits (Story).
> This document describes how the feature should work and what backend functionality
> is needed to support it, grounded in the current codebase.

## 1. What the feature is

A new screen that lets a user browse outfits they've previously accepted, grouped by the
date they were worn, most-recent-first. Each entry shows the items worn that day (as a
thumbnail strip / mini flat-lay), tapping an item reveals its metadata, and the list
paginates as the user scrolls back in time. It reuses two pieces from KAN-47: the
**editorial flat-lay** layout and the **item metadata card**.

## 2. The critical gap: there is no "outfit" to show history of

This is the most important thing to understand before building, and it changes the backend
scope significantly.

**Today, accepting an outfit does not persist an outfit.** When the user calls
`POST /recommendations/outfit/accept`, the handler (`recommendation_handler.go`) does two things:

1. `wardrobeSvc.MarkItemsWorn(userID, itemIds)` → runs
   `UPDATE wardrobe_items SET last_worn = now() WHERE user_id = $2 AND id = ANY($3)`
   (`wardrobe_repository.go`).
2. `svc.AcceptSession(sessionID)` → a fire-and-forget signal to the AI service
   (non-fatal if the session expired).

So the *only* durable trace of an accepted outfit is the `last_worn` timestamp stamped onto
each individual `wardrobe_items` row. There is **no `outfits` table, no `outfit_id`, no
record of which items were grouped together**.

This means the ticket's acceptance criteria **cannot be met by reading `last_worn` alone**.
Concretely, `last_worn`-only history is broken in three ways:

- **It's lossy across time.** `last_worn` only keeps the *single most recent* wear date. If a
  shirt was worn on June 1 and again June 9, the June 1 record is gone. Querying "what did I
  wear on June 1" is impossible.
- **It can't reconstruct outfit groupings.** If three items share `last_worn = 2026-06-11`,
  you can *guess* they were one outfit — but if the user accepted two different outfits on the
  same day (testing scenario #2 explicitly calls this out), they collapse into one
  indistinguishable blob.
- **It breaks the "deleted items" scenario.** Testing scenario #4 requires history to survive
  item deletion. But `wardrobe_items` has `ON DELETE CASCADE` from the user, and deleting a
  wardrobe item removes the row entirely — so any history derived from those rows vanishes
  with the item.

**Conclusion: this feature requires persisting accepted outfits as first-class records.** The
history endpoint should read from that new store, not from `last_worn`.

## 3. Required backend changes

### 3.1 New persistence: an `outfits` (+ `outfit_items`) store

A new migration (003) introducing something like:

- `outfits` — `id`, `user_id`, `session_id` (nullable, from the AI session), `occasion`
  (nullable), `worn_on` (date), `created_at`.
- `outfit_items` — `outfit_id`, and a **snapshot** of each item worn. The snapshot is the key
  decision: to satisfy "history loads correctly after wardrobe items are deleted," the join to
  live `wardrobe_items` must be optional. Either (a) store a denormalized copy of the item's
  display fields (`sub_type`, `color`, `category`, `fit`, `season`, `image_url`) at
  accept-time, or (b) keep `item_id` as a nullable soft reference (`ON DELETE SET NULL`) and
  tolerate missing items in the UI. Snapshotting (a) is the more robust choice — it makes
  history immutable and immune to later edits/deletes of the wardrobe.

Index on `(user_id, worn_on DESC)` to support the paginated, date-ordered query.

### 3.2 Write path: record an outfit on accept

`POST /recommendations/outfit/accept` must, in addition to its current behavior, **insert an
`outfits` row + its `outfit_items`**. This belongs in the recommendation domain (a new
`OutfitHistory`/`AcceptedOutfit` aggregate with a repository interface in the domain package
and a postgres implementation in infrastructure, per the DDD rules). It should still call
`MarkItemsWorn` (so the recommendation engine's least-recently-worn fallback keeps working) —
these are complementary, not redundant.

Open question for the design owner / grilling session: should `last_worn` continue to live on
the item, or be derived from the new outfit history? Keeping both is fine short-term
(`last_worn` = denormalized cache for the recommender; `outfits` = source of truth for history).

### 3.3 New read endpoint: `GET /recommendations/history`

Per the AC. Contract-first — the OpenAPI spec must be updated **before** any code (CLAUDE.md
rule + the `add-endpoint` skill enforces this), then `npm run gen:api` regenerates
`frontend/src/shared/api/schema.d.ts`.

Suggested shape:

- **Request:** `GET /recommendations/history?limit=20&cursor=<opaque>` (or `?page=`). Bearer
  JWT required, like all non-auth routes.
- **Response:** a paginated list of outfit entries grouped by date, most-recent-first:

```yaml
HistoryEntry:
  worn_on: date
  outfits:
    - id: string
      occasion: string (nullable)
      items: [ ClothingItem ]   # reuse existing schema; image_url + metadata
HistoryPage:
  entries: [ HistoryEntry ]
  next_cursor: string (nullable)   # null when no more pages
```

Note: **pagination is a new concept for this API.** No existing endpoint paginates —
`GET /wardrobe/items` and `GET /recommendations/outfit` both return flat arrays. So the team
needs to pick a convention (cursor vs offset) here; cursor-on-`worn_on` is the cleaner fit for
an append-mostly, reverse-chronological feed and avoids drift as new outfits are accepted. The
AC explicitly requires a "pagination boundary" test, so the boundary semantics (empty last
page, `next_cursor: null`) must be defined in the spec.

The `ClothingItem` schema can be reused as-is for the items in each entry, which keeps the
frontend types and the flat-lay/metadata-card components compatible without change.

## 4. Required frontend changes

This is a new **vertical slice** under `frontend/src/features/history/` (use the
`new-frontend-feature` skill for scaffolding). It mirrors the structure of the existing
`outfit` and `wardrobe` features (`api.ts` + `components/`).

### 4.1 Entry point / navigation

Add a **History tab** to the nav. `TopNav.tsx` currently has:

```ts
const navItems = [
  { to: '/wardrobe', label: 'Wardrobe' },
  { to: '/outfit', label: 'Outfit' },
  { to: '/calendar', label: 'Calendar' },
];
```

Add `{ to: '/history', label: 'History' }`, and a corresponding protected route in `App.tsx`:

```tsx
<Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
```

A secondary entry point — a "View history" link from `OutfitPage` — is reasonable but
optional; the tab is the primary surface.

### 4.2 API client

`features/history/api.ts`, following the `openapi-fetch` pattern already used in
`outfit/api.ts`:

```ts
export async function getHistory(cursor?: string): Promise<HistoryPage> {
  const { data } = await apiClient.GET('/recommendations/history', {
    params: { query: cursor ? { cursor } : {} },
  });
  return data!;
}
```

Auth (Bearer) and 401→/login redirect are already handled by the shared client middleware
(`client.ts`), so no extra auth wiring.

### 4.3 Screen behavior & reused components

`HistoryPage.tsx` renders a scrollable list of date sections (most-recent-first). For each
date, render its outfit(s); for each outfit, a **horizontal thumbnail strip / mini flat-lay**.

- **Flat-lay reuse:** the "editorial flat-lay" today lives *inline* in `OutfitPage.tsx` (the
  `FLAT_LAY_SLOTS` array + the absolutely-positioned rotated `<button>` items). It is **not
  currently a shared component** — it's hard-coded in the outfit page. To genuinely "reuse" it
  (per KAN-47), it should be extracted into a shared component (e.g.
  `shared/components/FlatLay.tsx` or `features/outfit/components/FlatLay.tsx`) that takes
  `items` as a prop, then consumed by both `OutfitPage` and `HistoryPage`. For history, a
  compact horizontal strip variant is likely better than the full 8-slot canvas. **Flag this
  as a small refactor the ticket implies but that isn't free.**
- **Metadata card reuse:** same situation — the item metadata card is inline in
  `OutfitPage.tsx` (renders on `selectedItem`, shows image + `sub_type`/`color`/`category`/
  `season`/`fit` badges + a Swap button). Extract it to a shared component, and in history drop
  the "Swap" action (history is read-only). Tapping an item in history opens this card.

### 4.4 Required UI states (all in the AC)

- **Empty state:** no outfits accepted yet → friendly empty screen (e.g. "No outfits yet —
  accept your daily outfit to start building your history"), with a CTA linking to `/outfit`.
- **Loading state:** initial fetch and subsequent page fetches (skeleton list / spinner on the
  load-more).
- **Error state:** failed fetch → error message with retry.
- **Resilience to missing items:** if the backend uses soft-references rather than snapshots,
  the UI must render an outfit even if some items are gone (placeholder tile, no crash) —
  directly supports testing scenario #4.

## 5. End-to-end flow (how the pieces connect)

1. User accepts today's outfit on `OutfitPage` → `POST /recommendations/outfit/accept` →
   backend stamps `last_worn` **and** writes a new `outfits` row with snapshotted items.
2. User opens the **History** tab → `HistoryPage` calls `GET /recommendations/history` →
   backend returns outfits grouped by `worn_on`, newest first, first page.
3. The page renders each date with a flat-lay/thumbnail strip; tapping an item opens the
   metadata card.
4. Scrolling to the bottom fetches the next page via `next_cursor` until exhausted.

## 6. Testing implications (maps to the AC)

- **Accept → appears today:** requires the write-path change in §3.2; can't be satisfied by
  `last_worn` alone if two outfits land on one day.
- **Multiple dates → separate entries:** grouping by `worn_on`, which is why we persist a
  per-outfit date rather than relying on item timestamps.
- **Empty history → empty state:** §4.4 + backend returning an empty page
  (`next_cursor: null`).
- **Survives item deletion:** the §3.1 snapshot decision is what makes this pass; with
  `ON DELETE CASCADE` on live items, derived history would otherwise disappear.
- **Endpoint tests (owner):** empty history, single entry, pagination boundary, and the
  date-grouping logic — all enabled by the dedicated store + endpoint.

## 7. Summary of new work vs. reuse

| Area | Reused as-is | New / changed |
|---|---|---|
| Auth | Bearer JWT middleware | — |
| Data model | `ClothingItem` schema, `last_worn` | **new `outfits`/`outfit_items` tables + migration** |
| Accept endpoint | existing `MarkItemsWorn` | **also persist the accepted outfit** |
| Read API | `openapi-fetch` client, spec-first workflow | **new `GET /recommendations/history` (first paginated endpoint)** |
| Frontend slice | feature-folder convention, `TopNav`/routing | **new `features/history/`, History tab** |
| Components | flat-lay + metadata card (concept) | **extract both from `OutfitPage` into shared components** |
| UI states | error/401 handling in client | **empty / loading / error / missing-item rendering** |

**The headline takeaway:** the ticket reads as "surface existing data," but the data needed to
satisfy its acceptance criteria isn't being persisted yet. The real backbone of this feature
is a new accepted-outfit store and the write-path change on accept; the history endpoint and
screen are comparatively straightforward once that exists.
