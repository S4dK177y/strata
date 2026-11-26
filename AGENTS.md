# AGENTS.md — Strata Engineering Guide (Cross-Agent)

This file is the single source of truth for **any AI coding agent** (Antigravity, OpenCode, Claude Code, Codex, Cursor) working in the **Strata** repository.

## 1. Quick Orientation (Read First!)
Before making changes in any new chat or session:
1. Read `docs/STATUS.md` to see the current milestone, completed PRs, and next exact task.
2. Read the domain/spec doc relevant to your task:
   - UI / layout / styling → `docs/DESIGN_SYSTEM.md` (and `.agents/skills/strata-ui/SKILL.md`)
   - Financial math / formulas → `docs/DOMAIN_MATH.md` & `packages/finance-core/`
   - Database / migrations / RLS → `docs/DB_SCHEMA.md`
   - REST API / OpenAPI / Sync → `docs/API_CONTRACT.md`
   - Overall architecture → `docs/ARCHITECTURE.md`

## 2. Project Identity & Stack
- **Brand:** **Strata** (Страта) — open-source personal finance PWA & future native Android client.
- **Visual Style:** **Expressive Neobank** (deep obsidian/light-mist surfaces, subtle glassmorphism, crisp neon-gradient accents, `tabular-nums` for money, Light + Dark + System themes, Privacy Blur mode).
- **Package Manager:** **npm workspaces** (`apps/*`, `packages/*`). Do **NOT** use `pnpm` or `"workspace:*"` syntax — internal dependencies MUST use `"*"`.
- **Commands:**
  - `npm run build:tokens` — rebuild CSS / JS / Kotlin tokens from `packages/design-tokens/tokens.json`
  - `npm run typecheck` — TypeScript check across all workspaces
  - `npm run lint` — lint across workspaces
  - `npm run test` — run Vitest unit & Golden Math tests
  - `npm run build` — full production build via Turborepo

## 3. Non-Negotiable Engineering Rules
1. **Money is ALWAYS integer minor units (`BIGINT` / integer kopecks or cents):**
   - Fields end with `*_minor` (e.g., `amount_minor = 15000` for `150.00`).
   - NEVER use floating-point numbers (`float`, `REAL`, `DOUBLE`) for balances or ledger math.
   - All `transactions.amount_minor` values are strictly positive (`> 0`); direction is determined by `type`.
2. **Single Source of Financial Math (`packages/finance-core`):**
   - Never duplicate balance, Net Worth, Safe-to-Spend, NPER, Promo Radar, Debt FIFO, or Wrapped math inside UI components or SQL views without matching `packages/finance-core`.
   - Any math change MUST update/verify `packages/finance-core/test-vectors/golden-scenarios.json`.
3. **Strict Design System Compliance:**
   - NEVER hardcode raw hex colors or default Tailwind palette grays (`bg-gray-900`, `text-slate-400`, `#123456`) in feature components.
   - Always use semantic CSS tokens (`var(--strata-*)`) and UI primitives from `apps/web/src/components/ui/`.
   - Every monetary figure must support the global Privacy Blur mode (`.strata-money` / `AmountText`).
4. **Privacy by Design & RLS:**
   - Every user table MUST have RLS enabled using `(SELECT auth.uid()) = user_id`.
   - Role `admin` MUST NEVER have `SELECT` access to other users' financial tables (`accounts`, `transactions`, `debts`, `goals`, `savings_rules`, `recurring_payments`). Admin telemetry uses aggregate-only `SECURITY DEFINER` RPCs.
   - `registration_invite_only` feature flag defaults to `true` (enforced for both Email and Google OAuth).
5. **Android & Offline Sync-Readiness:**
   - Every user-owned table has client-friendly `id UUID`, `created_at`, `updated_at` (trigger-maintained), and `deleted_at` (soft delete).
   - `transactions` carries `status` (`confirmed` | `draft`), `source`, and `external_hash`.
   - Every API change updates Zod schemas in `packages/api-contract` so OpenAPI 3.1 stays authoritative.
6. **i18n & No Personal Hardcoding:**
   - All UI copy must use `ru` and `en` translation dictionaries — no hardcoded personal accounts/categories for all users.
7. **End-of-Task Rule:**
   - After completing any feature or PR, ALWAYS update `docs/STATUS.md` with what was implemented, verified, and what comes next.
