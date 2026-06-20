# Production Image Storage (GCS)

Image features — wardrobe photo upload, scan image save, and the dev seed — need
Google Cloud Storage. Without it the backend logs
`WARNING: GCS unavailable — image uploads disabled` and uploads fail with
`image storage not configured — set GCS_CREDENTIALS_JSON`. Everything else
(register/login, manual item add, recommendations, calendar, history) works without it.

**No code change is required to enable it** — it's GCP configuration only.

## How the backend resolves storage

`backend/internal/infrastructure/storage/gcs/client.go` enables GCS when one of:

- `GCS_EMULATOR_HOST` is set → local fake-gcs-server emulator (**dev only**), or
- `GCS_CREDENTIALS_JSON` is set → real GCS with a service-account key, or
- Application Default Credentials exist (when running on GCP with a suitable service account).

The bucket name comes from `GCS_BUCKET` (default `wardrobe-images`). Images are
stored and served as **public URLs** (`https://storage.googleapis.com/<bucket>/<object>`),
so the bucket must allow public reads.

## One-time setup

### Google Cloud
1. Create or choose a GCP project.
2. Create a bucket — names are globally unique, e.g. `thethinker-wardrobe-<suffix>`.
   Note the exact name for `GCS_BUCKET`.
3. Make objects public-read: enable **uniform bucket-level access**, then grant
   `allUsers` the **Storage Object Viewer** role on the bucket.
   ⚠️ Wardrobe images become readable by anyone with the URL — acceptable for a demo.
4. Create a **service account** with **Storage Object Admin** scoped to the bucket.
   Create and download its **JSON key** — this becomes `GCS_CREDENTIALS_JSON`.

### Cloud Run (AppHost pipeline)
5. Grant the Cloud Run **runtime service account** `roles/storage.objectAdmin` on the bucket
   (see [gcp-deploy-iam-request.md](./gcp-deploy-iam-request.md)).
6. Set `GCS_BUCKET` via the AppHost `gcsBucket` parameter (default `thethinker-wardrobe-images`).
For production Cloud Run deploys (CI, staging, or prod), see [aspire-deploy.md](./aspire-deploy.md).
For staging bucket setup, run [`scripts/provision-staging-infra.sh`](../scripts/provision-staging-infra.sh).

## Verify
- Backend startup logs: the `WARNING: GCS unavailable` line is absent.
- Live app: upload a photo to a wardrobe item — it saves and the image displays with a
  `https://storage.googleapis.com/...` URL.

## Notes
- Scope the service account to just this bucket; rotate/revoke the key if it leaks.
- `gcs-key.json` is gitignored — never commit it.
- Private images would require signed URLs (a code change); current code uses public URLs.
- Existing imageless items don't backfill — only new uploads/scans get images.
