-- =============================================================================
-- 0009 · Row Level Security
-- =============================================================================
-- Modelo de acceso (brief §4):
--   anon          -> solo contenido publicado del catálogo y del CMS
--   authenticated -> además, SUS pedidos, direcciones, carrito y wishlist
--   operator      -> lectura del panel
--   admin         -> escritura del panel (catálogo, pedidos, CRM, CMS)
--   superadmin    -> usuarios admin e integraciones
--   service_role  -> bypass de RLS; reservado a Route Handlers del servidor
--                    (webhooks de pago, carritos de invitado, tareas internas)
-- =============================================================================

alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_categories    enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_options       enable row level security;
alter table public.product_variants      enable row level security;
alter table public.inventory             enable row level security;
alter table public.reviews               enable row level security;
alter table public.customers             enable row level security;
alter table public.addresses             enable row level security;
alter table public.crm_notes             enable row level security;
alter table public.crm_tags              enable row level security;
alter table public.leads                 enable row level security;
alter table public.campaigns             enable row level security;
alter table public.wishlists             enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.discounts             enable row level security;
alter table public.discount_redemptions  enable row level security;
alter table public.shipping_methods      enable row level security;
alter table public.carts                 enable row level security;
alter table public.cart_items            enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.payments              enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.order_events          enable row level security;
alter table public.cms_pages             enable row level security;
alter table public.cms_banners           enable row level security;
alter table public.cms_posts             enable row level security;
alter table public.cms_menus             enable row level security;
alter table public.settings              enable row level security;
alter table public.integrations          enable row level security;
alter table public.audit_log             enable row level security;

-- Devuelve el customer_id de la persona autenticada (null si es visitante).
create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.customers c where c.profile_id = auth.uid() limit 1;
$$;

-- =============================================================================
-- Perfiles
-- =============================================================================
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Solo un superadmin puede crear/modificar cuentas de staff o cambiar roles.
drop policy if exists "profiles_superadmin_all" on public.profiles;
create policy "profiles_superadmin_all" on public.profiles
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- =============================================================================
-- Catálogo — lectura pública de lo publicado, escritura de admin
-- =============================================================================
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select using (is_active or public.is_staff());

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (status = 'active' or public.is_staff());

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_categories_public_read" on public.product_categories;
create policy "product_categories_public_read" on public.product_categories
  for select using (
    public.is_staff() or exists (
      select 1 from public.products p where p.id = product_id and p.status = 'active'
    )
  );

drop policy if exists "product_categories_admin_write" on public.product_categories;
create policy "product_categories_admin_write" on public.product_categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images
  for select using (
    public.is_staff() or exists (
      select 1 from public.products p where p.id = product_id and p.status = 'active'
    )
  );

drop policy if exists "product_images_admin_write" on public.product_images;
create policy "product_images_admin_write" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_options_public_read" on public.product_options;
create policy "product_options_public_read" on public.product_options
  for select using (
    public.is_staff() or exists (
      select 1 from public.products p where p.id = product_id and p.status = 'active'
    )
  );

drop policy if exists "product_options_admin_write" on public.product_options;
create policy "product_options_admin_write" on public.product_options
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants
  for select using (
    public.is_staff() or (
      is_active and exists (
        select 1 from public.products p where p.id = product_id and p.status = 'active'
      )
    )
  );

drop policy if exists "product_variants_admin_write" on public.product_variants;
create policy "product_variants_admin_write" on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

-- El stock disponible es público (badge "agotado"); el coste y la reserva no se
-- exponen porque el storefront solo lee a través de `product_catalog`.
drop policy if exists "inventory_public_read" on public.inventory;
create policy "inventory_public_read" on public.inventory
  for select using (
    public.is_staff() or exists (
      select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.status = 'active'
    )
  );

drop policy if exists "inventory_admin_write" on public.inventory;
create policy "inventory_admin_write" on public.inventory
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- Reseñas
-- =============================================================================
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
  for select using (status = 'approved' or public.is_staff());

drop policy if exists "reviews_customer_insert" on public.reviews;
create policy "reviews_customer_insert" on public.reviews
  for insert to authenticated
  with check (customer_id = public.current_customer_id() and status = 'pending');

