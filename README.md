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

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Aspire CLI | 13.4 | `dotnet tool install -g aspire` |
| Go | 1.25 | `goenv install 1.25.0` |
| Node | 22.16.0 | `nvm install 22.16.0` |
| Docker | any | [docker.com](https://docker.com) |

### Run everything (recommended)

```bash
aspire run
```

This single command starts Postgres, the Go backend, and the React frontend — fully wired with service discovery and telemetry. The Aspire dashboard URL is printed on startup.

### Other Aspire commands

```bash
aspire run          # start all services
aspire stop         # stop all services
aspire ps           # list running resources and their ports
aspire logs backend # stream logs from a specific resource
aspire dashboard    # open the Aspire dashboard in a browser
```

### Individual services (without Aspire)

<details>
<summary>Backend only</summary>

```bash
cd backend
docker compose up -d   # start Postgres
go run ./cmd/api
```

Server starts on `http://localhost:8080`. Hit `GET /healthz` to confirm.
</details>

<details>
<summary>Frontend only</summary>

```bash
nvm use
cd frontend
npm install
npm run dev
```

App starts on `http://localhost:5173` and proxies `/api/*` to the backend.
</details>

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
