# Aspire Deployment Cleanup Plan

Plan for removing legacy deployment artifacts, securing committed secrets, and
auditing Docker images after the AppHost → Cloud Run Compose pipeline is verified.

**Related docs:** [aspire-deploy.md](./aspire-deploy.md) · [gcloud test ledger](../.superpowers/sdd/gcloud-test-resources.md)

**Status:** Draft — Phase 5 is the **final** phase and requires explicit approval before any GCP mutations.

---

## Source of truth

```text
apphost.mts
  └─ addDockerComposeEnvironment("compose")   ← Aspire publish TARGET (resource name only)
         └─ aspire publish
                └─ aspire-output/docker-compose.yaml   ← what CI deploys

compose.yaml / compose.prod.yaml   ← legacy hand-written files (NOT read by Aspire)
```

`addDockerComposeEnvironment("compose")` does **not** load `compose.yaml` or
`compose.prod.yaml`. It generates `aspire-output/docker-compose.yaml` from the
AppHost resource graph (services, parameters, endpoints, `configureComposeFile` hooks).

| File | Role |
|---|---|
| `apphost.mts` | Source of truth for dev + production topology |
| `aspire-output/docker-compose.yaml` | Generated publish artifact (gitignored) |
| `compose.yaml` | Legacy manual template — **not used by CI** |
| `compose.prod.yaml` | Legacy frozen prod snapshot — **not referenced anywhere** |

**Verified (2026-06-19):** staged vs working `apphost.mts` produced byte-identical
`docker-compose.yaml` and `.env` from `aspire publish`.

---

## Phase 0 — Security (do first)

| Item | Issue | Action |
|---|---|---|
| `compose.prod.yaml` | Plaintext secrets committed (API keys, JWT, DB password) | Delete from repo; add to `.gitignore` |
| `scripts/deploy-production.mjs` | Hardcodes DB password in source | Delete with other legacy scripts |
| Secrets in git history | `compose.prod.yaml` and `deploy-production.mjs` | Rotate Anthropic, JWT, DB password, Weather API |
| `frontend/.env.local` | Tracked in git with Datadog client token | `git rm --cached`; add to `.gitignore`; use `frontend/.env.example` |

---

## Phase 1 — Legacy repo files (safe deletes)

No pipeline impact — CI uses `apphost.mts` → `aspire-output/` only.

| File | Why leftover |
|---|---|
| `compose.yaml` | Pre-AppHost manual template; wrong Cloud Run topology (local `db`, `VITE_BACKEND_URL`, no Cloud SQL proxy) |
| `compose.prod.yaml` | First Cloud Run multi-container migration snapshot; zero code/CI references |
| `scripts/prepare-gcloud-compose.mjs` | Reads/writes `compose.yaml` only |
| `scripts/strip-compose.mjs` | Post-publish patches (jaeger, PORT, GCS emulator); AppHost `configureComposeFile` replaces this |
| `scripts/deploy-production.mjs` | Legacy single-revision Cloud Run patch deploy |
| `.env.example` (repo root) | Placeholders for old `compose.yaml` workflow |

### Doc updates (same PR)

| File | Change |
|---|---|
| `docs/aspire-deploy.md` | Source-of-truth diagram; ledger learnings; note Phase 1 removals |
| `docs/prod-image-storage.md` | Link to `aspire-deploy.md` instead of `deploy-production.mjs` |
| `cloudbuild.yaml` | Fix stale comment (`compose.yaml` → `apphost.mts` / `_VITE_GOOGLE_CLIENT_ID`) |
| `CLAUDE.md` | Link to `docs/aspire-deploy.md` under Docker Compose Publishing |

### `.gitignore` additions

```gitignore
compose.prod.yaml
service-prod.json
frontend/.env.local
backend/coverage
```

---

## Phase 2 — Keep / track

| File | Status | Action |
|---|---|---|
| `apphost.mts` | Active source of truth | Keep |
| `scripts/validate-production-compose.mjs` | Active CI gate | Keep |
| `scripts/validate-production-compose.test.mjs` | Tests for validator | Keep |
| `docs/aspire-deploy.md` | Deploy documentation | Keep updated |
| `ai/Dockerfile` | Built by Cloud Build | Keep |
| `backend/Dockerfile` | Built by Cloud Build | Keep |
| `frontend/Dockerfile` | Built by Cloud Build | Keep |
| `cloudbuild.yaml` | Image build + push step | Keep |

---

## Phase 3 — Docker images inventory

### In use (do not remove from repo config)

| Image | Where used | Role |
|---|---|---|
| `us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/thethinker-ai:<tag>` | AppHost, Cloud Build, CI | Python AI classifier |
| `.../thethinker-backend:<tag>` | AppHost, Cloud Build, CI | Go API |
| `.../thethinker-frontend:<tag>` | AppHost, Cloud Build, CI | nginx + React static bundle |
| `gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0` | AppHost publish only | Cloud SQL Auth Proxy sidecar (pulled, not built) |

### Dev-only (Aspire local run, excluded from publish)

