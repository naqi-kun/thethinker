# Aspire Deployment

How TheThinker goes from `apphost.mts` to a running Cloud Run multi-container service.
This document is the source of truth for **why** the deployment is shaped the way it is.

For local development (`aspire run`), see [CLAUDE.md](../CLAUDE.md#aspire-orchestration).
For GCS bucket setup details, see [prod-image-storage.md](./prod-image-storage.md).

When changing deployment wiring, update this doc and `apphost.mts` together.

## Architecture

Production deploys a **single Cloud Run service** with four containers:

```text
Internet → frontend (nginx :8080, ingress)
              └─ /api/* → backend (Go :8081)
                              ├─ ai (Python :8001)
                              └─ cloudsql-proxy (:5432) → Cloud SQL Postgres
```

| Container | Role |
|---|---|
| `frontend` | Static React build behind nginx. Only container with a published port (`8080`). Cloud Run injects `PORT`; nginx uses it at runtime via `envsubst`. |
| `backend` | Go API. Connects to Postgres via `127.0.0.1:5432` (Cloud SQL Auth Proxy sidecar). |
| `ai` | Python image classifier. |
| `cloudsql-proxy` | `gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0` sidecar. |

Dev mode (`aspire run`) is different: local Postgres, fake GCS emulator, Vite dev server on `:5173`.
Those resources are excluded from `aspire publish`.

## Deployment pipeline

GitLab job `deploy-gcp` runs automatically on **tag pipelines** (`only: tags`):

1. **Publish** — `aspire publish -o ./aspire-output --environment production --non-interactive`
2. **Validate** — `npm run validate:production-compose -- ./aspire-output/docker-compose.yaml --image-tag $CI_COMMIT_TAG`
3. **Build images** — `gcloud builds submit --config cloudbuild.yaml` (Cloud Build has no local Docker daemon)
4. **Dry-run deploy** — `gcloud run compose up ... --dry-run --no-build --allow-unauthenticated`
5. **Deploy** — `gcloud run compose up ... --no-build --allow-unauthenticated`

Pushing a Git tag is the intentional release trigger. Branch pushes run lint/test/build only.

`gcloud run compose up` deploys pre-built image references; it does **not** build images.
That is why `cloudbuild.yaml` exists as a separate step.

### Why `--allow-unauthenticated`

Cloud Run enforces an Invoker IAM check by default. Browser traffic to the public URL
needs either `roles/run.invoker` for `allUsers` or `--allow-unauthenticated` on deploy.
Both the dry-run and real deploy use this flag so validation matches production access.

**Note:** In our test environment, `--dry-run` still mutated Cloud Run (created revisions).
Treat dry-run as potentially mutating when testing in disposable projects.

## AppHost: dev vs production

`apphost.mts` is the single source of truth. `isPublish` (set by `aspire publish`) switches modes:

| Concern | Dev (`aspire run`) | Production (`aspire publish`) |
|---|---|---|
| Database | Local Postgres + named volume | Cloud SQL via proxy sidecar |
| Image storage | `fake-gcs-server` emulator | Real GCS via `GCS_CREDENTIALS_JSON` |
| Frontend | Vite dev server `:5173` | nginx Dockerfile `:8080` |
| Telemetry | Aspire dashboard OTLP | OTEL env vars stripped from Compose |
| Compose extras | Dashboard, pg volume | Removed in `configureComposeFile` |

Do not hand-edit `aspire-output/docker-compose.yaml`. Regenerate with `aspire publish`.

## Parameters and environment variables

Aspire parameters map to `Parameters__<camelCaseName>` in the environment.
CI also sets plain env vars that Compose references as `${VAR}`.

### GitLab CI/CD variables (production)

| GitLab variable | AppHost parameter | Container env | Required |
|---|---|---|---|
| `DB_PASSWORD` | (used to build `Parameters__databaseUrl`) | `DATABASE_URL` on backend | Yes |
| `JWTSECRET` | `jwtSecret` | `JWT_SECRET` | Yes |
| `ANTHROPICAPIKEY` | `anthropicApiKey` | `ANTHROPIC_API_KEY` on ai | Yes |
| `WEATHERAPIKEY` | `weatherApiKey` | `WEATHER_API_KEY` | Yes |
| `GOOGLE_CLIENT_SECRET` | `googleClientSecret` | `GOOGLE_CLIENT_SECRET` | Yes |
| `GCS_KEY_JSON` (File) | `gcsCredentialsJson` | `GCS_CREDENTIALS_JSON` | Yes |
| — | `googleClientId` | `VITE_GOOGLE_CLIENT_ID` (build arg) | Yes (has default) |
| — | `gcsBucket` | `GCS_BUCKET` | No (default `thethinker-wardrobe-images`) |
| — | `cloudSqlInstance` | cloudsql-proxy arg | No (default `thethinker:us-central1:thethinker-db`) |

`GCS_KEY_JSON` is read as a file, minified to one line, and passed as `Parameters__gcsCredentialsJson`.
We intentionally use explicit JSON credentials from GitLab rather than Cloud Run ADC for now.

### Test-project overrides (local / disposable GCP)

When validating against a personal test project (e.g. `xpp-experiments`), override these
**before** `aspire publish`:

| Variable | Production default | Test override example |
|---|---|---|
| `CLOUD_SQL_INSTANCE` or `Parameters__cloudSqlInstance` | `thethinker:us-central1:thethinker-db` | `xpp-experiments:us-central1:thethinker-verify-20260619` |
| `IMAGE_TAG` / `CI_COMMIT_TAG` | Git tag | `gcloud-test-YYYYMMDD-HHMM` |
| `GCS_BUCKET` | `thethinker-wardrobe-images` | test bucket in test project |
| `GCS_CREDENTIALS_JSON` | from `GCS_KEY_JSON` | real SA JSON with bucket access — **never `{}`** |

Track cloud mutations in `.superpowers/sdd/gcloud-test-resources.md`.
Do not delete test resources without explicit approval. See
[aspire-deploy-cleanup-plan.md](./aspire-deploy-cleanup-plan.md) Phase 5 for ledger teardown.

### Disposable test project preflight

From verification in `xpp-experiments` — run before first `gcloud run compose up` in a new project:

| Prerequisite | Why |
|---|---|
| Enable APIs: `run`, `cloudbuild`, `cloudresourcemanager`, `artifactregistry`, `sqladmin` | Provider translation and image pull fail without them |
| Install Run Compose: `apt-get install google-cloud-cli-run-compose` (CI) or `gcloud components install run-compose` (local) | `gcloud run compose up` unavailable otherwise |
| Build images into **the same project's** Artifact Registry | Cross-project image pull denied unless IAM allows it |
| Grant `roles/cloudsql.client` to the Cloud Run runtime service account | Proxy sidecar cannot connect without it |
| Cloud SQL test instance: use `--edition=ENTERPRISE` (not `db-f1-micro` on ENTERPRISE_PLUS) | Instance create fails otherwise |
| Export `AI_IMAGE` / `BACKEND_IMAGE` / `FRONTEND_IMAGE` before `validate:production-compose` | Validator resolves `${AI_IMAGE}` placeholders in generated Compose |
| Never set `GCS_CREDENTIALS_JSON` to `{}` in manual tests | Backend swaps in unavailable image store; uploads return 500 |

Local disposable test flow:

```bash
export Parameters__cloudSqlInstance="xpp-experiments:us-central1:<your-test-instance>"
export REGISTRY="us-central1-docker.pkg.dev/xpp-experiments/cloud-run-source-deploy"
# ... build images, aspire publish, validate, then compose up with --allow-unauthenticated
```

Record every mutating command in the ledger **before and after** it runs.

## Production Compose invariants

`scripts/validate-production-compose.mjs` enforces the Cloud Run topology before any
mutating deploy command runs. Key rules:

- `frontend` is the **only** service with published ports (`8080`).
- `frontend` must **not** set `PORT` (Cloud Run reserves it for the ingress container).
- `frontend` uses `BACKEND_URL=backend:<port>`, not `VITE_BACKEND_URL`.
- `backend` must not bind port `8080`.
- `backend` `DATABASE_URL` targets `127.0.0.1:5432` (proxy localhost).
- `backend` `GCS_CREDENTIALS_JSON` and `GCS_BUCKET` come from parameters.
- `cloudsql-proxy` uses the pinned proxy image and a valid connection name.
- All three app images point at `us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/...:<tag>`.
- No local `db`, no `compose-dashboard`, no dev telemetry wiring.

## Image registry and tags

| Image | Registry path |
|---|---|
| AI | `us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/thethinker-ai` |
| Backend | `.../thethinker-backend` |
| Frontend | `.../thethinker-frontend` |

Tag = Git tag (`$CI_COMMIT_TAG` in CI, `IMAGE_TAG` locally).

Frontend `VITE_GOOGLE_CLIENT_ID` is baked in at **Docker build time** via Cloud Build
substitution `_VITE_GOOGLE_CLIENT_ID`. The OAuth secret stays backend-only.

## Local preflight (before pipeline or manual deploy)

```bash
nvm use 22.16.0
npm run build
npm run test:compose-validation

export REGISTRY="us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy"
export IMAGE_TAG="<tag>"
export AI_IMAGE="${REGISTRY}/thethinker-ai:${IMAGE_TAG}"
export BACKEND_IMAGE="${REGISTRY}/thethinker-backend:${IMAGE_TAG}"
export FRONTEND_IMAGE="${REGISTRY}/thethinker-frontend:${IMAGE_TAG}"

# Set Parameters__* / secrets like CI does (see table above), then:
aspire publish -o ./aspire-output --environment production --non-interactive
npm run validate:production-compose -- ./aspire-output/docker-compose.yaml --image-tag "$IMAGE_TAG"
```

## Post-deploy smoke tests

```bash
# Public frontend
curl -s -o /dev/null -w "%{http_code}" https://<service-url>/

# API reachable through nginx
curl -s -X POST https://<service-url>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@example.com","password":"wrong"}'
# Expect 401 with {"code":"UNAUTHORIZED",...}

# Wardrobe upload (authenticated) — image URL should load from storage.googleapis.com
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Browser 403 on `/` | Missing `allUsers` invoker; redeploy with `--allow-unauthenticated` |
| `Image ...:<tag> not found` | Cloud Build step skipped or tag mismatch |
| `artifactregistry.repositories.downloadArtifacts` denied | Compose images point at another project's registry |
| `run-compose binary not installed` | Install Run Compose component (see disposable preflight above) |
| `reserved env names: PORT` on frontend | Regenerate Compose after `apphost.mts` strips frontend `PORT` |
| `GCS unavailable — image uploads disabled` | Empty/invalid `GCS_CREDENTIALS_JSON` (e.g. `'{}'` in manual test) |
| `failed to upload image` (500) | GCS client failed to init; check SA has Storage Object Admin on bucket |
| Backend can't reach DB | Cloud SQL proxy not ready, wrong connection name, or missing `roles/cloudsql.client` on runtime SA |
| Upload works but image 403 | Bucket objects not public-read (see prod-image-storage.md) |
| `Cannot use value of type object in reference expression` | Missing `await` on `builder.addParameter()` before `refExpr` in `apphost.mts` |

## Legacy manual deploy

`scripts/deploy-production.mjs` predates the AppHost pipeline. It patches a single Cloud Run
revision directly. **CI uses the AppHost path** (`deploy-gcp`). Keep the script for
emergency one-off patches only; new work should go through `apphost.mts` + `.gitlab-ci.yml`.

## AppHost publish target

```typescript
const compose = await builder.addDockerComposeEnvironment("compose");
```

`"compose"` is the Aspire **environment resource name** only. It does not read
`compose.yaml` or `compose.prod.yaml` at the repo root. Publish output goes to
`aspire-output/docker-compose.yaml`. Customize production Compose in
`compose.configureComposeFile(...)` — not by hand-editing generated files.

## Design decisions (summary)

| Decision | Why |
|---|---|
| AppHost-authored Compose | Single model for dev and prod; Aspire generates artifacts, we validate before deploy |
| Cloud SQL Auth Proxy sidecar | Works with `gcloud run compose up` multi-container model; backend keeps `localhost:5432` URL |
| Explicit GCS JSON from GitLab | Predictable in CI; avoids coupling upload auth to Cloud Run service identity (for now) |
| Separate Cloud Build step | GitLab runner has no Docker daemon; Compose deploy is image-reference-only |
| Frontend nginx, not Vite, in prod | Static bundle + reverse proxy to backend; `PORT` injected by Cloud Run at runtime |
| `validate-production-compose.mjs` | Catches topology mistakes before `gcloud run compose up` mutates cloud resources |
| Tag-gated auto-deploy | Pushing a tag is intentional; no manual Play step on `deploy-gcp` |
| Resource ledger | `.superpowers/sdd/gcloud-test-resources.md` tracks disposable test mutations |
