-- Strata PR 5.5: User Accent Palette Preference
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accent TEXT NOT NULL DEFAULT 'emerald'
  CHECK (accent IN ('emerald', 'ocean', 'amethyst', 'sunset', 'graphite'));
