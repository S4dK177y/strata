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

## Implemented Endpoints (PR 2, PR 3, PR 4 & PR 5)
- `GET /api/v1/health` *(public)* — lightweight service & DB keepalive ping (`db: "ok" | "unconfigured" | "error"`).
- `GET /api/v1/feature-flags` *(public / optional auth)* — returns active cloud feature flags (filters out disabled `admin_preview` flags for non-admins).
- `GET /api/v1/me` *(auth + active session required, bypasses invite & MFA gates)* — returns current user's `profile`, `email`, `invite_required`, `aal`, `mfa_enabled`, and `mfa_required` (plus safe server-side `ADMIN_BOOTSTRAP_EMAIL` promotion).
- `PATCH /api/v1/me` *(auth + MFA required, bypasses invite gate)* — updates user preferences (`display_name`, `locale`, `base_currency`, `theme`, `accent`, `privacy_blur_default`, `onboarding_completed`, `tour_completed_at`, `dashboard_layout`, partial `wrapped_settings`) under RLS.
- `GET /api/v1/security/sessions` *(auth + MFA required)* — lists active sessions (`auth.sessions`) with parsed device type/browser/OS (`userAgentFromString`), IP, `aal`, `last_active_at`, and `is_current`.
- `DELETE /api/v1/security/sessions/{id}` *(auth + MFA required)* — revokes an active session immediately (`404 SESSION_NOT_FOUND` if missing; clears local cookie if revoking the current session).
- `POST /api/v1/security/sessions/revoke-others` *(auth + MFA required)* — revokes all other active sessions for the current user.
- `POST /api/v1/security/verify-password` *(auth + MFA required)* — verifies current password in an ephemeral session (`403 INVALID_PASSWORD` on mismatch) for sensitive account flows like email change when 2FA is disabled.
- `POST /api/v1/security/delete-account` *(auth + MFA required)* — verifies current password (plus 6-digit TOTP code when 2FA is enabled), guards against deleting the last administrator (`409 LAST_ADMIN_CANNOT_DELETE`), revokes all sessions globally, and permanently deletes `auth.users` (cascading all user data).
- `POST /api/v1/invites/redeem` *(auth required, bypasses invite gate)* — calls `public.redeem_invite_code(p_code)` atomically; returns `400 INVALID_OR_EXPIRED_INVITE_CODE` on invalid/expired codes.
- `POST /api/v1/onboarding/complete` *(auth + invite gate)* — creates starter `accounts` and `categories` and marks `profiles.onboarding_completed = true`.
- `GET /api/v1/accounts`, `POST /api/v1/accounts`, `PATCH /api/v1/accounts/{id}`, `DELETE /api/v1/accounts/{id}` *(auth + invite gate)* — full CRUD + archive (`is_active`) + soft delete across all 5 account types (`debit`, `credit`, `cash`, `savings`, `deposit`).
- `GET /api/v1/categories`, `POST /api/v1/categories`, `PATCH /api/v1/categories/{id}`, `DELETE /api/v1/categories/{id}` *(auth + invite gate)* — full CRUD + soft delete for `expense` and `income` (including `is_passive`) categories and monthly budget limits.
- `GET /api/v1/transactions`, `POST /api/v1/transactions`, `PATCH /api/v1/transactions/{id}`, `DELETE /api/v1/transactions/{id}` *(auth + invite gate)* — filtered/paginated CRUD + soft delete across all 11 transaction types (`expense`, `income`, `passive_income`, `transfer`, `compensation`, `transit_in`, `transit_out`, `debt_given`, `debt_received_back`, `debt_borrowed`, `debt_paid_back`), confirmed/draft states, strict transfer invariants, and cross-tenant FK reference checks (`400 INVALID_REFERENCE`).
- `GET /api/v1/sync?since=<ISO>&limit=<1..1000>` *(auth + invite gate)* — incremental delta pull across all 9 user financial tables (`accounts`, `savings_rules`, `categories`, `goals`, `goal_transfers`, `recurring_payments`, `recurring_payment_marks`, `debts`, `transactions`), including soft-delete tombstones (`deleted_at IS NOT NULL`) and `has_more` pagination indicator.
- `POST /api/v1/sync/push` *(auth + invite gate)* — accepts up to 500 offline mutations (`upsert` | `delete`), sorts them in FK dependency order, enforces `user_id` server-side, resolves conflicts via **Last-Write-Wins (LWW)** on `updated_at` (`applied` | `conflict_server_wins` | `rejected`), and applies soft deletes.
- `GET /api/v1/export/json` *(auth + invite gate)* — downloads a portable JSON v1.0 backup of the authenticated user's profile and all 9 financial tables under Postgres RLS.
- `GET /api/v1/export/csv` *(auth + invite gate)* — downloads a filtered UTF-8 BOM CSV spreadsheet of transactions with integer-minor formatting and CSV formula-injection neutralization.
- `GET /api/v1/admin/telemetry` *(auth + MFA + admin role)* — returns aggregate-only platform counts from `get_admin_telemetry()`.
- `GET /api/v1/admin/invites`, `POST /api/v1/admin/invites`, `PATCH /api/v1/admin/invites/{id}`, `DELETE /api/v1/admin/invites/{id}` *(auth + MFA + admin role)* — invite code management with auto-generation (`STRATA-XXXX-XXXX`).
- `GET /api/v1/admin/feature-flags`, `PATCH /api/v1/admin/feature-flags/{key}` *(auth + MFA + admin role)* — cloud feature flag management including `admin_preview`.
