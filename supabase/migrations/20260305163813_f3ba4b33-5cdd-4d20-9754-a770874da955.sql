ALTER TABLE public.assets ALTER COLUMN asset_tag DROP NOT NULL;
ALTER TABLE public.assets ADD COLUMN is_consumable boolean NOT NULL DEFAULT false;