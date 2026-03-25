begin;

alter table public.assets
  add column if not exists last_reimaged_date date,
  add column if not exists last_logged_in_date date;

commit;
