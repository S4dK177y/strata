-- Strata Default Feature Flags Seed (PR 2)
-- Idempotent seed so re-running or branching never duplicates keys.

INSERT INTO public.feature_flags (key, enabled, admin_preview, config)
VALUES
  ('registration_invite_only', true, false, '{}'::jsonb),
  ('wrapped_2026', false, true, '{}'::jsonb),
  ('stories_feed', true, false, '{}'::jsonb),
  ('android_push_drafts', true, false, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
