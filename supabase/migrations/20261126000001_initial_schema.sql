-- Strata Initial Schema (PR 2)
-- 15 tables, BIGINT minor-unit money, soft-delete + updated_at sync,
-- strict RLS (Privacy by Design), covering indexes, and SECURITY DEFINER RPCs.

-- ============================================================================
-- 1. Private Schema & Trigger Utility Functions
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.invite_redeemed_at IS DISTINCT FROM OLD.invite_redeemed_at THEN
      RAISE EXCEPTION 'Insufficient privilege to modify privileged profile fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Tables
-- ============================================================================

-- 1) profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  display_name TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'en')),
  base_currency TEXT NOT NULL DEFAULT 'RUB' CHECK (char_length(base_currency) = 3),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  privacy_blur_default BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  invite_redeemed_at TIMESTAMPTZ NULL,
  wrapped_settings JSONB NOT NULL DEFAULT '{"coffeePriceMinor":25000,"shawarmaPriceMinor":35000,"subscriptionAvgMinor":39900,"workHoursPerMonth":160,"promoWarningDays":14}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Admin helper (defined after public.profiles exists)
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- Auto-create profile when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    ''
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, v_display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2) accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'cash', 'savings', 'deposit')),
  currency TEXT NOT NULL DEFAULT 'RUB' CHECK (char_length(currency) = 3),
  initial_balance_minor BIGINT NOT NULL DEFAULT 0,
  credit_limit_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_limit_minor >= 0),
  bank_name TEXT NULL,
  last4_digits TEXT NULL CHECK (last4_digits IS NULL OR last4_digits ~ '^[0-9]{4}$'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL
);

-- 3) savings_rules
CREATE TABLE public.savings_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  accrual_type TEXT NOT NULL DEFAULT 'daily_balance' CHECK (accrual_type IN ('daily_balance', 'min_balance')),
  base_rate NUMERIC(6, 5) NOT NULL DEFAULT 0 CHECK (base_rate >= 0 AND base_rate <= 1),
  promo_rate NUMERIC(6, 5) NOT NULL DEFAULT 0 CHECK (promo_rate >= 0 AND promo_rate <= 1),
  promo_end_date DATE NULL,
  capitalization BOOLEAN NOT NULL DEFAULT true,
  min_balance_override_minor BIGINT NULL CHECK (min_balance_override_minor IS NULL OR min_balance_override_minor >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL
);

-- 4) categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  is_passive BOOLEAN NOT NULL DEFAULT false,
  monthly_limit_minor BIGINT NULL CHECK (monthly_limit_minor IS NULL OR monthly_limit_minor >= 0),
  icon TEXT NULL,
  color TEXT NULL,
  hint TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL
);

-- 5) goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  target_amount_minor BIGINT NOT NULL CHECK (target_amount_minor > 0),
  initial_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (initial_amount_minor >= 0),
  monthly_plan_minor BIGINT NOT NULL DEFAULT 0 CHECK (monthly_plan_minor >= 0),
  storage_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL
);

-- 6) goal_transfers
CREATE TABLE public.goal_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  to_goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT goal_transfers_distinct_goals CHECK (from_goal_id <> to_goal_id)
);

-- 7) recurring_payments
CREATE TABLE public.recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  day_of_month SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  cadence TEXT NOT NULL DEFAULT 'monthly' CHECK (cadence IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  match_keyword TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL
);

-- 8) recurring_payment_marks
CREATE TABLE public.recurring_payment_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_payment_id UUID NOT NULL REFERENCES public.recurring_payments(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL
);

-- 9) debts
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
  counterparty TEXT NOT NULL CHECK (char_length(trim(counterparty)) > 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  manual_repaid_minor BIGINT NOT NULL DEFAULT 0 CHECK (manual_repaid_minor >= 0),
  opened_at DATE NOT NULL,
  due_date DATE NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL
);

