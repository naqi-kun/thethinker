# AI Workflow Guide — TheThinker

> How our team uses Claude Code (and similar agentic tools) consistently on this repo.
> Read this once, then let the tooling do the heavy lifting.

This is the deliverable from our "Setup AI workflow" task. It explains **what we set up, why, and
how to use it** so everyone on the team — Naqi, Nabihah, Ilman, Aizat, Cyril — gets the same quality
of help from AI agents.

---

## 1. Why bother?

AI agents are only as good as the context and guardrails you give them. Out of the box an agent
doesn't know that our backend is strict DDD, or that `api/openapi.yaml` is the source of truth, or
that the frontend is vertical-slice. It will guess — and guess wrong.

We fix that with two things, both committed to the repo so the whole team shares them:

1. **`CLAUDE.md`** — the project brief the agent reads automatically on every session. Stack, layout,
   rules, commands.
2. **`.claude/skills/`** — reusable, named workflows the agent (and you) can invoke for our most
   common, most rule-heavy tasks.

Inspired by [mattpocock/skills](https://github.com/mattpocock/skills) (skills for real engineers),
but **hand-written for our stack** rather than copied — his are tuned to a TypeScript workflow; ours
match Go DDD + React + OpenAPI.

---

## 2. What's in the repo now

```
CLAUDE.md                         ← project brief, auto-loaded every session
docs/ai-workflow.md               ← this guide
.claude/
  settings.json                   ← shared permission allow-list (committed)
  settings.local.json             ← per-developer overrides (not shared)
  skills/
    add-endpoint/SKILL.md
    check-ddd-boundaries/SKILL.md
    new-frontend-feature/SKILL.md
    pre-mr-check/SKILL.md
    diagnose/SKILL.md
```

---

## 3. The skills, and when to use them

Each skill is a short playbook the agent follows so our conventions are applied the same way every
time. Invoke one by typing `/<skill-name>` in Claude Code, or just describe the task — the agent
picks the matching skill automatically.

| Skill | Use it when… | What it enforces |
|---|---|---|
| **`add-endpoint`** | Adding or changing any HTTP route, payload, or status code | **Spec first**: edit `api/openapi.yaml` → lint → backend (domain→infra→handler→DI) → frontend types |
| **`check-ddd-boundaries`** | After backend changes / in review | Domain never imports infrastructure or interfaces; interfaces in domain, impls in infra; DI only in `main.go` |
| **`new-frontend-feature`** | Adding a new screen or self-contained UI | Vertical-slice layout under `features/<feature>/`; shared stuff stays in `shared/` |
| **`pre-mr-check`** | Before opening/updating a merge request | Runs the same lint/test/build the GitLab CI runs, so the pipeline is green first try |
| **`diagnose`** | Something's broken and the cause isn't obvious | Reproduce → isolate layer → hypothesize → instrument → fix → verify (no shotgun edits) |

### Our two non-negotiable rules (the agent now knows these)

1. **Contract-first.** Never change an endpoint without updating `api/openapi.yaml` first. → `add-endpoint`
2. **Domain isolation.** `internal/domain/**` imports nothing from `infrastructure/**` or
   `interfaces/**`. → `check-ddd-boundaries`

---

## 4. One-time setup for each teammate

1. **Install Claude Code** (CLI, IDE extension, or desktop app).
2. **Clone the repo and open it** — `CLAUDE.md` and `.claude/skills/` load automatically. No install
   step for skills; they live in the repo.
3. **Check `/status`** in Claude Code lists the five skills above. If not, make sure you're at the
   repo root.
4. **Permissions:** `.claude/settings.json` is shared (safe, common commands). Anything personal goes
   in `.claude/settings.local.json`, which is git-ignored — don't commit machine-specific paths there.

That's it. No `npx`, no per-person config.

---

## 5. A typical task, the AI-assisted way

**"Add a `PATCH /wardrobe/items/{id}` endpoint to rename an item."**

1. `/add-endpoint` → agent updates `openapi.yaml`, lints it, then walks the Go layers and updates the
   frontend types.
2. `/check-ddd-boundaries` → confirms the domain layer stayed clean.
3. `/pre-mr-check` → runs frontend + backend + spec checks locally.
4. Open the merge request with a green local run.

Four prompts, conventions applied automatically, CI green on the first push.

---

## 6. How to add or change a skill

Skills are just markdown — anyone can improve them. Open a small MR.

```
.claude/skills/<skill-name>/SKILL.md
```

```markdown
---
name: my-skill
description: One or two sentences. Be specific about WHEN to use it — the agent uses this
  text to decide whether to trigger the skill, so vague descriptions get ignored.
---

# My skill

Numbered, concrete steps. Reference real paths and real commands from this repo. Tell the agent
what NOT to do as well as what to do.
```

Tips that make skills actually work:
- **Trigger on the description.** Lead with the situation ("Use when…"), not the mechanism.
- **Be concrete.** Real file paths, real commands. The agent copies what you write.
- **Encode the "why."** State the rule and the failure it prevents, so the agent applies judgment.
- Keep each skill to one job. Compose them (our skills cross-reference each other).

---

## 7. Known doc drift to clean up (good first issues)

While setting this up we noticed small inconsistencies worth fixing as a team:

- **Go version:** `README.md` says Go **1.26**, but `CLAUDE.md`, `.gitlab-ci.yml`, and
  `backend/.go-version` say **1.25**. Pick one and align all four.
- **Frontend features:** `CLAUDE.md` lists auth/onboarding/calendar/outfit/wardrobe, but the code
  also has `landing/` and `settings/`. Update `CLAUDE.md`.

Keeping these accurate matters more than usual now — the agent treats `CLAUDE.md` as truth.

---

## 8. For the sharing session — talking points

1. **Problem:** AI agents guess our conventions wrong without shared context.
2. **Solution:** `CLAUDE.md` (auto-loaded brief) + `.claude/skills/` (named playbooks), committed so
   everyone shares them.
3. **Demo:** run `/add-endpoint` live on a small endpoint, show contract-first + boundary check.
4. **Inspiration:** mattpocock/skills — but we wrote ours for *our* stack.
5. **Call to action:** use the skills, and improve them via MRs when our conventions evolve.