drop policy if exists "reviews_admin_write" on public.reviews;
create policy "reviews_admin_write" on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- Clientes y CRM
-- =============================================================================
drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers
  for select using (profile_id = auth.uid() or public.is_staff());

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "customers_admin_write" on public.customers;
create policy "customers_admin_write" on public.customers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own" on public.addresses
  for all using (customer_id = public.current_customer_id())
  with check (customer_id = public.current_customer_id());

drop policy if exists "addresses_staff_read" on public.addresses;
create policy "addresses_staff_read" on public.addresses
  for select using (public.is_staff());

drop policy if exists "addresses_admin_write" on public.addresses;
create policy "addresses_admin_write" on public.addresses
  for all using (public.is_admin()) with check (public.is_admin());

-- Las notas internas nunca son visibles para el cliente.
drop policy if exists "crm_notes_staff" on public.crm_notes;
create policy "crm_notes_staff" on public.crm_notes
  for select using (public.is_staff());

drop policy if exists "crm_notes_staff_write" on public.crm_notes;
create policy "crm_notes_staff_write" on public.crm_notes
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "crm_tags_staff" on public.crm_tags;
create policy "crm_tags_staff" on public.crm_tags
  for all using (public.is_staff()) with check (public.is_admin());

-- Cualquiera puede suscribirse (newsletter); solo el staff lee los leads.
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads
  for insert with check (true);

drop policy if exists "leads_staff_read" on public.leads;
create policy "leads_staff_read" on public.leads
  for select using (public.is_staff());

drop policy if exists "leads_admin_write" on public.leads;
create policy "leads_admin_write" on public.leads
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "campaigns_staff" on public.campaigns;
create policy "campaigns_staff" on public.campaigns
  for select using (public.is_staff());

drop policy if exists "campaigns_admin_write" on public.campaigns;
create policy "campaigns_admin_write" on public.campaigns
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "wishlists_own" on public.wishlists;
create policy "wishlists_own" on public.wishlists
  for all using (customer_id = public.current_customer_id())
  with check (customer_id = public.current_customer_id());

drop policy if exists "wishlist_items_own" on public.wishlist_items;
create policy "wishlist_items_own" on public.wishlist_items
  for all using (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.customer_id = public.current_customer_id()
    )
  )
  with check (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.customer_id = public.current_customer_id()
    )
  );

-- =============================================================================
-- Descuentos y envíos
-- =============================================================================
-- Los códigos NO son legibles públicamente: el storefront los valida llamando a
-- `validate_discount()` (SECURITY DEFINER), que devuelve solo el importe.
drop policy if exists "discounts_staff_read" on public.discounts;
create policy "discounts_staff_read" on public.discounts
  for select using (public.is_staff());

drop policy if exists "discounts_admin_write" on public.discounts;
create policy "discounts_admin_write" on public.discounts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "discount_redemptions_staff_read" on public.discount_redemptions;
create policy "discount_redemptions_staff_read" on public.discount_redemptions
  for select using (public.is_staff() or customer_id = public.current_customer_id());

drop policy if exists "discount_redemptions_admin_write" on public.discount_redemptions;
create policy "discount_redemptions_admin_write" on public.discount_redemptions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "shipping_methods_public_read" on public.shipping_methods;
create policy "shipping_methods_public_read" on public.shipping_methods
  for select using (is_active or public.is_staff());

drop policy if exists "shipping_methods_admin_write" on public.shipping_methods;
create policy "shipping_methods_admin_write" on public.shipping_methods
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- Carritos
-- =============================================================================
-- Un cliente autenticado gestiona su carrito directamente. Los carritos de
-- invitado (session_token) se manipulan desde Route Handlers con service_role:
-- un token en el cliente no es una credencial verificable por RLS.
drop policy if exists "carts_own" on public.carts;
create policy "carts_own" on public.carts
  for all to authenticated
  using (customer_id = public.current_customer_id())
  with check (customer_id = public.current_customer_id());

drop policy if exists "carts_staff_read" on public.carts;
create policy "carts_staff_read" on public.carts
  for select using (public.is_staff());

drop policy if exists "cart_items_own" on public.cart_items;
create policy "cart_items_own" on public.cart_items
  for all to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.customer_id = public.current_customer_id()
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.customer_id = public.current_customer_id()
    )
  );

