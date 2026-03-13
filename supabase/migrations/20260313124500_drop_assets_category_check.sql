BEGIN;

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_category_check;

COMMIT;
