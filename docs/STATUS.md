# Strata — Project Status

> Always keep this file up to date at the end of every feature or PR.

## Current Phase
- **Stage 1 (Core MVP):**
  - **PR 1 — Foundation, Monorepo, Design Code, `finance-core` & CI/CD** ✅ **Completed & Verified**.
  - **PR 2 — Supabase SQL Migrations + RLS, Hono OpenAPI 3.1 REST API & Delta Sync** ✅ **Completed & Verified**.
  - **PR 3 — Auth (Email & Password), Invite-code gate (`redeem_invite_code`), 3-step Onboarding, Theme & RU/EN switcher** ✅ **Completed & Verified**.
  - **PR 4 — Accounts, Categories, Transactions (all 11 types), Quick Add with inline calculator** ✅ **Completed & Verified**.
  - **PR 4.5 — UX & Auth Polish** *(soft-edge Privacy Blur, neutral duplicate-signup handling, password confirmation, sign-out on onboarding, per-route skeletons, alive login & View Transition screen switching)* ✅ **Completed & Verified**.
  - **PR 5 — Account Security & Session Control** *(2FA TOTP via Supabase MFA with RLS/SSR/API enforcement, active session tracking & instant revocation with device/browser/OS/IP, permanent account deletion with password + TOTP confirmation)* ✅ **Completed & Verified**.
  - **PR 5.5 — 2FA UX Polish, Accent Palettes & Safe Email Change** *(post-2FA login flash animation, auto-verifying `Dot → Digit` OTP input without submit button, 5 accent palettes `emerald`/`ocean`/`amethyst`/`sunset`/`graphite` with warm amber Sunset contrast, and TOTP-or-password verified email change)* ✅ **Completed & Verified**.
- **Next Up:**
  - **PR 6 — Dashboard, Interactive Spotlight Onboarding Tour, Export, `/admin`, Playwright E2E** *(interactive feature tour with step highlights/skip/replay + analytics, export & admin panel)*.

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
- **PR 3 (Auth, Invite Gate, Onboarding, Theme & i18n):**
  - Updated `@strata/design-tokens` with `color-scheme: light dark` + `<meta name="color-scheme">` CSS mapping and OS fallback.
  - Extended `@strata/api-contract` (`packages/api-contract/src/profile.ts`) and Hono OpenAPI 3.1 API with `PATCH /api/v1/me`, `POST /api/v1/invites/redeem` (wrapping `redeem_invite_code`), and `POST /api/v1/onboarding/complete` + 100% passing contract & API Vitest suites (6 + 9 + 9 tests).
  - Implemented Next.js 16 `src/proxy.ts` (`updateSession` via `getClaims()`), `getServerSessionGate()`, `maybeBootstrapAdmin()`, and PKCE auth routes (`/auth/callback`, `/auth/confirm`, `/auth/signout`).
  - Built Expressive Neobank UI primitives (`apps/web/src/components/ui/*` using Radix UI, `lucide-react`, `sonner` strictly on `--strata-*` tokens), zero-FOUC `ThemeProvider` (`system` | `light` | `dark`), SSR-synced `RU` / `EN` i18n, global `PrivacyProvider`, `AppShell`, `/login`, `/reset-password`, `/invite`, 3-step `/onboarding`, real DB-backed `/`, and `/settings`.
  - Verified cleanly via `build:tokens`, `typecheck`, `lint`, `test` (24 Vitest tests total), `next build`, `npm audit --omit=dev --audit-level=high` (0 vulnerabilities), and live `next start` smoke test against Supabase.
