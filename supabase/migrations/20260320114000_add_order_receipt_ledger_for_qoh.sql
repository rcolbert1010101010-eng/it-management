BEGIN;

CREATE TABLE IF NOT EXISTS public.order_line_item_receipt_ledger (
  order_line_item_id uuid PRIMARY KEY
    REFERENCES public.order_line_items(id) ON DELETE CASCADE,
  total_received_applied integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_line_item_receipt_ledger
  DROP CONSTRAINT IF EXISTS order_line_item_receipt_ledger_total_received_applied_check;

ALTER TABLE public.order_line_item_receipt_ledger
  ADD CONSTRAINT order_line_item_receipt_ledger_total_received_applied_check
  CHECK (total_received_applied >= 0);

ALTER TABLE public.order_line_item_receipt_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_line_item_receipt_ledger_authenticated_all
  ON public.order_line_item_receipt_ledger;

CREATE POLICY order_line_item_receipt_ledger_authenticated_all
ON public.order_line_item_receipt_ledger
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;
