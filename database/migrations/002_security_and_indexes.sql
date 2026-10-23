-- =====================================================================
-- Migration 002: tickets require sign-in + foreign-key indexes
-- Run ONCE in Supabase SQL Editor on your EXISTING database.
-- (Fresh installs get all of this from schema.sql already.)
-- =====================================================================

-- 1) Support tickets: only signed-in users may create them (for themselves)
drop policy if exists "anyone can create ticket" on support_tickets;
drop policy if exists "signed-in users can create tickets" on support_tickets;

create policy "signed-in users can create tickets" on support_tickets
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'open'
    and char_length(message) between 1 and 1000
    and char_length(name) between 1 and 100
    and char_length(phone) between 5 and 30
  );

-- 2) Indexes on foreign keys and common filters
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