# TheThinker — Domain Glossary

> This file is a glossary only. No implementation details, specs, or plans.
> Update terms here as the team reaches shared understanding.

---

## Accepted Outfit

An outfit that the user confirmed they will wear by tapping "Wear This Today" on the Outfit screen. Persisted as a first-class record in `outfit_history` + `outfit_history_items`. Distinct from an *Outfit Recommendation*, which is ephemeral and AI-generated.

## Outfit Recommendation

An AI-generated suggestion of wardrobe items for a given date and occasion. Ephemeral — exists only within a session. Becomes an *Accepted Outfit* when the user accepts it.

## Outfit History

The chronological log of a user's *Accepted Outfits*, ordered most-recent-first. Browsable on the History screen. Grouped by *worn_on* date for display.

## History Entry

A single date grouping within *Outfit History*. One *History Entry* per `worn_on` date, containing one or more *Accepted Outfits* (a user may accept multiple outfits on the same day).

## Outfit History Item

A point-in-time snapshot of a wardrobe item as it existed when an *Accepted Outfit* was recorded. Stores `image_url`, `category`, `sub_type`, `color`, `fit`, `season` at accept time. References the original *Wardrobe Item* via non-nullable FK (safe because items are *Soft Deleted*, never hard deleted).

## Wardrobe Item

A clothing item belonging to a user. Has a `deleted_at` timestamp for *Soft Delete*. Active items have `deleted_at IS NULL`; all queries against the active wardrobe must filter on this.

## Soft Delete

The mechanism by which a *Wardrobe Item* is "removed" from a user's active wardrobe. Sets `deleted_at TIMESTAMPTZ` on the row. The row is never physically removed. Queries over the active wardrobe filter `WHERE deleted_at IS NULL`. No background hard-deletion cleanup.

## worn_on

The UTC calendar date on which an *Accepted Outfit* was recorded. Set from `now()` at the moment the user accepts. Used as the grouping key in *Outfit History*.

## Time of Day

A derived enum (`morning` / `afternoon` / `evening`) attached to each *Accepted Outfit*. Derivation rule: use the associated calendar event's start time if the recommendation was occasion-linked; otherwise derive from the UTC timestamp of acceptance (`< 12:00` → morning, `12:00–17:00` → afternoon, `≥ 17:00` → evening).

## Weather Snapshot

A point-in-time capture of weather conditions (temperature, description) fetched from the *Weather Service* at the moment an outfit is accepted. Stored on the *Accepted Outfit* record. The Weather Service is currently stubbed.

## Session

A short-lived AI context created when `GET /recommendations/outfit` is called. Carries the recommendation date, occasion, and item selections. Identified by `session_id`. Referenced on accept to signal the AI model and to look up Time of Day when a calendar event is present.

## History Cursor

The opaque pagination token for traversing *Outfit History*. Encodes the position by *worn_on* date plus outfit identity — **not** by insertion order, because record IDs are random and carry no chronology. Clients must treat it as opaque; a malformed cursor is rejected, not ignored.

## Preset Range

One of the four date windows the History API understands natively: `week`, `month`, `season`, `all`. Selected via the segmented control on the History screen. `season` means the current meteorological season to date.

## Custom Range

A user-chosen from/to date pair on the History screen (the "Custom" picker in the design). Not understood by the API — the client fetches the `all` *Preset Range* and narrows by *worn_on* locally. Selecting a *Preset Range* clears the *Custom Range*, and vice versa; the two are mutually exclusive.

## Hero Card

The single expanded *Accepted Outfit* on the History screen. Exactly one outfit is expanded at a time (accordion); the most recent is the default and carries the "Most Recent" eyebrow. Shows the full *Bento* collage, context chips, hashtags, and the "Worn" state pill.

## Collapsed Entry

Any non-expanded *Accepted Outfit* on the History screen: a compact row with a *Thumb* collage, date, *Time of Day*, weather, and hashtags. Tapping it makes it the *Hero Card* and collapses the previous one.

## Flat Lay

The collage presentation of an outfit's items. Comes in three named variants: **Scatter** (rotated overlapping spread, used on the Outfit screen), **Bento** (one large tile plus smaller tiles in a grid, used by the *Hero Card*), and **Thumb** (miniature collage used by a *Collapsed Entry*).