-- 10) transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'expense',
      'income',
      'passive_income',
      'transfer',
      'compensation',
      'transit_in',
      'transit_out',
      'debt_given',
      'debt_received_back',
      'debt_borrowed',
      'debt_paid_back'
    )
  ),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  account_from_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  account_to_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  goal_id UUID NULL REFERENCES public.goals(id) ON DELETE SET NULL,
  debt_id UUID NULL REFERENCES public.debts(id) ON DELETE SET NULL,
  recurring_payment_id UUID NULL REFERENCES public.recurring_payments(id) ON DELETE SET NULL,
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'draft')),
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'android', 'android_push')),
  external_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT transactions_confirmed_transfer_accounts CHECK (
    status <> 'confirmed'
    OR type <> 'transfer'
    OR (
      account_from_id IS NOT NULL
      AND account_to_id IS NOT NULL
      AND account_from_id <> account_to_id
    )
  )
);

-- 11) feature_flags
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  admin_preview BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 12) invite_codes
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (char_length(trim(code)) >= 4),
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0 AND used_count <= max_uses),
  expires_at TIMESTAMPTZ NULL,
  note TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 13) stories
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_ru TEXT NOT NULL,
  title_en TEXT NOT NULL,
  cover_image_url TEXT NULL,
  badge_ru TEXT NULL,
  badge_en TEXT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  admin_preview BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ NULL
);

-- 14) story_slides
CREATE TABLE public.story_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  slide_order INTEGER NOT NULL DEFAULT 0,
  title_ru TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_ru TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  media_url TEXT NULL,
  cta_label_ru TEXT NULL,
  cta_label_en TEXT NULL,
  cta_href TEXT NULL,
  accent_token TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 15) story_views
CREATE TABLE public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (story_id, user_id)
);

-- ============================================================================
-- 3. Updated_at & Security Triggers
-- ============================================================================

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_protect_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER savings_rules_set_updated_at
  BEFORE UPDATE ON public.savings_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER goal_transfers_set_updated_at
  BEFORE UPDATE ON public.goal_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER recurring_payments_set_updated_at
  BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER recurring_payment_marks_set_updated_at
  BEFORE UPDATE ON public.recurring_payment_marks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER debts_set_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER invite_codes_set_updated_at
  BEFORE UPDATE ON public.invite_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER stories_set_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER story_slides_set_updated_at
  BEFORE UPDATE ON public.story_slides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. Indexes (Sync Composite, Active Partial & Covering FK Indexes)
-- ============================================================================

-- Delta sync composite indexes (user_id, updated_at)
CREATE INDEX idx_accounts_user_updated ON public.accounts (user_id, updated_at);
CREATE INDEX idx_savings_rules_user_updated ON public.savings_rules (user_id, updated_at);
CREATE INDEX idx_categories_user_updated ON public.categories (user_id, updated_at);
CREATE INDEX idx_goals_user_updated ON public.goals (user_id, updated_at);
CREATE INDEX idx_goal_transfers_user_updated ON public.goal_transfers (user_id, updated_at);
CREATE INDEX idx_recurring_payments_user_updated ON public.recurring_payments (user_id, updated_at);
CREATE INDEX idx_recurring_payment_marks_user_updated ON public.recurring_payment_marks (user_id, updated_at);
CREATE INDEX idx_debts_user_updated ON public.debts (user_id, updated_at);
CREATE INDEX idx_transactions_user_updated ON public.transactions (user_id, updated_at);