| Image | Where | Action |
|---|---|---|
| `fsouza/fake-gcs-server:1.49` | `apphost.mts` (`!isPublish`) | Keep — needed for `aspire run` |
| Postgres (via `addPostgres`) | `apphost.mts` dev | Keep — Aspire-managed |
| Aspire dashboard | Dev telemetry | Already stripped from prod Compose |

### Legacy / unused references (removed in Phase 1)

| Image / reference | Where |
|---|---|
| `docker.io/library/postgres:18.3` | `compose.yaml` only |
| `registry.school-gitlab.xsolla.dev/team3/thethinker:latest` | `k8s/deployment.yaml` — see Phase 5 deferred note |
| `jaeger` | `strip-compose.mjs` only |
| `:latest` pins | `compose.prod.yaml` |

### Local Docker cache (machine-only, optional)

```bash
docker image ls | grep -E 'thethinker|fake-gcs|cloud-sql'
docker image prune
```

---

## Phase 4 — Repo hygiene

| Item | Issue | Action |
|---|---|---|
| `backend/coverage` | Go coverage output tracked in git | Remove from repo; gitignore |
| `aspire-output/` | Generated, already gitignored | `rm -rf aspire-output` locally anytime |
| `dist/apphost/` | Build output, gitignored | Regenerated by `npm run build` |
| `/tmp/thethinker-aspire-verify*` | Temp compose from test runs | Delete locally |
| `backend/Dockerfile` `EXPOSE 8080` | Cosmetic — prod Compose sets `PORT=8081` | Optional fix to `EXPOSE 8081` |

---

## Phase 5 — Final: cloud cleanup, ledger close-out, production audit

**Last phase.** Requires explicit approval before running any mutating `gcloud` commands.
After completion, update [gcloud-test-resources.md](../.superpowers/sdd/gcloud-test-resources.md)
to mark each resource deleted and note the date.

### 5a — `xpp-experiments` ledger resources (billable)

From the ledger — delete in this order (dependencies first):

| # | Resource | Project | Name / detail |
|---|---|---|---|
| 1 | Cloud Run service | `xpp-experiments` | `thethinker-aspire-verify` (incl. failed revision `00001-rl2`) |
| 2 | Artifact Registry repo | `xpp-experiments` | `cloud-run-source-deploy` (3 images @ `gcloud-test-20260619-1308`) |
| 3 | Cloud SQL instance | `xpp-experiments` | `thethinker-verify-20260619` (db `thethinker`) |
| 4 | IAM binding | `xpp-experiments` | `roles/cloudsql.client` on `690448205408-compute@developer.gserviceaccount.com` |

```bash
# 1. Cloud Run
gcloud run services delete thethinker-aspire-verify \
  --region us-central1 --project xpp-experiments --quiet

# 2. Artifact Registry (deletes all images in repo)
gcloud artifacts repositories delete cloud-run-source-deploy \
  --location us-central1 --project xpp-experiments --quiet

# 3. Cloud SQL
gcloud sql instances delete thethinker-verify-20260619 \
  --project xpp-experiments --quiet

# 4. IAM
gcloud projects remove-iam-policy-binding xpp-experiments \
  --member serviceAccount:690448205408-compute@developer.gserviceaccount.com \
  --role roles/cloudsql.client --quiet
```

### 5b — Ledger optional / low-cost leftovers

| Item | Ledger reference | Action |
|---|---|---|
| Enabled APIs | `run`, `cloudbuild`, `cloudresourcemanager`, `sqladmin` | Optional disable — only if no other workloads use the project |
| Cloud Build source blobs | `gs://xpp-experiments_cloudbuild/source/...` | No action — GCS lifecycle handles; note in ledger as N/A |
| Public IAM on test service | `allUsers` invoker (added during verify) | Removed when Cloud Run service is deleted |

Optional API disable:

```bash
gcloud services disable sqladmin.googleapis.com cloudbuild.googleapis.com \
  run.googleapis.com cloudresourcemanager.googleapis.com \
  --project xpp-experiments
```

### 5c — Production `thethinker` Artifact Registry audit

Not in the test ledger — run after production tag pipeline is green, using deploy SA:

```bash
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy \
  --include-tags

gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy \
  --include-tags --filter='NOT tags:*'
```

Policy: keep tags referenced by the live Cloud Run revision; prune orphaned tags after confirming no rollback need.

### 5d — Ledger close-out checklist

After each delete, append to the ledger:

```markdown
## Cleanup completed YYYY-MM-DD
- [ ] Cloud Run thethinker-aspire-verify — deleted
- [ ] AR cloud-run-source-deploy — deleted
- [ ] Cloud SQL thethinker-verify-20260619 — deleted
- [ ] IAM cloudsql.client binding — removed
- [ ] Optional APIs disabled (yes/no)
- [ ] Production AR audit (thethinker) — done / N/A
```

### 5e — Deferred (document only, no cleanup in this plan)

| Item | Notes |
|---|---|
| `k8s/` | School GitLab monolithic backend deploy — separate target from AppHost Cloud Run. Deprecate in README or refresh later. |
| `thethinker` production Cloud Run | **Not** torn down — live service; only orphan image tags are pruned in 5c. |

