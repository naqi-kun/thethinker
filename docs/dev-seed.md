# Dev Seed (KAN-56)

Resets the dev database and populates it with test users and a full wardrobe of
real clothing images. Images run through the same upload pipeline as real user
uploads: validation → background removal (rembg) → GCS upload.

## Quick start

1. `aspire run` from the repo root.
2. Wait for the **ai** resource to show *Running* in the dashboard (it serves
   background removal).
3. On the **db** resource row, click **Seed Dev Data** and confirm.
4. When it finishes (~1–2 min — every image gets its background removed), the
   command output shows the test credentials.

## Test accounts

| Email | Password | Style profile | Wardrobe |
|---|---|---|---|
| `dev@thethinker.com` | `password123` | casual / business-casual | menswear + unisex (13 items) |
| `jane@thethinker.com` | `password123` | formal / classic | womenswear + unisex (10 items) |

Each seed image is tagged men's / women's / unisex in the `imageMeta` map;
unisex items (jeans, hoodie, sneakers…) seed both accounts.

## How it works

```
Aspire dashboard button ("Seed Dev Data" on the db resource, apphost.mts)
  └─► POST http://localhost:8080/dev/seed
        ├─ pre-flight: GET {AI_SERVICE_URL}/healthz   (fail fast if AI is down)
        ├─ TRUNCATE wardrobe_items, user_preferences, users
        ├─ INSERT 2 test users + preferences
        └─ for each image in backend/seeds/images/ × each user:
             AddItem (metadata from filename) → UploadImage → rembg bg-removal → GCS upload
```

- **Item metadata comes from the filename**, not the AI classifier. The Gemini
  free tier allows only 20 requests/day — less than one seed run — so each
  image's category/color/fit/season/audience is curated in the `imageMeta` map
  in `seed_handler.go`. Adding a new image to `backend/seeds/images/` requires
  adding a matching `imageMeta` entry (the seed fails loudly if you forget).
- **Background removal and GCS upload are the real pipeline** — the seed calls
  the same `UploadImage` service method as a user uploading a photo.
- The endpoint only works when `GCS_EMULATOR_HOST` is set (dev guard) — it
  returns 403 otherwise, so it is inert in production builds.
- Seeding is **idempotent**: every run truncates first, so clicking the button
  twice never duplicates data or leaves broken image URLs.
- Images are embedded into the backend binary via `//go:embed`
  ([backend/seeds/images.go](../backend/seeds/images.go)) — no filesystem
  dependency at runtime. Seed images are committed as JPEG because the upload
  pipeline's validation step decodes with Go's stdlib (no AVIF support).

## Alternatives

- **curl:** `curl -X POST http://localhost:8080/dev/seed`
- **SQL only (no images):** `psql <DATABASE_URL> -f backend/seeds/dev.sql` —
  faster, but wardrobe items will have no `image_url`, so the flat-lay outfit
  view shows text placeholders.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `AI service not ready (…/healthz unreachable)` | The `ai` container is still building/starting | Wait for the **ai** resource to be *Running*, retry |
| `seed endpoint not available outside dev environment` | `GCS_EMULATOR_HOST` not set | Run via `aspire run` (it wires the env var) |
| `no metadata for seed image "x.jpg"` | Image added without an `imageMeta` entry | Add the entry in `seed_handler.go` |
| Items appear but without images | GCS emulator (`gcs` resource) down mid-seed | Restart `gcs`, re-run the seed |
| Items have images with backgrounds | AI service died mid-seed (JPEG fallback) | Re-run the seed once **ai** is healthy |

## Tests

`backend/internal/interfaces/http/handlers/seed_handler_test.go` covers the
dev-environment guard, AI-down fail-fast (DB untouched), idempotency across
runs (truncate-per-run, no duplicates), metadata completeness for every
committed image, and upload failure reporting. Run with:

```bash
cd backend && go test ./internal/interfaces/http/handlers/
```