-- Partial active indexes for primary queries & uniqueness
CREATE INDEX idx_accounts_active ON public.accounts (user_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_active ON public.categories (user_id, kind, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_debts_active ON public.debts (user_id, direction, opened_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_active_occurred ON public.transactions (user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_stories_published ON public.stories (is_published, sort_order) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_recurring_payment_marks_active
  ON public.recurring_payment_marks (user_id, recurring_payment_id, period_key)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_transactions_user_external_hash_active
  ON public.transactions (user_id, external_hash)
  WHERE external_hash IS NOT NULL AND deleted_at IS NULL;

-- Covering B-tree indexes for all foreign keys
CREATE INDEX idx_goals_storage_account_id ON public.goals (storage_account_id) WHERE storage_account_id IS NOT NULL;
CREATE INDEX idx_goal_transfers_from_goal_id ON public.goal_transfers (from_goal_id);
CREATE INDEX idx_goal_transfers_to_goal_id ON public.goal_transfers (to_goal_id);
CREATE INDEX idx_recurring_payments_category_id ON public.recurring_payments (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_recurring_payments_account_id ON public.recurring_payments (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_recurring_payment_marks_recurring_id ON public.recurring_payment_marks (recurring_payment_id);
CREATE INDEX idx_transactions_category_id ON public.transactions (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_transactions_account_from_id ON public.transactions (account_from_id) WHERE account_from_id IS NOT NULL;
CREATE INDEX idx_transactions_account_to_id ON public.transactions (account_to_id) WHERE account_to_id IS NOT NULL;
CREATE INDEX idx_transactions_goal_id ON public.transactions (goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX idx_transactions_debt_id ON public.transactions (debt_id) WHERE debt_id IS NOT NULL;
CREATE INDEX idx_transactions_recurring_payment_id ON public.transactions (recurring_payment_id) WHERE recurring_payment_id IS NOT NULL;
CREATE INDEX idx_invite_codes_created_by ON public.invite_codes (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_stories_created_by ON public.stories (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_story_slides_story_order ON public.story_slides (story_id, slide_order);
CREATE INDEX idx_story_views_user_id ON public.story_views (user_id);
CREATE INDEX idx_story_views_story_id ON public.story_views (story_id);

-- ============================================================================
-- 5. Row Level Security & Least-Privilege Role Grants
-- ============================================================================

-- Revoke broad default privileges from anon/public, then grant explicitly
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

GRANT SELECT ON public.feature_flags TO anon;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_payment_marks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_slides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_views TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_payment_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- profiles (own row only)
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- accounts
CREATE POLICY accounts_select_own ON public.accounts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY accounts_insert_own ON public.accounts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY accounts_update_own ON public.accounts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY accounts_delete_own ON public.accounts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- savings_rules
CREATE POLICY savings_rules_select_own ON public.savings_rules
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_rules_insert_own ON public.savings_rules
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_rules_update_own ON public.savings_rules
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY savings_rules_delete_own ON public.savings_rules
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- categories
CREATE POLICY categories_select_own ON public.categories
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY categories_insert_own ON public.categories
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY categories_update_own ON public.categories
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY categories_delete_own ON public.categories
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- goals
CREATE POLICY goals_select_own ON public.goals
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY goals_insert_own ON public.goals
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY goals_update_own ON public.goals
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY goals_delete_own ON public.goals
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- goal_transfers
CREATE POLICY goal_transfers_select_own ON public.goal_transfers
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY goal_transfers_insert_own ON public.goal_transfers
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY goal_transfers_update_own ON public.goal_transfers
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY goal_transfers_delete_own ON public.goal_transfers
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- recurring_payments
CREATE POLICY recurring_payments_select_own ON public.recurring_payments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_payments_insert_own ON public.recurring_payments
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_payments_update_own ON public.recurring_payments
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_payments_delete_own ON public.recurring_payments
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- recurring_payment_marks
CREATE POLICY recurring_payment_marks_select_own ON public.recurring_payment_marks
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_payment_marks_insert_own ON public.recurring_payment_marks
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_payment_marks_update_own ON public.recurring_payment_marks
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY recurring_payment_marks_delete_own ON public.recurring_payment_marks
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- debts
CREATE POLICY debts_select_own ON public.debts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY debts_insert_own ON public.debts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY debts_update_own ON public.debts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY debts_delete_own ON public.debts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- transactions
CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY transactions_insert_own ON public.transactions
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY transactions_update_own ON public.transactions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY transactions_delete_own ON public.transactions
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- feature_flags (public read, admin write)
CREATE POLICY feature_flags_select_public ON public.feature_flags
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY feature_flags_insert_admin ON public.feature_flags
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY feature_flags_update_admin ON public.feature_flags
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY feature_flags_delete_admin ON public.feature_flags
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- invite_codes (admin-only management; users redeem via RPC)
CREATE POLICY invite_codes_select_admin ON public.invite_codes
  FOR SELECT TO authenticated USING ((SELECT private.is_admin()));
CREATE POLICY invite_codes_insert_admin ON public.invite_codes
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY invite_codes_update_admin ON public.invite_codes
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY invite_codes_delete_admin ON public.invite_codes
  FOR DELETE TO authenticated USING ((SELECT private.is_admin()));

-- stories (single combined SELECT policy avoids multiple_permissive_policies)
CREATE POLICY stories_select_visible ON public.stories
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_admin())
    OR (
      is_published = true
      AND deleted_at IS NULL
      AND (starts_at IS NULL OR starts_at <= timezone('utc', now()))
      AND (ends_at IS NULL OR ends_at >= timezone('utc', now()))
    )
  );

CREATE POLICY stories_insert_admin ON public.stories
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY stories_update_admin ON public.stories
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY stories_delete_admin ON public.stories
  FOR DELETE TO authenticated USING ((SELECT private.is_admin()));

-- story_slides (single combined SELECT policy)
CREATE POLICY story_slides_select_visible ON public.story_slides
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_admin())
    OR story_id IN (
      SELECT s.id
      FROM public.stories AS s
      WHERE s.is_published = true
        AND s.deleted_at IS NULL
        AND (s.starts_at IS NULL OR s.starts_at <= timezone('utc', now()))
        AND (s.ends_at IS NULL OR s.ends_at >= timezone('utc', now()))
    )
  );

CREATE POLICY story_slides_insert_admin ON public.story_slides
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY story_slides_update_admin ON public.story_slides
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY story_slides_delete_admin ON public.story_slides
  FOR DELETE TO authenticated USING ((SELECT private.is_admin()));

-- story_views (own rows only)
CREATE POLICY story_views_select_own ON public.story_views
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY story_views_insert_own ON public.story_views
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY story_views_update_own ON public.story_views
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY story_views_delete_own ON public.story_views
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- 6. SECURITY DEFINER RPCs (Privacy by Design & Atomic Invite Redemption)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_telemetry()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc', now());
  v_result JSONB;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*)::bigint FROM public.profiles),
    'onboarded_users', (SELECT count(*)::bigint FROM public.profiles WHERE onboarding_completed = true),
    'invited_users', (SELECT count(*)::bigint FROM public.profiles WHERE invite_redeemed_at IS NOT NULL),
    'total_accounts', (SELECT count(*)::bigint FROM public.accounts WHERE deleted_at IS NULL),
    'total_transactions', (SELECT count(*)::bigint FROM public.transactions WHERE deleted_at IS NULL),
    'transactions_last_30d', (
      SELECT count(*)::bigint
      FROM public.transactions
      WHERE deleted_at IS NULL
        AND occurred_at >= v_now - INTERVAL '30 days'
    ),
    'total_goals', (SELECT count(*)::bigint FROM public.goals WHERE deleted_at IS NULL),
    'total_debts', (SELECT count(*)::bigint FROM public.debts WHERE deleted_at IS NULL),
    'active_invites', (
      SELECT count(*)::bigint
      FROM public.invite_codes
      WHERE is_active = true
        AND used_count < max_uses
        AND (expires_at IS NULL OR expires_at > v_now)
    ),
    'story_views_total', (SELECT count(*)::bigint FROM public.story_views),
    'generated_at', v_now
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_telemetry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_telemetry() TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_now TIMESTAMPTZ := timezone('utc', now());
  v_existing_redeemed TIMESTAMPTZ;
  v_invite RECORD;
  v_clean_code TEXT := trim(COALESCE(p_code, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT invite_redeemed_at
    INTO v_existing_redeemed
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_existing_redeemed IS NOT NULL THEN
    RETURN v_existing_redeemed;
  END IF;

  IF char_length(v_clean_code) < 4 THEN
    RAISE EXCEPTION 'INVALID_INVITE_CODE'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, is_active, expires_at, used_count, max_uses
    INTO v_invite
  FROM public.invite_codes
  WHERE code = v_clean_code
  FOR UPDATE;

  IF NOT FOUND
     OR v_invite.is_active IS NOT TRUE
     OR (v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= v_now)
     OR v_invite.used_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_INVITE_CODE'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.invite_codes
  SET used_count = used_count + 1
  WHERE id = v_invite.id;

  UPDATE public.profiles
  SET invite_redeemed_at = v_now
  WHERE id = v_user_id;

  RETURN v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;
