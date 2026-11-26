-- Harden SECURITY DEFINER function execution grants (explicitly revoke anon & PUBLIC).

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_admin_telemetry() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_telemetry() TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_invite_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;
