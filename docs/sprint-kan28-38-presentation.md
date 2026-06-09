---
marp: true
paginate: true
size: 16:9
title: TheThinker — Sprint Review (KAN-28 → KAN-38)
footer: 'TheThinker · Scan · Schedule · Style'
---

<style>
:root {
  --ink:      #0E1024;
  --ink-2:    #1B1E3D;
  --violet:   #7C5CFC;
  --violet-2: #A78BFA;
  --coral:    #FF7A59;
  --mint:     #34D399;
  --paper:    #F7F7FB;
  --text:     #1A1A2E;
  --muted:    #6B7280;
  --line:     #E6E6F0;
}

/* ---------- base content slide ---------- */
section {
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  background: var(--paper);
  color: var(--text);
  padding: 64px 72px;
  font-size: 24px;
  line-height: 1.5;
}

section h1 { font-size: 52px; font-weight: 800; letter-spacing: -0.02em; }
section h2 {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 0 0 24px 0;
  padding-bottom: 14px;
  border-bottom: 4px solid var(--violet);
  display: inline-block;
}
section h3 { font-size: 28px; font-weight: 700; color: var(--violet); }

strong { color: var(--ink); font-weight: 700; }
em { color: var(--muted); }
a { color: var(--violet); }

ul { list-style: none; padding-left: 0; }
ul li { margin: 14px 0; padding-left: 38px; position: relative; }
ul li::before {
  content: '';
  position: absolute; left: 6px; top: 12px;
  width: 12px; height: 12px; border-radius: 3px;
  background: var(--coral);
  transform: rotate(45deg);
}

