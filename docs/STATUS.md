# Strata — Project Status

> Always keep this file up to date at the end of every feature or PR.

## Current Phase
- **Stage 1 (Core MVP):**
  - **PR 1 — Foundation, Monorepo, Design Code, `finance-core` & CI/CD** ✅ **Completed & Verified**.
  - **PR 2 — Supabase SQL Migrations + RLS, Hono OpenAPI 3.1 REST API & Delta Sync** ✅ **Completed & Verified**.
- **Next Active Task:** **PR 3 — Auth (Email + Google OAuth), Invite-code gate (`redeem_invite_code`), 3-step Onboarding, Theme & RU/EN switcher**.

## Completed
- Architecture, DB schema, UX navigation, Expressive Neobank visual style, and brand **Strata** approved.
- Monorepo initialized (`npm` workspaces + Turborepo + TypeScript) on `main`.
- Cross-agent documentation (`AGENTS.md`, `CLAUDE.md`, `.agents/skills/strata-ui/`, `docs/*`), including explicit preference for proven, secure UI/backend libraries and exclusion of CSV/XLSX import from scope.
- `@strata/design-tokens` (`tokens.json`, Strata 3-layer neon SVG icon, CSS/JS/Kotlin token generator).
- `@strata/finance-core` (11 transaction types, safe calculator parser, Net Worth, Safe-to-Spend, Promo Radar, NPER Goal Envelopes, 2-way FIFO Debt Ledger, Yearly Wrapped + 9 passing Vitest/Golden tests).
- `@strata/api-contract` (expanded Zod v4 + `@hono/zod-openapi` OpenAPI 3.1 schemas for all 15 tables, standardized errors, `/me`, `/feature-flags`, and Delta Sync `pull`/`push` + 5 passing Vitest contract tests).
- **Supabase (`tsqnmgtbmofemqzdjrih`, Postgres 17.12):**
  - Versioned migrations in `supabase/migrations/` (`20261126000001_initial_schema.sql`, `20261126000002_seed_defaults.sql`, `20261126000003_harden_rpc_grants.sql`) applied to live project.
  - All 15 tables with `BIGINT` `*_minor` money columns, `updated_at` & `protect_profile_privileged_fields()` triggers, composite `(user_id, updated_at)` + covering FK indexes, strict `(SELECT auth.uid()) = user_id` RLS, zero admin `SELECT` access on user financial tables, `redeem_invite_code()`, and aggregate-only `get_admin_telemetry()`.
  - Default `feature_flags` seeded (`registration_invite_only = true`, `wrapped_2026 = false / admin_preview = true`, `stories_feed = true`, `android_push_drafts = true`).
  - Generated `apps/web/src/lib/supabase/database.types.ts`.
- **REST API & Sync (`apps/web`):**
  - Unified Hono OpenAPI 3.1 catch-all router (`/api/v1/[[...route]]`) + interactive Scalar docs (`/api/docs` with route-scoped CSP in `next.config.ts`).
  - Dual Cookie (`@supabase/ssr`) + Bearer JWT auth and `registration_invite_only` Invite Gate middleware (`403 INVITE_REQUIRED`).
  - Implemented `/api/v1/health` (with DB keepalive ping), `/api/v1/openapi.json`, `/api/v1/feature-flags`, `/api/v1/me`, `/api/v1/sync`, and `/api/v1/sync/push` (FK ordering + LWW conflict resolution + soft delete) + 6 passing Vitest API tests.
- Verified cleanly with `npm run build:tokens && npm run typecheck && npm run lint && npm run test && npm run build && npm audit --omit=dev --audit-level=high` and live `next start` smoke test against Supabase.

## Infrastructure
- **GitHub:** `https://github.com/S4dK177y/strata`
- **Supabase:** project `strata` (`ref`: `tsqnmgtbmofemqzdjrih`, region `eu-north-1`, Free tier)
- **Vercel:** connected to `S4dK177y/strata` (`apps/web`)

## Next Up
- **PR 3:** Auth (Email + Google OAuth), Invite-code gate, 3-step Onboarding, Theme & RU/EN switcher.
- **PR 4:** Accounts, Categories, Transactions (all 11 types), Quick Add with inline calculator.
- **PR 5:** Dashboard, Export, `/admin`, Playwright E2E.
