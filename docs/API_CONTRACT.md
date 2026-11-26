# Strata — API Contract (OpenAPI 3.1)

All shared Zod v4 + OpenAPI schemas live in [`packages/api-contract`](../packages/api-contract).

## Conventions
- **Base path:** `/api/v1` (single Hono OpenAPI 3.1 catch-all route at `apps/web/src/app/api/v1/[[...route]]/route.ts`).
- **OpenAPI Spec & Docs:**
  - `GET /api/v1/openapi.json` — generated OpenAPI `3.1.0` specification.
  - `GET /api/docs` — interactive Scalar API reference UI (with route-scoped CSP permitting `https://cdn.jsdelivr.net`).
- **Dual Auth:** Cookie session (`@supabase/ssr`, Web PWA) and `Authorization: Bearer <jwt>` (Android / API clients), validated via `getClaims()` / `getUser()`. User queries always execute through a user-scoped Supabase client so Postgres RLS is enforced.
- **Standardized Errors:** `{ error: string, message: string, details?: unknown }`.
- **Invite Gate:** When `registration_invite_only = true`, authenticated non-admin users with `invite_redeemed_at IS NULL` receive `403 { error: "INVITE_REQUIRED", message: "..." }` on financial endpoints (while `/api/v1/me` remains accessible so clients can display the invite gate screen).

## Implemented Endpoints (PR 2 & PR 3)
- `GET /api/v1/health` *(public)* — lightweight service & DB keepalive ping (`db: "ok" | "unconfigured" | "error"`).
- `GET /api/v1/feature-flags` *(public / optional auth)* — returns active cloud feature flags (filters out disabled `admin_preview` flags for non-admins).
- `GET /api/v1/me` *(auth required, bypasses invite gate)* — returns current user's `profile`, `email`, and `invite_required` flag (plus safe server-side `ADMIN_BOOTSTRAP_EMAIL` promotion).
- `PATCH /api/v1/me` *(auth required, bypasses invite gate)* — updates user preferences (`display_name`, `locale`, `base_currency`, `theme`, `privacy_blur_default`, `onboarding_completed`, partial `wrapped_settings`) under RLS.
- `POST /api/v1/invites/redeem` *(auth required, bypasses invite gate)* — calls `public.redeem_invite_code(p_code)` atomically; returns `400 INVALID_OR_EXPIRED_INVITE_CODE` on invalid/expired codes.
- `POST /api/v1/onboarding/complete` *(auth + invite gate)* — creates starter `accounts` and `categories` and marks `profiles.onboarding_completed = true`.
- `GET /api/v1/sync?since=<ISO>&limit=<1..1000>` *(auth + invite gate)* — incremental delta pull across all 9 user financial tables (`accounts`, `savings_rules`, `categories`, `goals`, `goal_transfers`, `recurring_payments`, `recurring_payment_marks`, `debts`, `transactions`), including soft-delete tombstones (`deleted_at IS NOT NULL`) and `has_more` pagination indicator.
- `POST /api/v1/sync/push` *(auth + invite gate)* — accepts up to 500 offline mutations (`upsert` | `delete`), sorts them in FK dependency order, enforces `user_id` server-side, resolves conflicts via **Last-Write-Wins (LWW)** on `updated_at` (`applied` | `conflict_server_wins` | `rejected`), and applies soft deletes.