code {
  background: #ECE9FE;
  color: #5B3FD6;
  padding: 2px 8px; border-radius: 6px;
  font-size: 0.85em;
}
pre {
  background: var(--ink);
  color: #E6E6F0;
  border-radius: 14px;
  padding: 22px 26px;
  font-size: 20px;
  box-shadow: 0 18px 40px rgba(14,16,36,0.25);
}
pre code { background: transparent; color: #E6E6F0; }

/* ---------- tables ---------- */
table { border-collapse: collapse; width: 100%; font-size: 22px; box-shadow: 0 12px 30px rgba(14,16,36,0.08); border-radius: 12px; overflow: hidden; }
thead th { background: var(--ink); color: #fff; padding: 14px 18px; text-align: left; font-weight: 700; }
tbody td { padding: 12px 18px; border-bottom: 1px solid var(--line); background: #fff; }
tbody tr:nth-child(even) td { background: #F1F0FB; }

/* ---------- footer / pagination ---------- */
footer { color: var(--muted); font-size: 14px; font-weight: 600; letter-spacing: 0.04em; }
section::after { color: var(--violet); font-weight: 700; }

/* ---------- "Impact" callout (blockquote) ---------- */
blockquote {
  border-left: 5px solid var(--mint);
  background: #ECFDF5;
  margin: 26px 0 0 0;
  padding: 16px 24px;
  border-radius: 0 12px 12px 0;
  color: #065F46;
  font-style: normal;
}
blockquote strong { color: #047857; }

/* ---------- LEAD (title / closing) ---------- */
section.lead {
  background: radial-gradient(1200px 600px at 80% -10%, #2A2150 0%, transparent 60%),
              linear-gradient(135deg, #0E1024 0%, #2A1B5E 100%);
  color: #fff;
  display: flex; flex-direction: column; justify-content: center;
  text-align: left;
}
section.lead h1 {
  font-size: 76px;
  background: linear-gradient(100deg, #fff 0%, #C4B5FD 60%, #FF9E80 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  margin-bottom: 8px;
}
section.lead h2 { color: #C4B5FD; border: none; font-size: 34px; font-weight: 600; }
section.lead h3 { color: #fff; }
section.lead strong { color: #FF9E80; }
section.lead p { color: #B9B7D0; font-size: 26px; }
section.lead footer, section.lead::after { color: #6F6C99; }

/* ---------- SECTION divider ---------- */
section.section {
  background: linear-gradient(135deg, #7C5CFC 0%, #5B3FD6 100%);
  color: #fff;
  display: flex; flex-direction: column; justify-content: center;
}
section.section h2 { color: #fff; border-bottom: 4px solid #FF9E80; font-size: 44px; }
section.section p { color: #EAE6FF; font-size: 26px; }

/* ---------- pill tag for ticket slides ---------- */
section .pill {
  display: inline-block;
  background: #ECE9FE; color: #5B3FD6;
  font-weight: 800; font-size: 18px; letter-spacing: 0.05em;
  padding: 6px 16px; border-radius: 999px; margin-bottom: 8px;
}
</style>

<!-- _class: lead -->

# TheThinker

## Sprint Review — KAN-28 → KAN-38

**Scan · Schedule · Style**

AI-powered outfit recommendation app

---

## Agenda

| # | Ticket | Theme |
|---|--------|-------|
| 1 | KAN-28 | Connect frontend ↔ backend |
| 2 | KAN-29 | Wardrobe image upload (GCS) |
| 3 | KAN-30 | Clothes classification — schema & UI |
| 4 | KAN-31 | AI classification prototype (CLIP) |
| 5 | KAN-33 | CI coverage + E2E tests |
| 6 | KAN-34 | OpenTelemetry pipeline fix |
| 7 | KAN-35 | Dev database seed |
| 8 | KAN-36 | DB schema — Postgres enums |
| 9 | KAN-37 | Outfit flat-lay + accept |
| 10 | KAN-38 | Item swap bottom sheet |

> _KAN-32 not included — no work landed in the repo this sprint._

---

<!-- _class: section -->

## The Big Picture

This sprint took TheThinker from **disconnected mockups** to a **working vertical slice**:

- 🔌 Frontend now talks to the **real backend API** (no more mocks)
- 📸 Users can **upload wardrobe photos** to cloud storage
- 🤖 Photos get **AI-classified** into category / color / season
- 👕 Users receive a **flat-lay outfit**, can **accept** it or **swap items**
- ✅ Backed by **CI coverage gates**, **E2E tests**, and **telemetry**

---

<span class="pill">KAN-28 · FRONTEND</span>

## Connect Frontend & Backend

**Goal:** Wire the React SPA to the live Go API and remove mock scaffolding.

**What shipped**
- Replaced mock data in Wardrobe, Calendar, and Outfit pages with real API calls
- Hardened the shared API client (`shared/api/client.ts`)
- Removed dead `AddItemPage` and ~3,000 lines of stale scaffolding
- Regenerated contract-aligned types from the OpenAPI spec

> **Impact:** First true end-to-end path — UI ↔ HTTP ↔ backend.

---

<span class="pill">KAN-29 · STORAGE</span>

## Wardrobe Image Upload

**Goal:** Let users upload clothing photos to object storage.

**What shipped**
- Image upload + **optimization pipeline** (resize / compress)
- Storage backend migrated **MinIO → Google Cloud Storage**
- Local **`fake-gcs-server` emulator** wired into `docker-compose` (port 4443)
- Hardened upload handlers; `413 Payload Too Large` response added to spec
- Closed the Aspire upload loop; removed dead code after review

> **Impact:** Real photos flow from device → backend → cloud bucket.

---

<span class="pill">KAN-30 · DATA + UI</span>

## Clothes Classification (Schema & UI)

**Goal:** Model and surface clothing attributes.

**What shipped**
- Classification schema: **category, color, season** attributes
- Wardrobe & Scan pages updated to display/edit classification
- Refactored shared HTTP client (`httpClient.ts`)
- Cleaned up legacy generated schema artifacts

> **Impact:** Wardrobe items are now structured, queryable data — not just images.

---

<span class="pill">KAN-31 · AI</span>

## AI Classification Prototype (CLIP)

**Goal:** Auto-tag uploaded clothing using AI.

**What shipped**
- Prototype clothing classifier built on **CLIP**
- Maps an uploaded image → predicted category / attributes
- Feeds the KAN-30 classification schema automatically

> **Impact:** Removes manual tagging — the "Scan" in *Scan · Schedule · Style*.

---

<span class="pill">KAN-33 · QUALITY</span>

## CI Coverage + E2E

**Goal:** Stop regressions before merge.

**What shipped**
- **Backend coverage threshold** added to CI gate
- **Playwright** E2E smoke test, aligned with the official getting-started guide
- Playwright artifacts ignored at repo root

> **Impact:** CI now enforces a quality floor; first browser-level test in place.

---

<span class="pill">KAN-34 · OBSERVABILITY</span>

## OpenTelemetry Pipeline Fix

**Goal:** Make backend telemetry visible in the Aspire dashboard.

**What shipped**
- Fixed the **OTel gRPC export** path between the Go backend and the Aspire dashboard
- Traces / metrics now flow end-to-end

> **Impact:** Observability works — we can see what the backend is doing in real time.

---

<span class="pill">KAN-35 · DEVEX</span>

## Dev Database Seed

**Goal:** Give every developer realistic local data instantly.

**What shipped**
- `backend/seeds/dev.sql` seed script
- Test user **`dev@thethinker.com` / `password123`**
- **13 wardrobe items** across tops, outerwear, bottoms, shoes — covering all enum values

**Usage:** `psql $DATABASE_URL -f backend/seeds/dev.sql`

> **Impact:** Zero-friction onboarding and reproducible demos.

---

<span class="pill">KAN-36 · DATABASE</span>

## DB Schema: Postgres Enums

**Goal:** Enforce valid clothing attributes at the database level.

**What shipped**
- Replaced free-text `TEXT` columns with **native Postgres enum types**
- Migration `000003_wardrobe_enums`
- Aligned domain + frontend types with the enum contract
- Documented the `AddItem` enum contract

> **Impact:** Invalid categories / colors / seasons are now impossible to persist.

---

<span class="pill">KAN-37 · RECOMMENDATION</span>

## Outfit Flat-Lay + Accept

**Goal:** Show a recommended outfit and let users accept it.

**What shipped**
- New endpoint **`POST /recommendations/outfit/accept`** (spec-first)
- Backend: `MarkWorn` repo method, `MarkItemsWorn` service, `AcceptOutfit` handler + tests
- Frontend: **2-column flat-lay grid** (capped at 10 items), Accept button wired to backend

> **Impact:** The core "Style" loop — see an outfit, commit to it.

---

<span class="pill">KAN-38 · RECOMMENDATION</span>

## Item Swap Bottom Sheet

**Goal:** Let users customize the recommended outfit.

**What shipped**
- Tap any flat-lay item → **bottom sheet** of alternatives
- Filtered to the **same category** and **compatible season**
- Selecting one swaps the item locally and resets the accepted state

> **Impact:** Recommendations become a starting point, not take-it-or-leave-it.

---

## Sprint by the Numbers

| Metric | Value |
|--------|-------|
| 🎫 Tickets shipped | **10** (KAN-28 → KAN-38, excl. KAN-32) |
| 🔀 Commits merged to `main` | **20** |
| 🌐 API endpoints in contract | **11** (1 new: `POST /recommendations/outfit/accept`) |
| 🗄️ DB migrations | **3** (latest: Postgres enum types) |
| 🧪 Test surface | **3 Go test files** + Playwright E2E + CI coverage gate |
| ☁️ Storage | Migrated **MinIO → GCS** + local emulator |
| 🌱 Seed data | **13 wardrobe items** for instant local dev |

---

<!-- _class: section -->

## Sprint Outcome

**End-to-end slice now working:**

```
Upload photo → GCS → CLIP classify → enum-validated wardrobe
   → flat-lay outfit → accept / swap → mark worn
```

- ✅ **Quality foundation:** CI coverage gate · Playwright E2E · OTel telemetry · seed data
- 📐 **Contract-first discipline:** every endpoint updated in `api/openapi.yaml` before code

---

<!-- _class: lead -->

# Thank You

### Questions?

**TheThinker** — Scan · Schedule · Style
