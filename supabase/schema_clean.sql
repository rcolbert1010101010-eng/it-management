create extension if not exists pgcrypto;

-- 1) ORDERS (parent)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  vendor_name text not null,
  vendor_contact text,
  requested_by_name text,
  requested_by_email text,
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED','APPROVED','ORDERED','SHIPPED','RECEIVED','CANCELLED')),
  order_date date,
  expected_delivery_date date,
  received_date date,
  shipping_tracking_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) ORDER LINE ITEMS (child of orders)
create table if not exists public.order_line_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_name text not null,
  quantity integer not null default 1,
  unit_cost numeric,
  sku text,
  received_quantity integer default 0,
  notes text
);

-- 3) ASSETS (references orders + order_line_items; add FK constraints AFTER creation)
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique,
  category text not null
    check (category in ('laptop','desktop','monitor','phone','printer','server','network','other')),
  manufacturer text,
  model text,
  serial_number text,
  status text not null default 'IN_STOCK'
    check (status in ('IN_STOCK','ASSIGNED','IN_REPAIR','RETIRED')),
  assigned_to_name text,
  assigned_to_email text,
  location text,
  purchase_date date,
  warranty_end_date date,
  notes text,
  source_order_id uuid,
  source_order_line_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add FK constraints idempotently (SQL Editor-safe)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_source_order_id_fkey'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_source_order_id_fkey
      foreign key (source_order_id)
      references public.orders(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_source_order_line_item_id_fkey'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_source_order_line_item_id_fkey
      foreign key (source_order_line_item_id)
      references public.order_line_items(id)
      on delete set null;
  end if;
end $$;

-- 4) AUDIT LOG
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('ASSET','ORDER')),
  entity_id uuid not null,
  action text not null,
  details jsonb,
  performed_by text not null default 'system',
  timestamp timestamptz not null default now()
);

-- updated_at helper
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers (idempotent)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'update_assets_updated_at') then
    create trigger update_assets_updated_at
    before update on public.assets
    for each row
    execute function public.update_updated_at_column();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'update_orders_updated_at') then
    create trigger update_orders_updated_at
    before update on public.orders
    for each row
    execute function public.update_updated_at_column();
  end if;
end $$;

-- Indexes
create index if not exists idx_assets_status on public.assets(status);
create index if not exists idx_assets_category on public.assets(category);
create index if not exists idx_assets_asset_tag on public.assets(asset_tag);

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_order_number on public.orders(order_number);

create index if not exists idx_order_line_items_order_id on public.order_line_items(order_id);

create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_timestamp on public.audit_log(timestamp);

-- RLS (policies applied separately)
alter table public.assets enable row level security;
alter table public.orders enable row level security;
alter table public.order_line_items enable row level security;
alter table public.audit_log enable row level security;
