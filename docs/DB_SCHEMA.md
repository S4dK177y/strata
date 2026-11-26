# Strata — Database Schema Specification (PostgreSQL / Supabase)

*(Full SQL migrations will be created in PR 2 under `supabase/migrations/`.)*

## Global Conventions
- **Money:** `BIGINT` (`*_minor` in kopecks/cents).
- **Sync columns on all user tables:** `id UUID PRIMARY KEY`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` (auto-trigger), `deleted_at TIMESTAMPTZ NULL`.
- **RLS:** Enabled on every table with `(SELECT auth.uid()) = user_id` and supporting composite indexes `(user_id, updated_at)`.
- **Privacy by Design:** Admin role has **zero** `SELECT` access to user financial tables.

## Planned Tables (PR 2)
1. `profiles` (`id`, `role`, `display_name`, `locale`, `base_currency`, `theme`, `privacy_blur_default`, `onboarding_completed`, `invite_redeemed_at`, `wrapped_settings JSONB`)
2. `accounts` (`id`, `user_id`, `name`, `type`, `currency`, `initial_balance_minor`, `credit_limit_minor`, `bank_name`, `last4_digits`, `is_active`, `sort_order`, sync cols)
3. `savings_rules` (`id`, `user_id`, `account_id UNIQUE`, `accrual_type`, `base_rate`, `promo_rate`, `promo_end_date`, `capitalization`, `min_balance_override_minor`, sync cols)
4. `categories` (`id`, `user_id`, `name`, `kind`, `is_passive`, `monthly_limit_minor`, `icon`, `color`, `hint`, `sort_order`, sync cols)
5. `goals` (`id`, `user_id`, `name`, `priority`, `target_amount_minor`, `initial_amount_minor`, `monthly_plan_minor`, `storage_account_id`, `is_archived`, `sort_order`, sync cols)
6. `goal_transfers` (`id`, `user_id`, `from_goal_id`, `to_goal_id`, `amount_minor`, `occurred_at`, `comment`, sync cols)
7. `recurring_payments` (`id`, `user_id`, `name`, `category_id`, `account_id`, `amount_minor`, `day_of_month`, `cadence`, `match_keyword`, `is_active`, sync cols)
8. `recurring_payment_marks` (`id`, `user_id`, `recurring_payment_id`, `period_key`, `marked_at`)
9. `debts` (`id`, `user_id`, `direction`, `counterparty`, `amount_minor`, `manual_repaid_minor`, `opened_at`, `due_date`, `comment`, sync cols)
10. `transactions` (`id`, `user_id`, `occurred_at`, `type`, `amount_minor > 0`, `category_id`, `account_from_id`, `account_to_id`, `goal_id`, `debt_id`, `recurring_payment_id`, `comment`, `status`, `source`, `external_hash`, sync cols)
11. `feature_flags` (`key`, `enabled`, `starts_at`, `ends_at`, `admin_preview`, `config JSONB`, `updated_at`)
12. `invite_codes` (`id`, `code UNIQUE`, `max_uses`, `used_count`, `expires_at`, `note`, `is_active`, `created_by`)
13. `stories`, `story_slides`, `story_views` (admin visual story campaigns & anonymous counts)
