-- This app uses a single shared login and relies on authenticated-only RLS policies.

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on assets" ON public.assets;
DROP POLICY IF EXISTS "Allow all access on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all access on order_line_items" ON public.order_line_items;
DROP POLICY IF EXISTS "Allow all access on audit_log" ON public.audit_log;

DROP POLICY IF EXISTS assets_all ON public.assets;
DROP POLICY IF EXISTS orders_all ON public.orders;
DROP POLICY IF EXISTS order_line_items_all ON public.order_line_items;
DROP POLICY IF EXISTS audit_log_all ON public.audit_log;

CREATE POLICY assets_authenticated_all
ON public.assets
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY orders_authenticated_all
ON public.orders
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY order_line_items_authenticated_all
ON public.order_line_items
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY audit_log_authenticated_all
ON public.audit_log
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
