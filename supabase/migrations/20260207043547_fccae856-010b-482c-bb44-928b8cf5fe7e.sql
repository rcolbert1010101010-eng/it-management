
-- =============================================
-- IT Management App - Full Schema
-- =============================================

-- 1. Assets Table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_tag TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('laptop', 'desktop', 'monitor', 'phone', 'printer', 'server', 'network', 'other')),
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK (status IN ('IN_STOCK', 'ASSIGNED', 'IN_REPAIR', 'RETIRED')),
  assigned_to_name TEXT,
  assigned_to_email TEXT,
  location TEXT,
  purchase_date DATE,
  warranty_end_date DATE,
  notes TEXT,
  source_order_id UUID,
  source_order_line_item_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Orders Table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  vendor_contact TEXT,
  requested_by_name TEXT,
  requested_by_email TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'ORDERED', 'SHIPPED', 'RECEIVED', 'CANCELLED')),
  order_date DATE,
  expected_delivery_date DATE,
  received_date DATE,
  shipping_tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Order Line Items Table
CREATE TABLE public.order_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC,
  sku TEXT,
  received_quantity INTEGER DEFAULT 0,
  notes TEXT
);

-- 4. Audit Log Table
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ASSET', 'ORDER')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  performed_by TEXT NOT NULL DEFAULT 'system',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Add foreign key references for source order linking on assets
ALTER TABLE public.assets 
  ADD CONSTRAINT fk_source_order FOREIGN KEY (source_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.assets 
  ADD CONSTRAINT fk_source_order_line_item FOREIGN KEY (source_order_line_item_id) REFERENCES public.order_line_items(id) ON DELETE SET NULL;

-- 6. Enable RLS on all tables
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies - Allow all operations (no auth, trusted internal use)
CREATE POLICY "Allow all access on assets" ON public.assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on order_line_items" ON public.order_line_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- 8. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 9. Triggers for updated_at
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Indexes for common queries
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_category ON public.assets(category);
CREATE INDEX idx_assets_asset_tag ON public.assets(asset_tag);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_order_number ON public.orders(order_number);
CREATE INDEX idx_order_line_items_order_id ON public.order_line_items(order_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_timestamp ON public.audit_log(timestamp DESC);
