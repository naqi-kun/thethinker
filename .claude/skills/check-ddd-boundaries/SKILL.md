---
name: check-ddd-boundaries
description: Verify TheThinker's Go backend respects its DDD layering rules. Use after backend changes, during code review, or when an import feels like it crosses a layer. Catches the domain layer importing infrastructure or interfaces.
---

# Check DDD boundaries

TheThinker's backend is Domain-Driven Design. The architecture only holds if the dependency rules
hold. This skill verifies them mechanically and by reading.

## The rules (from CLAUDE.md)

1. `internal/domain/**` must **never** import `internal/infrastructure/**` or `internal/interfaces/**`.
2. Repository *interfaces* live in the domain package; *implementations* live in infrastructure.
3. All dependency injection is wired in `cmd/api/main.go` — nowhere else.

Dependencies point inward: `interfaces → domain`, `infrastructure → domain`. The domain depends on
nothing but the standard library and `pkg/`.

## Mechanical check

Run from the repo root. Any output here is a **violation**:

```bash
# Rule 1: domain must not import infrastructure or interfaces.
# Module path is school-gitlab.xsolla.dev/team3/thethinker (see backend/go.mod).
grep -rn -E "thethinker/internal/(infrastructure|interfaces)" backend/internal/domain/ || echo "OK: domain is clean"
```

```bash
# Rule 3: DI / route registration should only live in main.go.
# A handler or repo constructing its own concrete dependencies is a smell — review hits outside cmd/api.
grep -rln "func main" backend/ ; echo "^ DI belongs only in cmd/api/main.go"
```

> Adjust the module path prefix (`thethinker/...`) to match the real module name in `backend/go.mod`
> if the grep returns nothing unexpectedly.

## Reading check

Mechanical grep won't catch everything. For each changed file in `backend/internal/domain/`, confirm:

- It imports only the standard library, `pkg/`, and other domain packages.
- Any repository or external dependency is referenced through an **interface defined in this domain
  package**, not a concrete type.
- No HTTP, SQL, JSON-wire, or third-party SDK types leak in. Those belong in infrastructure/interfaces.

For each changed file in `backend/internal/infrastructure/`, confirm it *implements* a domain
interface rather than defining new business rules.

## If you find a violation

Don't "fix" it by loosening the rule. Move the code to the correct layer:
- Business logic that snuck into a handler → push down into `domain/`.
- A concrete DB/HTTP type used in `domain/` → define an interface in `domain/`, implement it in
  `infrastructure/`, and wire it in `cmd/api/main.go`.

Then re-run the mechanical check and `cd backend && go build ./... && go vet ./...`.
