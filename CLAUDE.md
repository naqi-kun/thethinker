# TheThinker — Frontend

AI-powered outfit recommendation frontend. Users scan their wardrobe, sync their calendar, and receive a daily outfit suggestion based on occasion, weather, and personal style.

**Tagline:** Scan · Schedule · Style

## Stack

| Concern | Technology |
|---|---|
| Runtime | Node 22.16.0 via `nvm` |
| Framework | Vite · React · TypeScript |
| Architecture | Vertical slice |
| Styling | Tailwind v4 via `@tailwindcss/vite` plugin |
| Linting | ESLint |
| Formatting | Prettier |
| API contract | Consumes TheThinker backend OpenAPI endpoints |

## Repository Layout

```text
frontend/
  src/
    app/                            # minimal app shell and global CSS starter
    features/                       # vertical slices by product screen
      auth/
      onboarding/
      calendar/
      outfit/
      wardrobe/
    shared/
      api/                          # API client and contract-aligned types
```

## Frontend Rules

1. Keep feature-specific UI, state, and data access under `frontend/src/features/<feature>/`.
2. Keep shared primitives under `frontend/src/shared/`.
3. Keep app-level composition under `frontend/src/app/`.
4. Use `frontend/src/shared/api/types.ts` for backend contract-aligned types.
5. Use `nvm use` before running Node commands.
6. Run lint, format check, and build before opening a merge request.
7. Run lint, format check, and type check before opening a merge request.

## Key Commands

```bash
nvm use
cd frontend
npm install
npm run dev
npm run lint
npm run format:check
npm run build
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:8080`.
