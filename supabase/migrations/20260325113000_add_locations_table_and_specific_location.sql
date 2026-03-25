begin;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.locations
  drop constraint if exists locations_name_not_blank;

alter table public.locations
  add constraint locations_name_not_blank
  check (btrim(name) <> '');

create unique index if not exists locations_name_normalized_idx
  on public.locations ((lower(btrim(name))));

alter table public.assets
  add column if not exists specific_location text null;

insert into public.locations (name)
values
  ('CRC'),
  ('Rogers'),
  ('Knotts'),
  ('Frontage Rd'),
  ('W Chicago')
on conflict do nothing;

insert into public.locations (name)
select distinct on (lower(btrim(location))) btrim(location)
from public.assets
where location is not null
  and btrim(location) <> ''
order by lower(btrim(location)), btrim(location)
on conflict do nothing;

alter table public.locations enable row level security;

drop policy if exists locations_authenticated_all
  on public.locations;

create policy locations_authenticated_all
on public.locations
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

commit;
