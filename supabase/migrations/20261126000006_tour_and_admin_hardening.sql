-- Strata PR 6: Spotlight Tour persistence & Admin read MFA hardening
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ NULL;

-- Require active session + satisfied MFA when admins read invite_codes
CREATE POLICY invite_codes_select_session_and_mfa
  ON public.invite_codes
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()));

-- Harden get_admin_telemetry() to also require active session + satisfied MFA
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
        AND used_count < max_uses
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