---

## Ledger → Aspire deployment improvements

Lessons from [gcloud-test-resources.md](../.superpowers/sdd/gcloud-test-resources.md) that
should be reflected in `docs/aspire-deploy.md`, `apphost.mts`, and CI. Most are **already
implemented**; the table notes status.

| Ledger step / failure | Aspire / deployment action | Status |
|---|---|---|
| Missing GCP APIs (`run`, `cloudbuild`, `cloudresourcemanager`) | Document preflight API list for disposable test projects; CI `google/cloud-sdk:slim` job installs `google-cloud-cli-run-compose` | CI done; doc update |
| `run-compose binary not installed` locally | Document `gcloud components install run-compose` + PATH for macOS Homebrew SDK | Doc update |
| Compose referenced `thethinker` AR images from `xpp-experiments` | Test projects must build/push to **their own** registry (`_REGISTRY` substitution) or grant cross-project pull | Doc + ledger |
| Frontend `PORT` env rejected by Cloud Run | `apphost.mts` `configureComposeFile` strips `PORT`; validator rejects it | **Done** |
| `--dry-run` still created Cloud Run revisions | Document: treat dry-run as potentially mutating; use disposable project + ledger | Doc update |
| Browser 403 until `--allow-unauthenticated` | CI dry-run + deploy both pass the flag | **Done** |
| `GCS_CREDENTIALS_JSON='{}'` broke uploads | Never use empty JSON in manual tests; CI uses real `GCS_KEY_JSON` | Doc update |
| `COPY *.py .` failed in Cloud Build | `ai/Dockerfile` → `COPY *.py ./` | **Done** |
| Disposable Cloud SQL `db-f1-micro` invalid on ENTERPRISE_PLUS | Document `--edition=ENTERPRISE` for test instances | Doc update |
| Proxy needs `roles/cloudsql.client` on runtime SA | Document IAM prerequisite for Cloud SQL sidecar | Doc update |
| `aspire publish` needs `await` on `addParameter` before `refExpr` | `apphost.mts` uses `await builder.addParameter("dbPassword", ...)` | **Done** |
| Validator needs `AI_IMAGE`/`BACKEND_IMAGE`/`FRONTEND_IMAGE` env when Compose uses `${...}` | CI exports image vars before `validate:production-compose` | **Done** |
| `npm run test:compose-validation` before cloud mutations | Local + CI gate before `gcloud run compose up` | **Done** |
| Tag push as intentional deploy trigger | `deploy-gcp` `only: tags`; auto-run on tag (manual removed) | Pending commit |
| Resource ledger for all cloud mutations | `.superpowers/sdd/gcloud-test-resources.md` | **Done** — close in Phase 5d |

---

## What we are not cleaning

- Three service `Dockerfile`s — actively built by Cloud Build
- `addDockerComposeEnvironment("compose")` in `apphost.mts` — this **is** the deploy path
- `validate-production-compose.mjs` — active guardrail before mutating deploys
- Dev-only Aspire images (`fake-gcs-server`, Postgres) — needed for `aspire run`
- Production Cloud Run service in `thethinker`

---

## Execution order

```text
Phase 0  Rotate secrets
Phase 1  Delete legacy files + doc updates
Phase 2  (reference — nothing to delete)
Phase 3  (reference — image inventory)
Phase 4  Repo hygiene
         npm run build && npm run test:compose-validation
         aspire publish smoke test
         GitLab tag pipeline (deploy-gcp auto on tag)
Phase 5  FINAL — ledger GCP cleanup + ledger close-out + production AR audit
```

### Preflight commands

```bash
nvm use 22.16.0
npm run build
npm run test:compose-validation

export REGISTRY="us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy"
export IMAGE_TAG="<tag>"
export AI_IMAGE="${REGISTRY}/thethinker-ai:${IMAGE_TAG}"
export BACKEND_IMAGE="${REGISTRY}/thethinker-backend:${IMAGE_TAG}"
export FRONTEND_IMAGE="${REGISTRY}/thethinker-frontend:${IMAGE_TAG}"

# Set Parameters__* like CI, then:
aspire publish -o ./aspire-output --environment production --non-interactive
npm run validate:production-compose -- ./aspire-output/docker-compose.yaml --image-tag "$IMAGE_TAG"
```

---

## Checklist

- [ ] Phase 0: secrets rotated
- [ ] Phase 1: legacy files deleted
- [ ] Phase 1: docs updated
- [ ] Phase 1: `.gitignore` updated
- [ ] Phase 4: `frontend/.env.local` and `backend/coverage` untracked
- [ ] Local gates pass (`build`, `test:compose-validation`, `aspire publish`)
- [ ] GitLab tag pipeline green (`deploy-gcp` auto on tag)
- [ ] **Phase 5a:** ledger GCP resources deleted (approved)
- [ ] **Phase 5b:** optional API disable (approved)
- [ ] **Phase 5c:** production AR audit
- [ ] **Phase 5d:** ledger marked complete
