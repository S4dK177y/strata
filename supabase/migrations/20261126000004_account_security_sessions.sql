-- Strata PR 5: Account Security & Session Control
-- 1) Private SECURITY DEFINER helpers for active session & opt-in AAL2 MFA checks
-- 2) RESTRICTIVE RLS policies enforcing active session & MFA across user tables
-- 3) Public SECURITY DEFINER RPCs for auth state, session listing, and session revocation

-- ============================================================================
-- 1. Private Security Helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION private.current_session_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw TEXT;
BEGIN
  v_raw := NULLIF(trim(COALESCE((SELECT auth.jwt()) ->> 'session_id', '')), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_raw::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.is_session_active()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_session_id UUID := private.current_session_id();
BEGIN
  IF v_user_id IS NULL OR v_session_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM auth.sessions AS s
    WHERE s.id = v_session_id
      AND s.user_id = v_user_id
      AND (s.not_after IS NULL OR s.not_after > timezone('utc', now()))
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_mfa_satisfied()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_aal TEXT := COALESCE((SELECT auth.jwt()) ->> 'aal', 'aal1');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.mfa_factors AS f
    WHERE f.user_id = v_user_id
      AND f.status = 'verified'
  ) THEN
    RETURN true;
  END IF;

  RETURN v_aal = 'aal2';
END;
$$;

CREATE OR REPLACE FUNCTION private.is_session_mfa_allowed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_session_active() AND private.is_mfa_satisfied();
$$;

REVOKE ALL ON FUNCTION private.current_session_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_session_id() TO authenticated;

REVOKE ALL ON FUNCTION private.is_session_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_session_active() TO authenticated;

REVOKE ALL ON FUNCTION private.is_mfa_satisfied() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_mfa_satisfied() TO authenticated;

REVOKE ALL ON FUNCTION private.is_session_mfa_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_session_mfa_allowed() TO authenticated;

-- ============================================================================
-- 2. RESTRICTIVE RLS Policies (Instant Session Revocation + Opt-in AAL2)
-- ============================================================================

-- profiles: SELECT allows active AAL1 session so gates/API can detect mfa_required;
-- UPDATE requires active session AND MFA satisfaction.
CREATE POLICY profiles_require_active_session
  ON public.profiles
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING ((SELECT private.is_session_active()));

CREATE POLICY profiles_require_session_and_mfa_update
  ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

-- All 10 user financial & activity tables
CREATE POLICY accounts_require_session_and_mfa
  ON public.accounts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY savings_rules_require_session_and_mfa
  ON public.savings_rules
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY categories_require_session_and_mfa
  ON public.categories
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY goals_require_session_and_mfa
  ON public.goals
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY goal_transfers_require_session_and_mfa
  ON public.goal_transfers
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY recurring_payments_require_session_and_mfa
  ON public.recurring_payments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY recurring_payment_marks_require_session_and_mfa
  ON public.recurring_payment_marks
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY debts_require_session_and_mfa
  ON public.debts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY transactions_require_session_and_mfa
  ON public.transactions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY story_views_require_session_and_mfa
  ON public.story_views
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

-- Admin-mutable tables: protect mutations behind active session + MFA
CREATE POLICY feature_flags_insert_session_and_mfa
  ON public.feature_flags
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY feature_flags_update_session_and_mfa
  ON public.feature_flags
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY feature_flags_delete_session_and_mfa
  ON public.feature_flags
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY invite_codes_insert_session_and_mfa
  ON public.invite_codes
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY invite_codes_update_session_and_mfa
  ON public.invite_codes
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY invite_codes_delete_session_and_mfa
  ON public.invite_codes
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY stories_insert_session_and_mfa
  ON public.stories
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY stories_update_session_and_mfa
  ON public.stories
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY stories_delete_session_and_mfa
  ON public.stories
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY story_slides_insert_session_and_mfa
  ON public.story_slides
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY story_slides_update_session_and_mfa
  ON public.story_slides
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()))
  WITH CHECK ((SELECT private.is_session_mfa_allowed()));

