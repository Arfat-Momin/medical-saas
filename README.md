# MedSaaS — Medical Practice Management Platform

An offline-first, multi-tenant SaaS platform for clinics and hospitals. Covers
patient registration, appointments, OPD consultations, IPD admissions,
pharmacy, laboratory, billing, and subscription payments — with a web app that
keeps working when the network drops.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Building for production](#building-for-production)
- [Deployment](#deployment)
- [Key concepts](#key-concepts)
- [Scripts reference](#scripts-reference)
- [License](#license)

## Features

| Module | Capabilities |
|---|---|
| **Authentication** | Email/password, Google OAuth, refresh tokens, device sessions, "sign out everywhere" |
| **Patients** | Registration with auto UHID, duplicate detection, medical history, allergies, consultation history |
| **Appointments** | Booking, doctor slots, queue tokens, check-in, start consultation |
| **OPD / Consultation** | Vitals, diagnoses (ICD), prescriptions, lab test ordering, consultation history |
| **IPD** | Locations hierarchy (Facility → Building → Floor → Ward → Room → Bed), admissions, transfers, discharge summaries, nursing notes, doctor rounds, MAR |
| **Pharmacy** | Medicine master, barcode scanning (camera + manual), suppliers, purchases (batch + expiry), FEFO dispense, stock alerts |
| **Laboratory** | Test catalog with reference ranges, order workflow (ordered → collected → resulted → verified), lab invoices |
| **Billing** | Billable items catalog, per-department invoices, combined patient invoice, payments (cash/card/UPI/insurance), refunds, PDF export |
| **Subscriptions** | Razorpay-powered signup, plans, webhook provisioning, manual subscription extension |
| **Platform Admin** | Tenant management, plan management, tenant status, dashboard |
| **Offline-first** | IndexedDB (Dexie) caching, background sync queue with exponential retry, conflict detection, sync issues UI |
| **PWA** | Installable on Android/iOS, service worker, offline shell |
| **Roles & Permissions** | Granular RBAC with self-lockout prevention, per-tenant role editing, platform/tenant permission isolation |
| **Multi-tenant isolation** | Three-layer enforcement (JWT → membership verification → tenant filter) plus Supabase RLS |

## Tech stack

**Frontend**
- React 18 + Vite 5
- TypeScript 5
- TanStack Query v5 (with offline persistence)
- Zustand (auth state)
- Dexie (IndexedDB) for offline-first storage
- React Hook Form + Zod
- TailwindCSS
- React Router v6
- Recharts (dashboard charts)
- html5-qrcode (camera barcode scanning)
- jsbarcode (barcode label printing)
- vite-plugin-pwa

**Backend**
- Node 20 + Express 4
- TypeScript 5 (ESM)
- Supabase (Auth + Postgres + RLS)
- Zod (validation)
- Pino (structured logging)
- Razorpay (subscription payments)
- express-rate-limit, Helmet, CORS

**Infrastructure**
- Supabase (database + auth)
- Vercel (frontend hosting)
- Render or Railway (backend hosting)
- Razorpay (payments)


**Offline-first data flow**

1. User actions write to Dexie immediately and enqueue an operation in the
   sync queue (`queue` table).
2. When online, the sync engine pushes queued operations with idempotency
   keys. The backend's `idempotent` middleware de-duplicates replays.
3. The engine then pulls incremental deltas per entity, scoped by
   `last_pull_at:<tenantId>:<entity>` cursors. An empty local table forces
   a full pull (self-heal against cursor drift).
4. Conflicts surface in a banner; users can retry or discard.

## Project structure

medical-saas/
├── apps/
│ ├── backend/ Express API
│ │ ├── src/
│ │ │ ├── config/ env, logger, supabase clients
│ │ │ ├── middleware/ auth, tenant context, RBAC, rate limit, error handler, idempotency, audit
│ │ │ ├── modules/ one folder per domain (auth, patients, appointments, ...)
│ │ │ │ ├── *.routes.ts route definitions
│ │ │ │ ├── *.service.ts business logic
│ │ │ │ ├── *.repository.ts data access via Supabase
│ │ │ │ └── *.validators.ts Zod schemas
│ │ │ ├── utils/ errors, entitlements, conflict helpers
│ │ │ ├── app.ts Express app factory
│ │ │ └── server.ts entry point
│ │ ├── .env.example
│ │ ├── package.json
│ │ └── tsconfig.json
│ │
│ └── web/ React SPA
│ ├── public/ static assets, manifest, icons
│ ├── src/
│ │ ├── components/ reusable UI (ui/, layout/, print/, dashboard/)
│ │ ├── db/ Dexie schema + local repositories
│ │ ├── hooks/ React Query wrappers per domain
│ │ ├── lib/ api client, queryClient, session helpers
│ │ ├── pages/ one file per route
│ │ ├── repositories/ server-side data access (fetch + Dexie writes)
│ │ ├── stores/ Zustand (auth)
│ │ ├── sync/ offline sync engine, queue, listeners
│ │ ├── App.tsx
│ │ ├── main.tsx
│ │ └── index.css
│ ├── .env.example
│ ├── index.html
│ ├── package.json
│ ├── tailwind.config.js
│ ├── vite.config.ts
│ └── tsconfig.json
│
├── packages/
│ └── shared/ Shared types, permission constants, queue token helpers
│
├── .editorconfig
├── .gitignore
├── .prettierrc
├── package.json Workspace root
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md


---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | ESM + `AbortSignal.timeout` required |
| pnpm | ≥ 9 | `corepack enable && corepack prepare pnpm@latest --activate` |
| Git | any | — |
| Supabase project | — | Free tier is fine |
| Razorpay account | — | Test keys for development |

## Installation

```bash
# 1. Clone the repository
git clone <your-repo-url> medical-saas
cd medical-saas

# 2. Enable pnpm (if not already installed)
corepack enable
corepack prepare pnpm@latest --activate

# 3. Install all workspace dependencies
pnpm install

# 4. Copy the environment templates
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example     apps/web/.env