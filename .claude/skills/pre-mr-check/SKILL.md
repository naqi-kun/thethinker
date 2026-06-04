---
name: pre-mr-check
description: Run TheThinker's full pre-merge-request gate locally so CI passes on the first try. Use before opening or updating any merge request. Mirrors the .gitlab-ci.yml lint/test/build stages.
---

# Pre-merge-request check

Run the same checks GitLab CI runs, locally, before you push. A red pipeline wastes everyone's time
on a small team — catch it here. Only run the parts you touched, but when in doubt run everything.

## Frontend (if `frontend/` changed)

Mirrors the `frontend-lint` and `frontend-build` CI jobs:

```bash
nvm use
cd frontend
npm ci
npm run lint
npm run format:check
npm run build
```

- `lint` / `format:check` must be clean — CI fails on warnings here.
- `build` runs `tsc -b` first, so this is also the type check.

## Backend (if `backend/` changed)

Mirrors the `backend-lint`, `backend-test`, and `backend-build` CI jobs:

```bash
cd backend
go vet ./...
go test ./...
go build ./...
```

If you changed anything under `internal/domain/`, also run the **`check-ddd-boundaries`** skill.

## API spec (if `api/openapi.yaml` changed)

```bash
npx @redocly/cli lint api/openapi.yaml
```

Confirm backend handlers and `frontend/src/shared/api/types.ts` match the spec. Spec and code drifting
apart is the most common silent break on this project.

## Summary checklist

Report results back as a short checklist so the author can see what passed:

- [ ] frontend: lint · format:check · build
- [ ] backend: vet · test · build
- [ ] DDD boundaries clean (if domain touched)
- [ ] openapi.yaml lints and matches code (if spec touched)
- [ ] commit messages are clear; branch is up to date with `main`

If anything fails, fix it before opening the MR — do not open it "to see if CI passes."
