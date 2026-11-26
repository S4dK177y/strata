# Strata — Database Schema Specification (PostgreSQL / Supabase)

Versioned migrations live in [`supabase/migrations/`](../supabase/migrations):
- `20261126000001_initial_schema.sql` — 15 tables, constraints, triggers, composite & FK indexes, RLS, and RPCs.
- `20261126000002_seed_defaults.sql` — idempotent seed for default `feature_flags`.
- `20261126000003_harden_rpc_grants.sql` — explicit `REVOKE` of `anon` / `PUBLIC` `EXECUTE` privileges on `SECURITY DEFINER` functions.

## Global Conventions
- **Money:** `BIGINT` (`*_minor` in kopecks/cents). `transactions.amount_minor > 0`. Interest rates use `NUMERIC(6, 5)`.
- **Sync columns on all user tables:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` (maintained by `public.set_updated_at()` `BEFORE UPDATE` trigger), `deleted_at TIMESTAMPTZ NULL`.
- **RLS & Performance:** Enabled on all 15 tables (`TO authenticated` / `TO anon`), using `initPlan`-optimized `(SELECT auth.uid()) = user_id` predicates and composite `(user_id, updated_at)` + covering FK indexes.
- **Privacy by Design:** Admin role (`private.is_admin()`) has **zero** `SELECT` access to other users' financial tables (`accounts`, `savings_rules`, `categories`, `goals`, `goal_transfers`, `recurring_payments`, `recurring_payment_marks`, `debts`, `transactions`, `story_views`).

## Tables (15)
1. `profiles` (`id`, `role`, `display_name`, `locale`, `base_currency`, `theme`, `privacy_blur_default`, `onboarding_completed`, `invite_redeemed_at`, `wrapped_settings JSONB`, `created_at`, `updated_at`) — protected against self-escalation via `protect_profile_privileged_fields()` trigger; auto-created on signup by `handle_new_user()`.
2. `accounts` (`id`, `user_id`, `name`, `type`, `currency`, `initial_balance_minor`, `credit_limit_minor`, `bank_name`, `last4_digits`, `is_active`, `sort_order`, sync cols)
3. `savings_rules` (`id`, `user_id`, `account_id UNIQUE`, `accrual_type`, `base_rate`, `promo_rate`, `promo_end_date`, `capitalization`, `min_balance_override_minor`, sync cols)
4. `categories` (`id`, `user_id`, `name`, `kind`, `is_passive`, `monthly_limit_minor`, `icon`, `color`, `hint`, `sort_order`, sync cols)
5. `goals` (`id`, `user_id`, `name`, `priority`, `target_amount_minor`, `initial_amount_minor`, `monthly_plan_minor`, `storage_account_id`, `is_archived`, `sort_order`, sync cols)
6. `goal_transfers` (`id`, `user_id`, `from_goal_id`, `to_goal_id`, `amount_minor`, `occurred_at`, `comment`, sync cols)
7. `recurring_payments` (`id`, `user_id`, `name`, `category_id`, `account_id`, `amount_minor`, `day_of_month`, `cadence`, `match_keyword`, `is_active`, sync cols)
8. `recurring_payment_marks` (`id`, `user_id`, `recurring_payment_id`, `period_key`, `marked_at`, sync cols)
9. `debts` (`id`, `user_id`, `direction`, `counterparty`, `amount_minor`, `manual_repaid_minor`, `opened_at`, `due_date`, `comment`, sync cols)
10. `transactions` (`id`, `user_id`, `occurred_at`, `type`, `amount_minor > 0`, `category_id`, `account_from_id`, `account_to_id`, `goal_id`, `debt_id`, `recurring_payment_id`, `comment`, `status`, `source` in `web | android | android_push`, `external_hash`, sync cols)
11. `feature_flags` (`key`, `enabled`, `starts_at`, `ends_at`, `admin_preview`, `config JSONB`, `updated_at`) — seeded with `registration_invite_only = true`.
12. `invite_codes` (`id`, `code UNIQUE`, `max_uses`, `used_count`, `expires_at`, `note`, `is_active`, `created_by`, `created_at`, `updated_at`)
13. `stories` (`id`, `slug UNIQUE`, `title_ru`, `title_en`, `cover_image_url`, `badge_ru`, `badge_en`, `is_published`, `admin_preview`, `starts_at`, `ends_at`, `sort_order`, `created_by`, sync cols)
14. `story_slides` (`id`, `story_id`, `slide_order`, `title_ru`, `title_en`, `body_ru`, `body_en`, `media_url`, `cta_label_ru`, `cta_label_en`, `cta_href`, `accent_token`, `created_at`, `updated_at`)
15. `story_views` (`id`, `story_id`, `user_id`, `viewed_at`, `UNIQUE (story_id, user_id)`)

## RPCs (`SECURITY DEFINER`, `SET search_path = ''`)
- `public.get_admin_telemetry() RETURNS JSONB` — requires `private.is_admin()`, returns aggregate-only platform counts (zero PII / user-level financial rows).
- `public.redeem_invite_code(p_code TEXT) RETURNS TIMESTAMPTZ` — atomically validates and consumes an invite code (`FOR UPDATE`) and stamps `profiles.invite_redeemed_at`.
