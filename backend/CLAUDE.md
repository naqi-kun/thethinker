# TheThinker — Backend

AI-powered outfit recommendation service. Users scan their wardrobe, sync their calendar, and receive a daily outfit suggestion based on occasion, weather, and personal style.

**Tagline:** Scan · Schedule · Style

## Stack

| Concern | Technology |
|---|---|
| Language | Go 1.26 (pinned in `.go-version`) |
| Architecture | Domain-Driven Design (DDD) |
| API contract | OpenAPI 3.0 (`../api/openapi.yaml` — repo root) |
| Database | TBD — Postgres assumed; stubs in `internal/infrastructure/persistence/postgres/` |
| CI/CD | GitLab CI (`../.gitlab-ci.yml` — repo root) |
| Deployment | Kubernetes (`../k8s/` — repo root) |
| Observability | Datadog (`dd-trace-go` — not yet wired) |
| Frontend | React (separate repo) — consumes this API |

## Repository Layout

All paths below are relative to `backend/`.

```
cmd/
  api/
    main.go                         ← entrypoint; wires all dependencies via DI

internal/
  domain/                           ← pure business logic; no infra imports allowed
    user/
      entity.go                     ← User, Preferences structs
      repository.go                 ← Repository interface
      service.go                    ← business logic stub
    wardrobe/
      entity.go                     ← ClothingItem struct
      repository.go
      service.go
    calendar/
      entity.go                     ← CalendarConnection, Event structs
      repository.go
      service.go
    recommendation/
      entity.go                     ← OutfitRecommendation struct
      service.go                    ← depends on wardrobe, calendar, weather
    weather/
      entity.go                     ← Conditions struct
      service.go

  infrastructure/
    persistence/
      postgres/                     ← DB implementations (stubs — DB not yet connected)
        user_repository.go
        wardrobe_repository.go
        calendar_repository.go
    external/
      weather/
        client.go                   ← 3rd-party weather API stub
      calendar/
        client.go                   ← Google / Apple Calendar OAuth stub

  interfaces/
    http/
      handlers/                     ← one handler file per domain
        user_handler.go
        wardrobe_handler.go
        calendar_handler.go
        recommendation_handler.go
      middleware/
        auth.go                     ← JWT validation stub

pkg/
  errors/errors.go                  ← AppError type and sentinel errors
  logger/logger.go                  ← structured JSON logger (slog)
```

Shared repo-root resources (outside `backend/`):

```
../api/openapi.yaml                 ← source of truth for all HTTP endpoints
../k8s/                             ← Kubernetes manifests
../docker-compose.yml               ← local Postgres for development
```

## Domain Rules

1. `internal/domain/**` must **never** import `internal/infrastructure/**` or `internal/interfaces/**`.
2. Repository interfaces live in the domain package; implementations live in infrastructure.
3. All dependency injection is wired in `cmd/api/main.go`.
4. The infrastructure `postgres` package uses `var _ domain.Repository = (*Impl)(nil)` to enforce interface compliance at compile time.

## Domains and What They Own

| Domain | Owns |
|---|---|
| `user` | Auth (register/login), profile, style preferences |
| `wardrobe` | Clothing catalog, AI scan ingestion |
| `calendar` | Google/Apple OAuth, event fetching and classification |
| `recommendation` | Outfit selection logic (depends on wardrobe + calendar + weather) |
| `weather` | External weather API abstraction |

## Key Commands

Run from the `backend/` directory:

```bash
go build ./...     # build all packages
go vet ./...       # static analysis
go test ./...      # run tests
```

## OpenAPI Spec

`../api/openapi.yaml` is the contract between this backend and the React frontend. **Do not add or change HTTP endpoints without updating the spec first.**

Endpoints at a glance:
- `POST /auth/register` · `POST /auth/login`
- `GET /users/me/preferences` · `PUT /users/me/preferences`
- `GET /wardrobe/items` · `POST /wardrobe/scan`
- `POST /calendar/connect` · `DELETE /calendar/disconnect`
- `GET /recommendations/outfit`

To validate the spec locally:
```bash
npx @redocly/cli lint ../api/openapi.yaml
```

## Database (not yet connected)

When ready to wire the DB:
1. Add `github.com/jackc/pgx/v5` to `go.mod`
2. In `main.go`: `db, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))`
3. Pass the pool into each `postgres.New*Repository(db)` constructor
4. Run migrations before starting the server (migration tool TBD — consider `golang-migrate`)
5. `DATABASE_URL` is injected via a Kubernetes Secret (see `../k8s/deployment.yaml`)

## Datadog (not yet wired)

When ready:
1. Add `gopkg.in/DataDog/dd-trace-go.v1` to `go.mod`
2. Initialize tracer in `main.go` before `ListenAndServe`
3. Add Datadog HTTP middleware in `internal/interfaces/http/middleware/`
4. The logger in `pkg/logger` is structured JSON (slog) — swap the handler for Datadog log injection
5. Enable the Datadog admission controller annotation in `k8s/deployment.yaml`

## Go Version Management

Go version is pinned to `1.26.0` in `.go-version`.

- **Linux / Mac:** use `gvm` — `gvm install go1.26.0 && gvm use go1.26.0`
- **Windows:** use `goenv` — `goenv install 1.26.0 && goenv global 1.26.0`

## GitLab CI

Pipeline stages: `lint → test → build → docker-build`

Docker images are pushed to the GitLab Container Registry on every merge to `main`. The image tag is `$CI_COMMIT_SHA` for traceability plus `latest` for convenience.
