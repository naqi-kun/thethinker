# Production Image Storage (GCS)

Image features — wardrobe photo upload, scan image save, and the dev seed — need
Google Cloud Storage. In production (Railway) this is **off by default**: the
backend logs `WARNING: GCS unavailable — image uploads disabled` and uploads fail
with `image storage not configured — set GCS_CREDENTIALS_JSON`. Everything else
(register/login, manual item add, recommendations, calendar, history) works
without it.

**No code change is required to enable it** — it's GCP + Railway configuration.

## How the backend resolves storage

`backend/internal/infrastructure/storage/gcs/client.go` enables GCS when one of:

- `GCS_EMULATOR_HOST` is set → local fake-gcs-server emulator (**dev only**), or
- `GCS_CREDENTIALS_JSON` is set → real GCS with a service-account key, or
- Application Default Credentials exist (only on GCP infrastructure — not Railway).

The bucket name comes from `GCS_BUCKET` (default `wardrobe-images`). Images are
stored and served as **public URLs** (`https://storage.googleapis.com/<bucket>/<object>`),
so the bucket must allow public reads.

## One-time setup

### Google Cloud
1. Create or choose a GCP project (free tier is fine).
2. Create a bucket — names are globally unique, so pick e.g. `thethinker-wardrobe-<suffix>`.
   Note the exact name for `GCS_BUCKET`.
3. Make objects public-read: enable **uniform bucket-level access**, then grant
   `allUsers` the **Storage Object Viewer** role on the bucket.
   ⚠️ Wardrobe images become readable by anyone with the URL — acceptable for a demo.
4. Create a **service account** with **Storage Object Admin** (or Storage Object
   Creator) scoped to the bucket. Create and download its **JSON key**.

### Railway (backend service → Variables)
5. `GCS_BUCKET` = the bucket name from step 2
6. `GCS_CREDENTIALS_JSON` = the **entire** service-account JSON (store as a secret variable)
7. Redeploy — Railway auto-redeploys when a variable changes.

## Verify
- Backend deploy logs: the `WARNING: GCS unavailable` line is gone, no GCS startup error.
- Live app: upload a photo to a wardrobe item — it saves and the image displays.
  (Display via `<img>` needs the public-read bucket from step 3; no CORS config required.)

## Access needed
Adding these variables requires access to the **Railway project** — dashboard
membership or the project's CLI token, *not* a separate credential file. Whoever
set up the deployment (holds `RAILWAY_PROJECT_ID` / `RAILWAY_TOKEN` in GitLab
CI/CD variables) can add the variables or invite you to the project. The CI
`RAILWAY_TOKEN` is a deploy token, separate from personal dashboard access.

## Notes
- Scope the service account to just this bucket; rotate/revoke the key if it leaks.
- Private images would require signed URLs (a code change); current code uses public URLs.
- Existing imageless items don't backfill — only new uploads/scans get images.
