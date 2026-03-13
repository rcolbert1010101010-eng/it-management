BEGIN;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS is_consumable boolean NOT NULL DEFAULT false;

COMMIT;
