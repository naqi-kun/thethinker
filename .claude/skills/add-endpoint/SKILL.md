---
name: add-endpoint
description: Add or change an HTTP endpoint the contract-first way for TheThinker. Use whenever a new route, request/response shape, or status code is needed. Enforces the team rule "update the OpenAPI spec before touching backend or frontend code."
---

# Add an endpoint (contract-first)

TheThinker's golden rule: **`api/openapi.yaml` is the single source of truth.** The backend and
frontend both derive from it. Never let code and spec drift. Follow these steps **in order** — do
not skip ahead to the handler.

## 1. Update the spec first

Edit `api/openapi.yaml`:
- Add/modify the path, method, request body, responses, and status codes.
- Reuse existing `components/schemas` where possible; add new ones rather than inlining shapes.
- Match the existing naming/casing conventions already in the file.

Then validate locally before writing any code:

```bash
npx @redocly/cli lint api/openapi.yaml
```

Fix every error and warning before continuing.

## 2. Implement the backend (Go / DDD)

Wire the change through the layers, respecting the boundaries (see the `check-ddd-boundaries` skill):

1. **Domain** (`backend/internal/domain/<bounded-context>/`) — add business logic, entities, and
   the repository *interface*. No infra/interface imports here.
2. **Infrastructure** (`backend/internal/infrastructure/`) — implement repositories / external
   clients the domain interface declares.
3. **Interface** (`backend/internal/interfaces/http/handlers/`) — one handler file per domain. Parse
   the request, call the domain, map errors via `pkg/errors`, write the response that matches the spec.
4. **DI** (`backend/cmd/api/main.go`) — register the route and inject dependencies. *All* wiring
   lives here.

Pick the bounded context from the existing set: `user`, `wardrobe`, `calendar`, `recommendation`,
`weather`. If the endpoint doesn't fit one, stop and discuss with the team before inventing a new context.

Verify:

```bash
cd backend && go build ./... && go vet ./... && go test ./...
```

## 3. Align the frontend contract

Update `frontend/src/shared/api/types.ts` so the TypeScript types match the new spec exactly, then
add the call in the owning feature's API layer under `frontend/src/features/<feature>/`.

Verify:

```bash
nvm use && cd frontend && npm run build && npm run lint
```

## 4. Final check

Run the `pre-mr-check` skill before opening the merge request. Confirm the spec, backend, and
frontend all agree — a green build with a stale spec still counts as broken.

## Quick reference — current endpoints

- `POST /auth/register` · `POST /auth/login`
- `GET /users/me/preferences` · `PUT /users/me/preferences`
- `GET /wardrobe/items` · `POST /wardrobe/scan`
- `POST /calendar/connect` · `DELETE /calendar/disconnect`
- `GET /recommendations/outfit`
