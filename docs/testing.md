# Testing Guide — TheThinker

How tests run locally and in CI. Set up in **KAN-33**.

## Overview

| Layer | Tool | CI job | Gate |
|---|---|---|---|
| Backend unit tests | `go test` | `backend-test` | **Coverage threshold** (module-wide statements) |
| Frontend lint/format/build | ESLint · Prettier · `tsc`+Vite | `frontend-lint`, `frontend-build` | must pass |
| API contract sync | `openapi-typescript` | `frontend-schema-sync` | generated types must match the spec |
| End-to-end smoke | Playwright | _(local for now)_ | run manually |

---

## Backend — Go unit tests + coverage threshold

Run the tests:

```bash
cd backend
go test ./...
```

CI (`backend-test`) measures **module-wide statement coverage** with `-coverpkg=./...`
and fails if it drops below `COVERAGE_THRESHOLD` (set in `.gitlab-ci.yml`).

Reproduce the CI gate locally:

```bash
cd backend
go test -coverpkg=./... -coverprofile=coverage.out ./...
go tool cover -func=coverage.out | tail -1     # see the total %
go tool cover -html=coverage.out               # browse coverage in a browser
```

### The coverage threshold

- Baseline at introduction (KAN-33): **~10%** module-wide; threshold set to **10**.
- **Ratchet, never lower it.** When you add tests and coverage rises, bump
  `COVERAGE_THRESHOLD` in `.gitlab-ci.yml` to lock in the gain.
- Good first targets for new tests: pure logic in `internal/domain/**` and helpers
  in `pkg/**` (see `pkg/token`, `internal/domain/wardrobe` for examples).

---

## Frontend — end-to-end smoke tests (Playwright)

A minimal Playwright setup lives in `frontend/`. The config auto-starts the Vite dev
server, so you don't need to launch anything first. The current smoke test only covers
pages that render **without the backend** (landing, login), so it's self-contained.

First-time setup (downloads the browser):

```bash
cd frontend
npm install
npm run e2e:install        # downloads Chromium
```

Run the smoke tests:

```bash
npm run e2e                # headless
npm run e2e:ui             # interactive UI mode (great for debugging)
```

Files:
- `frontend/playwright.config.ts` — config (auto-boots `npm run dev` on :5173)
- `frontend/e2e/smoke.spec.ts` — the smoke test

### Notes & next steps
- e2e is **not yet wired into CI** — it's local-only for now (KAN-33 scope was to
  explore a basic smoke test). Adding a CI job means booting the full stack
  (frontend + backend + db) in the pipeline; track that as a follow-up.
- To cover authenticated flows (wardrobe, upload), the test would need the backend
  running and a seeded/registered user — out of scope for the smoke test.