CREATE POLICY story_slides_delete_session_and_mfa
  ON public.story_slides
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT private.is_session_mfa_allowed()));

-- ============================================================================
-- 3. Public SECURITY DEFINER RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_auth_state()
RETURNS TABLE (
  session_active BOOLEAN,
  session_id UUID,
  current_aal TEXT,
  mfa_enrolled BOOLEAN,
  mfa_required BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_session_id UUID := private.current_session_id();
  v_aal TEXT := CASE
    WHEN COALESCE((SELECT auth.jwt()) ->> 'aal', 'aal1') = 'aal2' THEN 'aal2'
    ELSE 'aal1'
  END;
  v_active BOOLEAN := false;
  v_mfa_enrolled BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'aal1'::text, false, false;
    RETURN;
  END IF;

  v_active := private.is_session_active();
  v_mfa_enrolled := EXISTS (
    SELECT 1
    FROM auth.mfa_factors AS f
    WHERE f.user_id = v_user_id
      AND f.status = 'verified'
  );

  RETURN QUERY
  SELECT
    v_active,
    v_session_id,
    v_aal,
    v_mfa_enrolled,
    (v_active AND v_mfa_enrolled AND v_aal <> 'aal2');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_sessions()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  refreshed_at TIMESTAMPTZ,
  not_after TIMESTAMPTZ,
  aal TEXT,
  user_agent TEXT,
  ip TEXT,
  is_current BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_current_session_id UUID := private.current_session_id();
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  IF NOT private.is_session_mfa_allowed() THEN
    RAISE EXCEPTION 'Active session and MFA verification required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.created_at,
    s.updated_at,
    (s.refreshed_at AT TIME ZONE 'utc')::timestamptz AS refreshed_at,
    s.not_after,
    s.aal::text,
    s.user_agent,
    host(s.ip) AS ip,
    (s.id = v_current_session_id) AS is_current
  FROM auth.sessions AS s
  WHERE s.user_id = v_user_id
    AND (s.not_after IS NULL OR s.not_after > v_now)
  ORDER BY COALESCE((s.refreshed_at AT TIME ZONE 'utc')::timestamptz, s.updated_at, s.created_at) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_my_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  IF NOT private.is_session_mfa_allowed() THEN
    RAISE EXCEPTION 'Active session and MFA verification required'
      USING ERRCODE = '42501';
  END IF;

  IF p_session_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE auth.sessions AS s
  SET not_after = v_now,
      updated_at = v_now
  WHERE s.id = p_session_id
    AND s.user_id = v_user_id
    AND (s.not_after IS NULL OR s.not_after > v_now);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE auth.refresh_tokens AS rt
  SET revoked = true,
      updated_at = v_now
  WHERE rt.session_id = p_session_id
    AND rt.revoked IS NOT TRUE;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_other_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_current_session_id UUID := private.current_session_id();
  v_now TIMESTAMPTZ := timezone('utc', now());
  v_revoked INTEGER := 0;
BEGIN
  IF NOT private.is_session_mfa_allowed() OR v_current_session_id IS NULL THEN
    RAISE EXCEPTION 'Active session and MFA verification required'
      USING ERRCODE = '42501';
  END IF;

  WITH expired AS (
    UPDATE auth.sessions AS s
    SET not_after = v_now,
        updated_at = v_now
    WHERE s.user_id = v_user_id
      AND s.id <> v_current_session_id
      AND (s.not_after IS NULL OR s.not_after > v_now)
    RETURNING s.id
  ),
  revoked_tokens AS (
    UPDATE auth.refresh_tokens AS rt
    SET revoked = true,
        updated_at = v_now
    FROM expired AS e
    WHERE rt.session_id = e.id
      AND rt.revoked IS NOT TRUE
  )
  SELECT count(*)::integer INTO v_revoked FROM expired;

  RETURN v_revoked;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_auth_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_auth_state() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_sessions() TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_my_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_my_session(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_other_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_other_sessions() TO authenticated;