drop policy if exists "cart_items_staff_read" on public.cart_items;
create policy "cart_items_staff_read" on public.cart_items
  for select using (public.is_staff());

-- =============================================================================
-- Pedidos y pagos
-- =============================================================================
-- Los pedidos los crea el servidor (service_role) tras validar precios y stock:
-- no existe política de INSERT para clientes.
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (customer_id = public.current_customer_id() or public.is_staff());

drop policy if exists "orders_admin_write" on public.orders;
create policy "orders_admin_write" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select using (
    public.is_staff() or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = public.current_customer_id()
    )
  );

drop policy if exists "order_items_admin_write" on public.order_items;
create policy "order_items_admin_write" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (
    public.is_staff() or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = public.current_customer_id()
    )
  );

drop policy if exists "payments_admin_write" on public.payments;
create policy "payments_admin_write" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- Los webhooks solo los escribe service_role; el staff los lee para depurar.
drop policy if exists "payment_webhook_events_staff_read" on public.payment_webhook_events;
create policy "payment_webhook_events_staff_read" on public.payment_webhook_events
  for select using (public.is_staff());

drop policy if exists "order_events_select" on public.order_events;
create policy "order_events_select" on public.order_events
  for select using (
    public.is_staff() or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = public.current_customer_id()
    )
  );

drop policy if exists "order_events_staff_write" on public.order_events;
create policy "order_events_staff_write" on public.order_events
  for insert with check (public.is_staff());

-- =============================================================================
-- CMS y ajustes
-- =============================================================================
drop policy if exists "cms_pages_public_read" on public.cms_pages;
create policy "cms_pages_public_read" on public.cms_pages
  for select using (status = 'published' or public.is_staff());

drop policy if exists "cms_pages_admin_write" on public.cms_pages;
create policy "cms_pages_admin_write" on public.cms_pages
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cms_banners_public_read" on public.cms_banners;
create policy "cms_banners_public_read" on public.cms_banners
  for select using (
    public.is_staff() or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    )
  );

drop policy if exists "cms_banners_admin_write" on public.cms_banners;
create policy "cms_banners_admin_write" on public.cms_banners
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cms_posts_public_read" on public.cms_posts;
create policy "cms_posts_public_read" on public.cms_posts
  for select using (status = 'published' or public.is_staff());

drop policy if exists "cms_posts_admin_write" on public.cms_posts;
create policy "cms_posts_admin_write" on public.cms_posts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cms_menus_public_read" on public.cms_menus;
create policy "cms_menus_public_read" on public.cms_menus
  for select using (true);

drop policy if exists "cms_menus_admin_write" on public.cms_menus;
create policy "cms_menus_admin_write" on public.cms_menus
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings_public_read" on public.settings;
create policy "settings_public_read" on public.settings
  for select using (is_public or public.is_staff());

drop policy if exists "settings_admin_write" on public.settings;
create policy "settings_admin_write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Integraciones: solo superadmin (brief §4).
drop policy if exists "integrations_admin_read" on public.integrations;
create policy "integrations_admin_read" on public.integrations
  for select using (public.is_admin());

drop policy if exists "integrations_superadmin_write" on public.integrations;
create policy "integrations_superadmin_write" on public.integrations
  for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists "audit_log_staff_read" on public.audit_log;
create policy "audit_log_staff_read" on public.audit_log
  for select using (public.is_staff());

-- =============================================================================
-- Grants
-- =============================================================================
grant usage on schema public to anon, authenticated;
grant select on public.product_catalog to anon, authenticated;
grant select on public.report_sales_daily, public.report_top_products,
                public.report_low_stock, public.report_conversion_funnel
  to authenticated;

grant execute on function public.search_products(text, integer, integer) to anon, authenticated;
grant execute on function public.validate_discount(text, numeric, uuid) to anon, authenticated;
grant execute on function public.dashboard_metrics(integer) to authenticated;
grant execute on function public.current_customer_id() to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_superadmin() to anon, authenticated;

-- Privilegios de tabla. En Supabase los `default privileges` ya conceden acceso a
-- anon/authenticated y RLS es la única barrera real; se declaran aquí de forma
-- explícita para que el esquema funcione igual en un Postgres no gestionado.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon, authenticated;