- **PR 4 (Accounts, Categories, Transactions across all 11 types & Global Quick Add):**
  - Extended `@strata/finance-core` (`evaluateSignedAmountExpression`) and `@strata/api-contract` (`accounts.ts`, `categories.ts`, `transactions.ts` OpenAPI 3.1 CRUD & invariant schemas).
  - Implemented authenticated, invite-gated REST endpoints `/api/v1/accounts`, `/api/v1/categories`, and `/api/v1/transactions` (with FK reference ownership verification, filtering, pagination, draft confirmation, and soft-delete sync tombstones).
  - Built native `<dialog>` modal/bottom-sheet primitive (`apps/web/src/components/ui/dialog.tsx` with `DialogPortalContext` for Radix `Select` top-layer support and accessible post-interaction error validation), curated monochrome icon registry (`src/lib/category-icons.ts`), and global `QuickAddProvider` + `QuickAddDialog` (all 11 types, inline calculator + operator toolbar, Swap transfers, `draft` support, `N` shortcut).
  - Implemented `/operations` (month switcher, `computePeriodSummary` KPI strip, search/type/account/category/status filters, date-grouped ledger, 1-click draft confirmation), `/capital` (Accounts & Categories tabs with live balances, credit limit utilization, monthly category spend progress, archive/restore, and soft delete), and upgraded `/` Overview (live Aurora Hero quick actions, Monthly Snapshot, Recent Operations).
  - Optimized page navigation (`apps/web/vercel.json` `arn1` region co-location with Supabase `eu-north-1`, shared `(app)/layout.tsx` + `loading.tsx` skeleton, React `cache()` on `getServerSessionGate()`, removed serial `maybeBootstrapAdmin()` call for existing admins, and `experimental.staleTimes` dynamic cache), polished responsive layouts (`360px` mobile safe-area & sticky `lg` sidebar), and added GPU-composited aurora drift + `@starting-style` / `allow-discrete` `<dialog>` top-layer animations.
- **PR 5 (Account Security & Session Control):**
  - Applied migration `20261126000004_account_security_sessions.sql` to live Supabase (`tsqnmgtbmofemqzdjrih`): `private.*` `SECURITY DEFINER` helpers, `RESTRICTIVE` RLS policies for instant session revocation and opt-in `aal2` enforcement, and `get_my_auth_state` / `get_my_sessions` / `revoke_my_session` / `revoke_other_sessions` RPCs (with `anon` `EXECUTE` revoked).
  - Added `"surface.qr"` token in `@strata/design-tokens` and OpenAPI 3.1 security schemas in `@strata/api-contract` (`src/security.ts`, `MeResponseSchema` security status fields).
  - Implemented `parseSessionUserAgent` (`userAgentFromString` + `StrataAndroid` support), `getServerSessionGate()` `session_revoked` & `needs_mfa` states, local-scoped `/auth/signout`, `401 SESSION_REVOKED` & `403 MFA_REQUIRED` middleware enforcement, and `/api/v1/security/{sessions,sessions/{id},sessions/revoke-others,delete-account}` endpoints (with password verification, conditional TOTP verification, ephemeral session cleanup, and last-admin protection).
  - Built `/mfa-verify` (`MfaVerifyCard`), updated `/login` (`AuthCard` post-login `AAL2` redirect + `session_revoked` / `deleted` notices), and added `TotpSecurityCard`, `ActiveSessionsCard`, and `DangerZoneCard` in `/settings` with full RU/EN i18n.
- **PR 5.5 (2FA UX Polish, Accent Palettes & Safe Email Change):**
  - Moved `triggerAuthFlash` + `entering` animation from `/login` to post-2FA verification on `/mfa-verify`, and built `OtpCodeInput` with `Dot → Digit` slot animation and immediate auto-verification on the 6th digit (no submit button).
  - Added `profiles.accent` migration (`20261126000005_profile_accent.sql`), 5 token-driven accent palettes (`emerald`, `ocean`, `amethyst`, `sunset`, `graphite` via `data-accent` + zero-FOUC init script + `AccentSwitcher` in Settings & Onboarding Step 1, keeping income/expense semantic colors intact and `sunset` strictly warm amber/bronze).
  - Added `POST /api/v1/security/verify-password` and `ChangeEmailDialog` (TOTP-only verification when 2FA is active; current password verification when 2FA is off).

## Infrastructure
- **GitHub:** `https://github.com/S4dK177y/strata`
- **Supabase:** project `strata` (`ref`: `tsqnmgtbmofemqzdjrih`, region `eu-north-1`, Free tier)
- **Vercel:** connected to `S4dK177y/strata` (`apps/web`)

## Next Up
- **PR 6:** Dashboard analytics, interactive spotlight onboarding tour, Export, `/admin`, Playwright E2E.
