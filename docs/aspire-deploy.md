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
| `backend` | Go API. On Cloud Run, connects to Postgres via `127.0.0.1:5432` (shared loopback to the proxy sidecar). See [Local compose smoke](#local-compose-smoke) for Docker Compose. |
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
| Image storage | `fake-gcs-server` emulator | Real GCS via Cloud Run ADC (no creds in env) |
| Frontend | Vite dev server `:5173` | nginx Dockerfile `:8080` |
| Telemetry | Aspire dashboard OTLP | OTEL env vars stripped from Compose |
| Compose extras | Dashboard, pg volume | Removed in `configureComposeFile` |

Do not hand-edit `aspire-output/docker-compose.yaml`. Regenerate with `aspire publish`.

Legacy hand-written `compose.yaml` / `compose.prod.yaml` and the old deploy scripts were removed.
`addDockerComposeEnvironment("compose")` generates the artifact from `apphost.mts` only.

The publish output directory stays `aspire-output/` (Aspire default). The Cloud Run **service**
name is the Compose project `name:` field, set to `thethinker` in `configureComposeFile` so
`gcloud run compose up` updates `https://thethinker-…a.run.app` instead of creating a new service
from the directory name.

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
| `GCS_KEY_JSON` (File) | — | — | Yes (CI gcloud auth only) |
| — | `googleClientId` | `VITE_GOOGLE_CLIENT_ID` (build arg) | Yes (has default) |
| — | `gcsBucket` | `GCS_BUCKET` | No (default `thethinker-wardrobe-images`) |
| — | `cloudSqlInstance` | cloudsql-proxy arg | No (default `thethinker:us-central1:thethinker-db`) |

`GCS_KEY_JSON` authenticates the CI deploy job with `gcloud auth activate-service-account`.
It is **not** passed into container env. Production GCS uploads use Application Default
Credentials from the Cloud Run runtime service account (`719713084003-compute@developer.gserviceaccount.com`).
That runtime SA needs `roles/storage.objectAdmin` on `gs://thethinker-wardrobe-images`
(see [gcp-deploy-iam-request.md](./gcp-deploy-iam-request.md)).

**Why no `GCS_CREDENTIALS_JSON` in Compose:** `gcloud run compose up` translates the
Compose file via `run-compose translate`, which rejects JSON object syntax in env values
(`YAML Injection Detected`). Passing SA JSON through `${GCSCREDENTIALSJSON}` triggers this.

### Test-project overrides (local / disposable GCP)

When validating against a personal test project (e.g. `xpp-experiments`), override these
**before** `aspire publish`:

| Variable | Production default | Test override example |
|---|---|---|
| `CLOUD_SQL_INSTANCE` or `Parameters__cloudSqlInstance` | `thethinker:us-central1:thethinker-db` | `xpp-experiments:us-central1:thethinker-verify-20260619` |
| `IMAGE_TAG` / `CI_COMMIT_TAG` | Git tag | `gcloud-test-YYYYMMDD-HHMM` |
| `GCS_BUCKET` | `thethinker-wardrobe-images` | test bucket in test project |

Track cloud mutations in `.superpowers/sdd/gcloud-test-resources.md`.
Do not delete test resources without explicit approval.

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
| Grant `roles/storage.objectAdmin` on the GCS bucket to the Cloud Run runtime SA | Backend uploads via ADC, not env-injected JSON |

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
- `frontend` uses `BACKEND_URL`, not `VITE_BACKEND_URL`. The publish artifact sets `127.0.0.1:<backend-port>` for Cloud Run shared-loopback networking.
- `backend` must not bind port `8080`.
- `backend` `DATABASE_URL` targets `127.0.0.1:5432` (proxy localhost).
- `backend` must **not** set `GCS_CREDENTIALS_JSON` (ADC at runtime).
- `backend` `GCS_BUCKET` comes from parameters.
- `cloudsql-proxy` uses the pinned proxy image and a valid connection name.
- All three app images point at `us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/...:<tag>`.
- No local `db`, no `compose-dashboard`, no dev telemetry wiring.

## Local compose smoke

Run the **published production artifact** locally with plain `docker compose` to smoke-test images
before or after a Cloud Run deploy — without calling `gcloud run compose up`. This section
documents the **networking contract** between the two runtimes and what belongs in AppHost vs a
local-only override file.

### Docker Compose vs Cloud Run multi-container networking

Both use the same four-container topology (`frontend`, `backend`, `ai`, `cloudsql-proxy`), but
they do **not** share the same network model:

| | Cloud Run multi-container | Plain Docker Compose |
|---|---|---|
| Network namespace | **One shared** namespace per revision — all sidecars share the same loopback | **One per container** — each service has its own `127.0.0.1` |
| Reach another sidecar | `127.0.0.1:<port>` on the peer's listen port | `<service-name>:<port>` via Compose embedded DNS |
| Service names (`backend`, `ai`, …) | Do **not** resolve — no Docker DNS | Resolve to the container IP on the compose network |
| Ingress `PORT` | Injected by Cloud Run on the `frontend` container only | Must be set explicitly for nginx (`8080`) |

```text
Cloud Run (shared namespace):
  frontend ──127.0.0.1:8081──► backend ──127.0.0.1:5432──► cloudsql-proxy
                                    └──127.0.0.1:8001──► ai

Docker Compose (isolated namespaces):
  frontend ──backend:8081──► backend ──cloudsql-proxy:5432──► cloudsql-proxy
                                      └──ai:8001──────────► ai
```

Aspire publishes a **Docker Compose file**. `gcloud run compose up` translates that file into
a Cloud Run revision where sidecars share localhost. Plain `docker compose up` does **not**
perform that translation — loopback addresses in the artifact are wrong for Docker, and Docker
DNS names in the artifact are wrong for Cloud Run.

### What AppHost owns vs local override only

**Committed in `apphost.mts` + `configureComposeFile`** — targets Cloud Run deploy:

| Concern | Where wired |
|---|---|
| Four-service topology (no local `db`, no dashboard) | `apphost.mts` publish branch + `configureComposeFile` |
| `DATABASE_URL` host `127.0.0.1:5432` | `apphost.mts` (`refExpr` in publish mode) |
| `BACKEND_URL` via `configureComposeFile` patch | `apphost.mts` publish branch → artifact `127.0.0.1:8081` |
| Strip `PORT` from frontend | `configureComposeFile` (Cloud Run reserves it) |
| Strip `GCS_CREDENTIALS_JSON` from backend | `configureComposeFile` (Fix A — ADC at runtime) |
| Strip dev OTEL → `compose-dashboard` | `configureComposeFile` |
| Remove `thethinker-pgdata` volume | `configureComposeFile` |
| Compose project `name: thethinker` | `configureComposeFile` — Cloud Run service name (not the output dir) |
| Image registry paths, Cloud SQL proxy image/args | `apphost.mts` constants |

**Local override only** (Docker-only concerns — committed at repo root as
[`docker-compose.local.yaml`](../docker-compose.local.yaml), merged at smoke-test time):

| Concern | Why override, not AppHost |
|---|---|
| `DATABASE_URL` host → `cloudsql-proxy:5432` | Docker isolates loopback; `127.0.0.1` in backend hits backend itself |
| `frontend` `PORT=8080` | Cloud Run injects `PORT`; stripped from artifact; nginx needs it locally |
| `cloudsql-proxy` credentials mount | Cloud Run uses revision runtime SA ADC; local containers need a key or host ADC |
| `backend` `GOOGLE_APPLICATION_CREDENTIALS` (optional) | Cloud Run uses runtime SA for GCS; local smoke may mount the same key for upload tests |

Do **not** put Docker-only hostnames into `apphost.mts` — that would break the Cloud Run
`127.0.0.1` contract validated by `validate-production-compose.mjs`. For local Docker smoke,
override `BACKEND_URL` to `backend:8081` in a merge file (see below).

### Env values per runtime

Substitute `${…}` from `aspire-output/.env` / GitLab CI variables. Password comes from
`Parameters__databaseUrl` / `DB_PASSWORD`.

| Variable | Cloud Run prod compose artifact | Cloud Run runtime (actual sidecar) | Local `docker compose` + override |
|---|---|---|---|
| **backend** `DATABASE_URL` | `postgresql://postgres:${DB_PASSWORD}@127.0.0.1:5432/thethinker` | same (shared loopback → proxy) | `postgresql://postgres:${DB_PASSWORD}@cloudsql-proxy:5432/thethinker` |
| **backend** `AI_SERVICE_URL` | `http://ai:8001` (Aspire service URL) | `http://127.0.0.1:8001` (shared loopback) | `http://ai:8001` (artifact OK) |
| **backend** `PORT` | `8081` | `8081` | `8081` |
| **backend** `GCS_CREDENTIALS_JSON` | absent (stripped) | absent — runtime SA ADC | absent — mount ADC file instead |
| **backend** `GCS_BUCKET` | `${GCSBUCKET}` / parameter | same | same |
| **frontend** `BACKEND_URL` | `127.0.0.1:8081` | same (shared loopback) | `backend:8081` (override required) |
| **frontend** `PORT` | **unset** (stripped) | injected by Cloud Run (typically `8080`) | **`8080`** (override required) |
| **frontend** `NODE_ENV` | `production` | same | same |
| **cloudsql-proxy** auth | runtime SA (`719713084003-compute@…`) | ADC from revision SA | mounted SA JSON or `GOOGLE_APPLICATION_CREDENTIALS` |

nginx substitutes `PORT` and `BACKEND_URL` at container start (`frontend/Dockerfile`); defaults
are `PORT=80` and `BACKEND_URL=127.0.0.1:8081` if unset — local smoke should set `PORT=8080`
explicitly to match the published port mapping.

### Why `127.0.0.1` in `DATABASE_URL` is correct on Cloud Run but not in Docker

On Cloud Run, all containers in the revision share one network namespace. The cloudsql-proxy
sidecar listens on `--address=0.0.0.0 --port=5432`, which binds to the **shared** loopback.
When the backend opens `127.0.0.1:5432`, it reaches the proxy process in the adjacent sidecar —
not Postgres directly, but the proxy forwards to Cloud SQL.

In plain Docker Compose, each container has its **own** loopback. `127.0.0.1:5432` inside the
`backend` container refers to port 5432 **on backend itself** (where nothing listens). The proxy
runs in a separate container; backend must use Compose DNS: `cloudsql-proxy:5432`.

That is why `apphost.mts` correctly emits `127.0.0.1` for Cloud Run publish, and why local smoke
needs a **Docker-only override** for the database host — not an AppHost change.

### Why `BACKEND_URL` differs

nginx proxies `/api/*` to `http://${BACKEND_URL}/` (`frontend/nginx.conf`).

- **Cloud Run:** frontend and backend share localhost. nginx must target `127.0.0.1:8081` (backend
  listens on `PORT=8081`, off the ingress port `8080`). Wired in `configureComposeFile`.
- **Docker Compose:** each container has its own localhost. nginx reaches backend via Compose DNS:
  `backend:8081`. Override the published artifact in a local merge file.

Using `backend:8081` on Cloud Run fails (no DNS). Using `127.0.0.1:8081` in Docker fails (backend
is not on frontend's loopback). Same variable, different correct value per runtime.

### `PORT` on frontend

Cloud Run injects `PORT` on the ingress container and rejects user-set `PORT` in the translated
spec (`reserved env names: PORT`). `configureComposeFile` removes `PORT` from the frontend service
so validation and deploy succeed.

Plain Docker has no injector. Without an override, nginx falls back to `PORT=80` while Compose
maps host `8080:8080` — the health check URL and browser port will not match. Local override:
`PORT=8080`.

### cloudsql-proxy credentials

| Runtime | How the proxy authenticates |
|---|---|
| **Cloud Run** | Revision **runtime service account** ADC (`roles/cloudsql.client` on the project — see [gcp-deploy-iam-request.md](./gcp-deploy-iam-request.md) §3). No key file in the container. |
| **Local Docker** | Mount a service-account key (or user ADC via `GOOGLE_APPLICATION_CREDENTIALS`) with `roles/cloudsql.client` on the target Cloud SQL instance. CI deploy key (`GCS_KEY_JSON`) is for `gcloud` in the pipeline, not for sidecar mounts. |

Backend GCS uploads follow the same split: Cloud Run runtime SA ADC (no `GCS_CREDENTIALS_JSON` in
Compose — Fix A); local smoke optionally mounts the runtime SA key for upload tests.

### Local smoke command

After `aspire publish` and `validate:production-compose`, run the npm smoke script (merges
[`docker-compose.local.yaml`](../docker-compose.local.yaml) at the repo root):

```bash
# Optional: validate before smoke when IMAGE_TAG is set
export IMAGE_TAG="<tag>"
export LOCAL_GCP_KEY_FILE=".local/thethinker-backend-key.json"  # host path for volume mount

npm run smoke:production-compose
```

Tear down when finished:

```bash
npm run smoke:production-compose -- --down
```

Equivalent manual command:

```bash
docker compose -f aspire-output/docker-compose.yaml \
  -f docker-compose.local.yaml \
  --env-file aspire-output/.env \
  up -d --wait
```

The override file adjusts Docker-only networking (`cloudsql-proxy` host, `PORT`, credentials
mount). Image tags and secrets come from `aspire-output/.env` and the same `Parameters__*` /
`DB_PASSWORD` values as CI. See [Local preflight](#local-preflight-before-pipeline-or-manual-deploy).

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
| `YAML Injection Detected` on compose translate | `GCS_CREDENTIALS_JSON` with SA JSON in env — use ADC instead |
| `GCS unavailable — image uploads disabled` | Backend could not init GCS client; check runtime SA bucket IAM |
| `failed to upload image` (500) | Runtime SA missing `storage.objectAdmin` on bucket |
| Backend can't reach DB | Cloud SQL proxy not ready, wrong connection name, or missing `roles/cloudsql.client` on runtime SA |
| Upload works but image 403 | Bucket objects not public-read (see prod-image-storage.md) |
| `Cannot use value of type object in reference expression` | Missing `await` on `builder.addParameter()` before `refExpr` in `apphost.mts` |

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
| Cloud SQL Auth Proxy sidecar | Works with `gcloud run compose up` multi-container model; backend uses shared-loopback `127.0.0.1:5432` on Cloud Run; local Docker smoke overrides host to `cloudsql-proxy:5432` |
| Explicit GCS JSON from GitLab | Replaced by Cloud Run ADC — avoids `run-compose` YAML injection on SA JSON |
| Separate Cloud Build step | GitLab runner has no Docker daemon; Compose deploy is image-reference-only |
| Frontend nginx, not Vite, in prod | Static bundle + reverse proxy to backend; `PORT` injected by Cloud Run at runtime |
| `validate-production-compose.mjs` | Catches topology mistakes before `gcloud run compose up` mutates cloud resources |
| Tag-gated auto-deploy | Pushing a tag is intentional; no manual Play step on `deploy-gcp` |
| Resource ledger | `.superpowers/sdd/gcloud-test-resources.md` tracks disposable test mutations |
