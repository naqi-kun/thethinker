---
name: grill-with-docs
description: Stress-test a plan or design before building it by interrogating it one question at a time against TheThinker's DDD domain model, keeping a per-context glossary (CONTEXT.md) current, and recording costly architectural decisions as ADRs. Use before starting a non-trivial feature, when domain terms feel fuzzy, or when a decision is hard to reverse.
---

# Grill with docs

Most bugs and rewrites come from a fuzzy plan, not bad code. This skill interrogates a design
*before* it's built, aligns it with our domain language, and records the decisions that matter. It is
deliberately slow — that's the point.

Especially valuable here because TheThinker is **Domain-Driven Design**: getting the domain language
and boundaries right up front saves painful refactors later.

## Core rules

- **One question at a time.** Ask a single, specific question, then wait for the answer before the
  next. Never dump a list of questions.
- **Check the code before asking.** If the answer is discoverable in the repo, look it up instead of
  asking. Only ask the human what the code can't tell you.
- **Stress-test with concrete scenarios.** Don't reason in the abstract — invent specific edge cases
  ("what happens to a recommendation if the user has zero wardrobe items?") to probe the boundaries.

## Our domain contexts

TheThinker's bounded contexts live in `backend/internal/domain/`:
`user`, `wardrobe`, `calendar`, `recommendation`, `weather`.

Each context owns its own language. A "scan" means something specific in `wardrobe`; an "event" means
something specific in `calendar`. Keep them straight.

## Steps

1. **Locate or create the glossary.** Each bounded context may have a `CONTEXT.md` at
   `backend/internal/domain/<context>/CONTEXT.md` defining its key terms. If the relevant one doesn't
   exist yet, create it as you go.

2. **Grill the plan, one question at a time.** For the feature being planned, probe:
   - **Terminology:** Does every noun in the plan match a defined term? If the plan says "garment" but
     the glossary says "wardrobe item," surface the mismatch immediately.
   - **Boundaries:** Which bounded context owns this logic? Does the plan accidentally put business
     rules in a handler or infrastructure (violating our DDD rules — see `check-ddd-boundaries`)?
   - **Contract:** Does this touch an endpoint? Then the OpenAPI spec must change first
     (see `add-endpoint`).
   - **Edge cases:** Empty data, missing auth, external API down (weather/calendar), timezone issues.

3. **Update the glossary inline.** As each term gets pinned down, write it into the context's
   `CONTEXT.md` right away — don't batch it for later. Keep docs current as the conversation goes.

   ```markdown
   # <Context> — Glossary

   - **Term** — precise definition in this context's language.
   - **Another term** — definition, and what it is NOT (to prevent confusion).
   ```

4. **Record an ADR only when it earns one.** Create an Architecture Decision Record at
   `docs/adr/NNNN-short-title.md` **only if all three are true**:
   - the decision is **costly to reverse**,
   - it would be **surprising** to a teammate without context, and
   - it came from a **real trade-off** (not an obvious default).

   ```markdown
   # ADR NNNN — <title>

   ## Status
   Accepted · <date>

   ## Context
   The situation and forces at play.

   ## Decision
   What we chose.

   ## Consequences
   What this makes easy, what it makes hard, what we're giving up.
   ```

5. **Stop when the plan has no unresolved branches.** When every term is defined and every edge case
   has an answer, the grilling is done — now it's safe to build.

## Anti-patterns

- Asking ten questions in one message.
- Inventing new domain terms instead of reusing the glossary's.
- Writing an ADR for every small choice (noise drowns the important ones).
- Starting to code while the plan still has open questions.
