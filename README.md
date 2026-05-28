# TheThinker Frontend

> Stop wasting time thinking about what to wear. **Scan · Schedule · Style**

Vite React TypeScript frontend for the TheThinker outfit recommendation app.

## What This Branch Sets Up

- Vite React app with TypeScript under `frontend/`
- Vertical slice folder structure by product feature, aligned with the `KAN-7` design-system research branch
- `nvm` Node version pinning
- ESLint and Prettier
- GitLab CI jobs for frontend linting and build
- `CLAUDE.md` frontend contributor guide
- No Tailwind setup and no implemented frontend pages yet

## Prerequisites

- Node 22.16.0
- `nvm`

## Run Locally

```bash
nvm use
cd frontend
npm install
npm run dev
```

The app starts on `http://localhost:5173`.

## Project Structure

```text
frontend/src/
  app/                 # minimal app shell, global CSS starter
  features/
    auth/              # login/register slice
    onboarding/        # personalized Q/style profile slice
    wardrobe/          # clothes status and scan wardrobe slice
    calendar/          # calendar connection slice
    outfit/            # daily outfit recommendation slice
  shared/
    api/               # backend API client and types
```

Feature folders intentionally contain only entry-point files for now. Teammates can add components, hooks, services, and tests inside the slice they own.

## Checks

```bash
cd frontend
npm run lint
npm run format:check
npm run build
```

## Jira

Ticket: `KAN-5` — Frontend Repository setup.
