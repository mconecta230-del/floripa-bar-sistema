create table public.staff (
  user_id uuid primary key references auth.users(id),
  display_name text not null check (length(trim(display_name)) > 0),
  role text not null check (role in ('manager','cashier','waiter')),
  active boolean not null default true
);
create table public.restaurant_tables (
  number integer primary key check (number between 1 and 40)
);
insert into public.restaurant_tables(number) select generate_series(1,40);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  table_number integer not null references public.restaurant_tables(number),
  created_by uuid not null references public.staff(user_id),
  created_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  name text not null check (length(trim(name)) > 0),
  quantity integer not null check (quantity > 0),
  unit_cents integer not null check (unit_cents >= 0)
);
create index orders_table_number_idx on public.orders(table_number,created_at desc);
create index order_items_order_id_idx on public.order_items(order_id);
alter table public.staff enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.staff, public.restaurant_tables, public.orders, public.order_items from anon, authenticated;
grant select on public.staff, public.restaurant_tables, public.orders, public.order_items to authenticated;
grant insert on public.orders, public.order_items to authenticated;
create policy staff_read_self on public.staff for select to authenticated using (user_id = (select auth.uid()));
create policy tables_read_staff on public.restaurant_tables for select to authenticated using (exists (select 1 from public.staff where user_id = (select auth.uid()) and active));
create policy orders_read_staff on public.orders for select to authenticated using (exists (select 1 from public.staff where user_id = (select auth.uid()) and active));
create policy orders_create_staff on public.orders for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.staff where user_id = (select auth.uid()) and active));
create policy order_items_read_staff on public.order_items for select to authenticated using (exists (select 1 from public.staff where user_id = (select auth.uid()) and active));
create policy order_items_create_owner on public.order_items for insert to authenticated with check (exists (select 1 from public.orders o join public.staff s on s.user_id = o.created_by where o.id = order_id and o.created_by = (select auth.uid()) and s.active));
