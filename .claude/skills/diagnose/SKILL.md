---
name: diagnose
description: Systematic debugging loop for TheThinker — reproduce, isolate, hypothesize, instrument, fix, verify. Use when something is broken, a test fails, or behavior is wrong and the cause isn't obvious. Resist guessing or shotgun edits.
---

# Diagnose

When something's broken, don't guess and patch. Run the loop. The goal is to *understand* the bug
before changing code — a fix you can't explain isn't a fix.

## The loop

1. **Reproduce.** Get a reliable, minimal repro. Exact request, exact steps, exact error.
   - Backend logs: `cat /tmp/thethinker.log` (or wherever the run writes), plus `slog` output.
   - API: `curl -s http://localhost:8080/<path>` and check the status + body.
   - Frontend: browser console + network tab; note which `/api/*` call fails.
   - A bug you can't reproduce on demand, you can't confirm you fixed.

2. **Isolate the layer.** This is a layered app — pin *where* it breaks before *why*:
   - Frontend rendering/state, or the API call itself?
   - HTTP handler (`interfaces/http`), domain logic (`domain/`), or infrastructure (DB, external API)?
   - Is the OpenAPI contract out of sync with reality? (Very common here — check `api/openapi.yaml`
     against the actual request/response.)

3. **Hypothesize.** State one specific, falsifiable cause: "the handler returns 500 because the
   wardrobe repo query expects a non-null `user_id` that the JWT middleware didn't set." One
   hypothesis at a time.

4. **Instrument.** Add a targeted log / assertion / breakpoint that would *prove or disprove* the
   hypothesis. Don't fix yet — confirm first. Use the structured logger (`pkg/logger`) on the backend.

5. **Fix at the right layer.** Once confirmed, fix where the cause actually lives, respecting DDD
   boundaries (see `check-ddd-boundaries`). Don't paper over a domain bug in the handler.

6. **Verify.** Re-run the original repro — it must now pass. Then:
   - Backend: `cd backend && go test ./...`
   - Frontend: `cd frontend && npm run build`
   - Add or update a test that would have caught this bug.

7. **Clean up.** Remove temporary instrumentation/logs you added for the hunt.

## Anti-patterns

- Changing multiple things at once — you won't know what fixed it.
- "Fixing" by retrying, adding sleeps, or catching-and-ignoring errors.
- Editing the spec or a test to match buggy behavior instead of fixing the behavior.
- Declaring it fixed without re-running the repro.

## Common TheThinker suspects

- **Contract drift:** `openapi.yaml` ≠ handler ≠ `shared/api/types.ts`.
- **Auth:** JWT not validated/propagated by `interfaces/http/middleware/auth.go`.
- **DB:** Postgres not up (`docker compose up -d`), or a missing migration.
- **Env:** missing `.env` values (`Test-Path .env`).
- **Proxy:** frontend `/api/*` not reaching `http://localhost:8080`.
