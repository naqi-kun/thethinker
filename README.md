# TheThinker

> Stop wasting time thinking about what to wear. **Scan · Schedule · Style**

AI-powered outfit recommendation app. Users scan their wardrobe, sync their calendar, and receive a daily outfit suggestion based on occasion, weather, and personal style.

Xsolla School Project · 2025

---

## Repository Structure

```
backend/       ← Go API server (DDD)
frontend/      ← React SPA (Vite + Tailwind v4)
api/           ← OpenAPI spec (shared contract)
k8s/           ← Kubernetes manifests
docker-compose.yml  ← local Postgres for development
```

---

## Getting Started

### Backend

```bash
# Requires Go 1.26 — see backend/.go-version
cd backend
cp .env.example ../.env   # edit with your values
docker compose up -d      # start Postgres
go run ./cmd/api
```

Server starts on `http://localhost:8080`. Hit `GET /healthz` to confirm.

### Frontend

```bash
# Requires Node 22.16.0 via nvm
nvm use
cd frontend
npm install
npm run dev
```

App starts on `http://localhost:5173` and proxies `/api/*` to the backend.

---

## API Reference

Full spec at [`api/openapi.yaml`](api/openapi.yaml).

| Feature | Method | Endpoint |
|---|---|---|
| Auth | `POST` | `/auth/register` · `/auth/login` |
| Preferences | `GET` `PUT` | `/users/me/preferences` |
| Wardrobe | `GET` `POST` | `/wardrobe/items` · `/wardrobe/scan` |
| Calendar | `POST` `DELETE` | `/calendar/connect` · `/calendar/disconnect` |
| Outfit | `GET` | `/recommendations/outfit` |

---

## Team

| Name | Role |
|---|---|
| Naqi | Backend |
| Nabihah | Backend |
| Ilman | — |
| Aizat | Design |
| Cyril | — |
