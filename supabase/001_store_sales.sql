-- Run in Supabase SQL Editor as the project owner before 002_seed.sql.
-- The existing dashboard is public: this policy makes sales rows publicly readable.
-- Publishable keys can SELECT only; INSERT/UPDATE/DELETE remain denied.
begin;
create table if not exists public.store_sales (
  id bigint primary key,
  date date not null,
  region text not null,
  store text not null,
  category text not null,
  plan text,
  quantity integer check (quantity is null or quantity >= 0),
  revenue bigint not null check (revenue >= 0),
  staff text not null
);
alter table public.store_sales enable row level security;
revoke all on table public.store_sales from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.store_sales to anon, authenticated;
drop policy if exists dashboard_sales_read on public.store_sales;
create policy dashboard_sales_read on public.store_sales
  for select to anon, authenticated using (true);
create index if not exists store_sales_date_idx on public.store_sales (date);
commit;
