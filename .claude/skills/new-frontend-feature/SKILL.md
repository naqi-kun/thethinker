---
name: new-frontend-feature
description: Scaffold a new frontend vertical slice for TheThinker following the team's feature-folder conventions. Use when adding a new product screen or self-contained piece of UI to the React app.
---

# New frontend feature (vertical slice)

TheThinker's frontend is organized by **vertical slice** — everything a single product screen needs
lives together under `frontend/src/features/<feature>/`. Shared primitives go in `shared/`, never
inside a feature.

## Conventions (from CLAUDE.md + current code)

- Feature-specific UI, state, and data access → `frontend/src/features/<feature>/`.
- Reusable primitives → `frontend/src/shared/` (`shared/components`, `shared/utils`, `shared/api`).
- App-level composition (routing, shell, global CSS) → `frontend/src/app/`.
- Backend contract-aligned types → `frontend/src/shared/api/types.ts` (do not redefine per feature).

Existing features for reference: `auth`, `onboarding`, `calendar`, `outfit`, `wardrobe`, `landing`,
`settings`. Read the closest existing one before scaffolding — match its structure, not this template
blindly.

## Steps

1. **Confirm it's a feature, not a shared primitive.** If two+ features would use it, it belongs in
   `shared/`.

2. **Create the slice:**

   ```
   frontend/src/features/<feature>/
     components/        # presentational + container components for this screen
     <feature>.api.ts   # axios calls; import types from shared/api/types.ts
     index.ts           # public surface of the slice (what app/ may import)
   ```

   Look at how `auth/` or `outfit/` actually lay this out and mirror it — the components subfolder is
   the established pattern.

3. **Wire routing** in `frontend/src/app/` (react-router-dom is already a dependency). Only `app/`
   composes features into routes.

4. **Types come from the contract.** Any data from the backend must use types in
   `shared/api/types.ts`, which mirror `api/openapi.yaml`. If the type is missing, the endpoint may
   not exist yet — use the `add-endpoint` skill.

5. **Styling:** Tailwind v4 via the `@tailwindcss/vite` plugin. Use `clsx` / `tailwind-merge` for
   conditional classes (both already installed). Icons via `lucide-react`.

## Verify

```bash
nvm use
cd frontend
npm run lint
npm run format:check
npm run build
```

All three must pass before opening a merge request (mirrors the `frontend-lint` and `frontend-build`
CI jobs). The `pre-mr-check` skill runs the full gate.
