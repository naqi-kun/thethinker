# Dev Seed (KAN-56)

Resets the dev database and populates it with test users and a full wardrobe of
real clothing images. Images run through the same pipeline as user uploads:
Gemini classification → background removal → GCS upload.

## Quick start

1. `aspire run` from the repo root (you'll be prompted for `googleApiKey` and
   `anthropicApiKey` on first start — the AI service needs both).
2. Wait for the **ai** resource to show *Running* in the dashboard.
3. On the **db** resource row, click **Seed Dev Data** and confirm.
4. When it finishes (~1–2 min — every image is classified by Gemini), the
   command output shows the test credentials.

## Test accounts

| Email | Password | Style profile |
|---|---|---|
| `dev@thethinker.com` | `password123` | casual / business-casual |
| `jane@thethinker.com` | `password123` | formal / classic |

Both users get the full image set (one item per seed image), classified and
background-removed by the AI service.

## How it works

```
Aspire dashboard button ("Seed Dev Data" on the db resource, apphost.mts)
  └─► POST http://localhost:8080/dev/seed
        ├─ pre-flight: GET {AI_SERVICE_URL}/healthz   (fail fast if AI is down)
        ├─ TRUNCATE wardrobe_items, user_preferences, users
        ├─ INSERT 2 test users + preferences
        └─ for each image in backend/seeds/images/ × each user:
             wardrobeSvc.IngestScan() → Gemini classify → rembg bg-removal → GCS upload → DB insert
```

- The endpoint only works when `GCS_EMULATOR_HOST` is set (dev guard) — it
  returns 403 otherwise, so it is inert in production builds.
- Seeding is **idempotent**: every run truncates first, so clicking the button
  twice never duplicates data or leaves broken image URLs.
- Images are embedded into the backend binary via `//go:embed`
  ([backend/seeds/images.go](../backend/seeds/images.go)) — no filesystem
  dependency at runtime.
- Items run concurrently (4 at a time) to keep total seed time reasonable.

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
| Items appear but without images | GCS emulator (`gcs` resource) down mid-seed | Restart `gcs`, re-run the seed |
| Slow seed (several minutes) | Each image is a live Gemini API call | Expected; check `aspire logs ai` if stuck |

## Tests

`backend/internal/interfaces/http/handlers/seed_handler_test.go` covers the
dev-environment guard, AI-down fail-fast (DB untouched), idempotency across
runs (truncate-per-run, no duplicates), content-type mapping, and ingest
failure reporting. Run with:

```bash
cd backend && go test ./internal/interfaces/http/handlers/
```
