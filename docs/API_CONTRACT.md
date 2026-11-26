# Strata — API Contract (OpenAPI 3.1)

All shared Zod schemas live in `packages/api-contract`.

## Conventions
- **Base path:** `/api/v1` (implemented via Hono catch-all route in PR 2, with OpenAPI spec at `/api/v1/openapi.json` and interactive docs at `/api/docs`).
- **Auth:** Cookie session (Web PWA) and `Authorization: Bearer <jwt>` (Android).
- **Invite Gate:** When `registration_invite_only = true`, users without `invite_redeemed_at` (and non-admin) receive `403 { error: "INVITE_REQUIRED" }` on financial endpoints.
- **Idempotency & Sync:**
  - Client-generated UUIDs supported on all resource creates.
  - `GET /api/v1/sync?since=<ISO>` & `POST /api/v1/sync/push` for Android offline delta sync (last-write-wins via `updated_at` + soft-delete `deleted_at`).
- **Healthcheck:** `GET /api/v1/health` (public, lightweight check used by CI and Supabase keepalive).
