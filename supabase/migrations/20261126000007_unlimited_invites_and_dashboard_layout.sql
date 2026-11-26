-- Strata PR 6.5: Unlimited invite codes (max_uses NULL) & customizable Overview card order

-- 1) Persist customizable dashboard section order per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_layout JSONB NULL;

-- 2) Allow invite_codes.max_uses to be NULL (unlimited uses)
DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.invite_codes'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%max_uses%'
        OR pg_get_constraintdef(oid) ILIKE '%used_count%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.invite_codes DROP CONSTRAINT %I', v_con.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.invite_codes
  ALTER COLUMN max_uses DROP NOT NULL,
  ALTER COLUMN max_uses DROP DEFAULT;

ALTER TABLE public.invite_codes
  ADD CONSTRAINT invite_codes_max_uses_check
    CHECK (max_uses IS NULL OR max_uses > 0),
  ADD CONSTRAINT invite_codes_used_count_check
    CHECK (used_count >= 0 AND (max_uses IS NULL OR used_count <= max_uses));

-- 3) Update redeem_invite_code() to allow max_uses IS NULL
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
     OR (v_invite.max_uses IS NOT NULL AND v_invite.used_count >= v_invite.max_uses) THEN
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

REVOKE ALL ON FUNCTION public.redeem_invite_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;

-- 4) Update get_admin_telemetry() active_invites count for unlimited invites
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
  IF NOT private.is_admin() OR NOT private.is_session_mfa_allowed() THEN
    RAISE EXCEPTION 'Admin privileges and active MFA session required'
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
        AND (max_uses IS NULL OR used_count < max_uses)
        AND (expires_at IS NULL OR expires_at > v_now)
    ),
    'story_views_total', (SELECT count(*)::bigint FROM public.story_views),
    'generated_at', v_now
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_telemetry() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_telemetry() TO authenticated;
