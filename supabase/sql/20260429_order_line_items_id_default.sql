-- Ensure order line items can always generate UUID primary keys server-side.
create extension if not exists pgcrypto;

alter table public.order_line_items
  alter column id set default gen_random_uuid();

alter table public.order_line_items
  alter column id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_line_items'::regclass
      and contype = 'p'
  ) then
    alter table public.order_line_items
      add constraint order_line_items_pkey primary key (id);
  end if;
end $$;
