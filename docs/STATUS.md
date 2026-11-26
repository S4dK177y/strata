# Strata — Project Status

> Always keep this file up to date at the end of every feature or PR.

## Current Phase
- **Stage 1 (Core MVP):** **PR 1 — Foundation, Monorepo, Design Code, `finance-core` & CI/CD** ✅ **Completed & Verified**.
- **Next Active Task:** **PR 2 — Supabase SQL Migrations + RLS, Hono OpenAPI 3.1 REST API & Delta Sync skeleton**.

## Completed
- Architecture, DB schema, UX navigation, Expressive Neobank visual style, and brand **Strata** approved.
- Monorepo initialized (`npm` workspaces + Turborepo + TypeScript) on `main`.
- Cross-agent documentation (`AGENTS.md`, `CLAUDE.md`, `.agents/skills/strata-ui/`, `docs/*`).
- `@strata/design-tokens` (`tokens.json`, Strata 3-layer neon SVG icon, CSS/JS/Kotlin token generator).
- `@strata/finance-core` (11 transaction types, safe calculator parser, Net Worth, Safe-to-Spend, Promo Radar, NPER Goal Envelopes, 2-way FIFO Debt Ledger, Yearly Wrapped + 9 passing Vitest/Golden tests).
- `@strata/api-contract` (base Zod schemas & enums).
- `@strata/web` (Next.js 15.5.29 + Tailwind v4 runnable PWA shell with Expressive Neobank tokens, RU/EN, Light/Dark, Privacy Blur, CSP/security headers, `/api/v1/health`).
- GitHub Actions CI (`ci.yml`) & 3-day Supabase keepalive workflow (`supabase-keepalive.yml`).
- Verified cleanly with `npm run build:tokens && npm run typecheck && npm run lint && npm run test && npm run build`.

## Infrastructure
- **GitHub:** `https://github.com/S4dK177y/strata`
- **Supabase:** project `strata` (`ref`: `tsqnmgtbmofemqzdjrih`, region `eu-north-1`, org `Диплом`, Free tier)
- **Vercel:** pending GitHub import (`apps/web`, Turborepo)

## Next Up
- **PR 2:** Supabase SQL migrations (all tables, RLS, indexes, triggers, `get_admin_telemetry()`), Hono OpenAPI 3.1 router (`/api/v1/[[...route]]`), `/api/docs`, and base `/sync` endpoints.
- **PR 3:** Auth (Email + Google OAuth), Invite-code gate, 3-step Onboarding, Theme & RU/EN switcher.
- **PR 4:** Accounts, Categories, Transactions (all 11 types), Quick Add with inline calculator.
- **PR 5:** Dashboard, `.xlsx`/`.csv` Universal Importer, Export, `/admin`, Playwright E2E.
