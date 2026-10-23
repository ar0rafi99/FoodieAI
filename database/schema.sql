-- =====================================================================
-- FoodieAI - database schema (run FIRST, once, on an empty Supabase project)
-- Then run seed.sql for demo data.
-- Multi-tenant ready: every table carries restaurant_id.
-- =====================================================================

-- ---------- 1) TABLES ----------
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  currency text not null default 'USD',
  delivery_fee numeric(10,2) not null default 3.99,
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  sort_order int default 0
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  emoji text,
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  address text not null,
  notes text,
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'pending',
  payment_method text not null default 'cash_on_delivery',
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  qty int not null check (qty > 0)
);

create table restaurant_staff (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  primary key (restaurant_id, user_id)
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz default now()
);

-- ---------- 2) HELPER: is the current user staff of this restaurant? ----------
create or replace function is_staff(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from restaurant_staff
    where restaurant_id = rid and user_id = auth.uid()
  );
$$;

-- ---------- 3) ROW LEVEL SECURITY ----------
alter table restaurants enable row level security;
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table restaurant_staff enable row level security;
alter table support_tickets enable row level security;

-- Public menu (read-only)
create policy "public read restaurants" on restaurants for select using (true);
create policy "public read categories" on categories for select using (true);
create policy "public read menu_items" on menu_items for select using (is_available = true);

-- Customers: read ONLY their own orders (orders are created via place_order(), see below)
create policy "read own orders" on orders
  for select using (auth.uid() = user_id);
create policy "read own order items" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Staff (role-protected admin area)
create policy "staff read own membership" on restaurant_staff
  for select using (user_id = auth.uid());

create policy "staff read orders" on orders
  for select using (is_staff(restaurant_id));
create policy "staff update orders" on orders
  for update using (is_staff(restaurant_id)) with check (is_staff(restaurant_id));
create policy "staff read order items" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id and is_staff(o.restaurant_id))
  );

create policy "staff read all menu items" on menu_items
  for select using (is_staff(restaurant_id));
create policy "staff insert menu items" on menu_items
  for insert with check (is_staff(restaurant_id));
create policy "staff update menu items" on menu_items
  for update using (is_staff(restaurant_id)) with check (is_staff(restaurant_id));
create policy "staff delete menu items" on menu_items
  for delete using (is_staff(restaurant_id));

create policy "staff insert categories" on categories
  for insert with check (is_staff(restaurant_id));
create policy "staff update categories" on categories
  for update using (is_staff(restaurant_id)) with check (is_staff(restaurant_id));
create policy "staff delete categories" on categories
  for delete using (is_staff(restaurant_id));

-- Support tickets: SIGNED-IN users can create (for themselves); only staff can read/update
create policy "signed-in users can create tickets" on support_tickets
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'open'
    and char_length(message) between 1 and 1000
    and char_length(name) between 1 and 100
    and char_length(phone) between 5 and 30
  );
create policy "staff read tickets" on support_tickets
  for select using (is_staff(restaurant_id));
create policy "staff update tickets" on support_tickets
  for update using (is_staff(restaurant_id)) with check (is_staff(restaurant_id));

-- Staff may change ONLY the order status column, nothing else
revoke update on orders from anon, authenticated;
grant update (status) on orders to authenticated;

