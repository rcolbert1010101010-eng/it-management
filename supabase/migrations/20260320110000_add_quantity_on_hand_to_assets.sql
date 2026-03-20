BEGIN;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS quantity_on_hand integer NOT NULL DEFAULT 1;

-- Enforce non-negative
ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_quantity_on_hand_check;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_quantity_on_hand_check
  CHECK (quantity_on_hand >= 0);

COMMIT;
