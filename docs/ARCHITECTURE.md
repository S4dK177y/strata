# Strata — System Architecture

## Overview
**Strata** is a multi-user, privacy-first personal finance tracker designed for zero-cost hosting on **Vercel Hobby** + **Supabase Free** (leaving room for a second pet project on the same free accounts) and native **Android** client readiness from Day 1.

## Monorepo Structure
- `apps/web`: Next.js App Router PWA + Tailwind CSS v4 + RU/EN i18n + Hono OpenAPI 3.1 REST API (`/api/v1/[[...route]]`).
- `packages/design-tokens`: Single source of truth (`tokens.json`) compiled into CSS variables (`dist/tokens.css`), JS/TS constants, and Kotlin Compose color stubs (`dist/StrataTokens.kt`).
- `packages/finance-core`: Pure TypeScript financial engine operating strictly on integer minor units (`BIGINT` kopecks/cents), validated against platform-agnostic `test-vectors/golden-scenarios.json`.
- `packages/api-contract`: Shared Zod schemas and OpenAPI 3.1 contract definitions for Web and Android.
- `supabase/`: Versioned SQL migrations, RLS policies, triggers, and seed data (added in PR 2).

## Key Architectural Decisions
1. **Unified REST API (`/api/v1`):** Both Web and future Android talk to the same OpenAPI-documented Hono endpoints (Cookie auth for Web, `Authorization: Bearer <jwt>` for Android). User queries execute via user-scoped Supabase clients so Postgres RLS is always enforced.
2. **Offline & Push-Ready Sync:** All user tables include client-generable `UUID`, `created_at`, `updated_at`, and `deleted_at` (soft delete), plus `GET /api/v1/sync?since=...` and `POST /api/v1/sync/push` (PR 2).
3. **Stories Engine & Cloud Feature Flags:** Seasonal Wrapped and admin announcements/feature releases live in cloud DB tables (`feature_flags`, `stories`, `story_slides`) so both Web and Android update without app releases.
4. **Data Protection Strategy (Industry-Standard Fintech Model):** Uses AES-256 disk encryption at rest (Supabase managed storage), TLS 1.3 in transit, strict per-user Postgres RLS (`(SELECT auth.uid()) = user_id`), zero admin `SELECT` access to financial tables, plus upcoming 2FA (TOTP) and active session control (PR 5). Client-side zero-knowledge E2EE on numeric ledger fields is intentionally avoided so server-side aggregates, password recovery, and multi-device sync remain reliable without irreversible data loss on forgotten passwords.
5. **Free-Tier Guardrails:**
   - Single catch-all `/api/v1/[[...route]]` route keeps Vercel function count minimal, pinned to `arn1` (Stockholm) in `apps/web/vercel.json` to match Supabase `eu-north-1`.
   - `.github/workflows/supabase-keepalive.yml` pings `/api/v1/health` every 3 days to prevent 7-day Supabase Free pause.
   - `registration_invite_only = true` by default prevents bot signups from filling the 500 MB DB quota.