-- ---------- 4) SECURE ORDER PLACEMENT (prices are calculated on the server) ----------
create or replace function place_order(
  p_restaurant_id uuid,
  p_items jsonb,
  p_name text,
  p_phone text,
  p_address text,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_fee numeric;
  v_subtotal numeric := 0;
  v_order uuid;
  v_qty int;
  it jsonb;
  m record;
begin
  if v_user is null then raise exception 'Please sign in first'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;

  select delivery_fee into v_fee from restaurants where id = p_restaurant_id;
  if v_fee is null then raise exception 'Restaurant not found'; end if;

  insert into orders (restaurant_id, user_id, customer_name, phone, address, notes, delivery_fee)
  values (p_restaurant_id, v_user, p_name, p_phone, p_address, p_notes, v_fee)
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := least(greatest((it->>'qty')::int, 1), 50);

    select id, name, price into m
    from menu_items
    where id = (it->>'id')::uuid
      and restaurant_id = p_restaurant_id
      and is_available = true;

    if not found then raise exception 'An item is no longer available'; end if;

    insert into order_items (order_id, menu_item_id, name, price, qty)
    values (v_order, m.id, m.name, m.price, v_qty);

    v_subtotal := v_subtotal + m.price * v_qty;
  end loop;

  update orders set subtotal = v_subtotal, total = v_subtotal + v_fee where id = v_order;
  return v_order;
end;
$$;

revoke execute on function place_order(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function place_order(uuid, jsonb, text, text, text, text) to authenticated;

-- ---------- 5) RECOMMENDATIONS (item-based collaborative filtering + popularity) ----------
create or replace function recommend_items(
  p_restaurant_id uuid,
  p_cart_ids uuid[] default '{}',
  p_limit int default 4
)
returns table (rec_item_id uuid, rec_score numeric)
language sql
security definer
stable
set search_path = public
as $$
  with co as (
    select oi2.menu_item_id as item_id, count(distinct oi2.order_id)::numeric as s
    from order_items oi1
    join order_items oi2
      on oi1.order_id = oi2.order_id and oi2.menu_item_id <> oi1.menu_item_id
    join orders o on o.id = oi1.order_id
    where o.restaurant_id = p_restaurant_id
      and o.status <> 'cancelled'
      and oi1.menu_item_id = any(p_cart_ids)
    group by oi2.menu_item_id
  ),
  pop as (
    select oi.menu_item_id as item_id, sum(oi.qty)::numeric as s
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.restaurant_id = p_restaurant_id and o.status <> 'cancelled'
    group by oi.menu_item_id
  )
  select m.id, (coalesce(co.s, 0) * 10 + coalesce(pop.s, 0)) as score
  from menu_items m
  left join co on co.item_id = m.id
  left join pop on pop.item_id = m.id
  where m.restaurant_id = p_restaurant_id
    and m.is_available = true
    and not (m.id = any(coalesce(p_cart_ids, '{}')))
  order by score desc, random()
  limit least(greatest(p_limit, 1), 12);
$$;

grant execute on function recommend_items(uuid, uuid[], int) to anon, authenticated;

-- ---------- 6) IMAGE STORAGE (staff upload into a folder named after their restaurant id) ----------
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "public read menu images" on storage.objects
  for select using (bucket_id = 'menu-images');

create policy "staff upload menu images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and exists (
      select 1 from restaurant_staff s
      where s.user_id = auth.uid()
        and s.restaurant_id::text = (storage.foldername(name))[1]
    )
  );

create policy "staff delete menu images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (
      select 1 from restaurant_staff s
      where s.user_id = auth.uid()
        and s.restaurant_id::text = (storage.foldername(name))[1]
    )
  );

-- ---------- 7) REALTIME (live order alerts) ----------
alter publication supabase_realtime add table orders;

-- ---------- 8) INDEXES (foreign keys and common filters) ----------
create index if not exists idx_orders_user_id            on orders (user_id);
create index if not exists idx_orders_restaurant_created on orders (restaurant_id, created_at desc);
create index if not exists idx_order_items_order_id      on order_items (order_id);
create index if not exists idx_order_items_menu_item_id  on order_items (menu_item_id);
create index if not exists idx_menu_items_restaurant     on menu_items (restaurant_id);
create index if not exists idx_menu_items_category       on menu_items (category_id);
create index if not exists idx_categories_restaurant     on categories (restaurant_id);
create index if not exists idx_tickets_restaurant_created on support_tickets (restaurant_id, created_at desc);
create index if not exists idx_tickets_user_id           on support_tickets (user_id);
create index if not exists idx_staff_user_id             on restaurant_staff (user_id);