-- =============================================================================
-- 0006 · Carritos, pedidos y pagos
-- =============================================================================
-- Los pedidos guardan una *instantánea* de precios, direcciones y datos de
-- producto: editar el catálogo más tarde nunca debe alterar el histórico.
-- =============================================================================

-- --- Carritos ----------------------------------------------------------------
create table if not exists public.carts (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references public.customers (id) on delete set null,
  -- Token anónimo para visitantes sin cuenta (cookie httpOnly del storefront).
  session_token text unique,
  status        public.cart_status not null default 'active',
  currency      char(3) not null default 'USD',
  discount_code text,
  expires_at    timestamptz not null default now() + interval '30 days',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint carts_owner_present check (customer_id is not null or session_token is not null)
);

create index if not exists carts_customer_idx on public.carts (customer_id, status);

drop trigger if exists set_updated_at on public.carts;
create trigger set_updated_at before update on public.carts
  for each row execute function public.set_updated_at();

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity   integer not null default 1 check (quantity > 0),
  -- Precio observado al añadir: permite detectar cambios antes de cobrar.
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

drop trigger if exists set_updated_at on public.cart_items;
create trigger set_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();

-- --- Pedidos -----------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1000;

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique
                     default 'NB-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
  customer_id        uuid references public.customers (id) on delete set null,
  email              extensions.citext not null,
  phone              text,
  status             public.order_status not null default 'pending',
  payment_status     public.payment_status not null default 'pending',
  fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  currency           char(3) not null default 'USD',
  subtotal           numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount_total     numeric(12, 2) not null default 0 check (discount_total >= 0),
  shipping_total     numeric(12, 2) not null default 0 check (shipping_total >= 0),
  tax_total          numeric(12, 2) not null default 0 check (tax_total >= 0),
  total              numeric(12, 2) not null default 0 check (total >= 0),
  discount_code      text,
  -- Instantáneas: el pedido no debe romperse si se borra la dirección guardada.
  shipping_address   jsonb,
  billing_address    jsonb,
  shipping_method    jsonb,
  customer_note      text,
  internal_note      text,
  cancelled_reason   text,
  cart_id            uuid references public.carts (id) on delete set null,
  placed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_placed_at_idx on public.orders (placed_at desc);

drop trigger if exists set_updated_at on public.orders;
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.discount_redemptions
  drop constraint if exists discount_redemptions_order_id_fkey;
alter table public.discount_redemptions
  add constraint discount_redemptions_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete set null;

create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  variant_id     uuid references public.product_variants (id) on delete set null,
  product_id     uuid references public.products (id) on delete set null,
  -- Instantánea del producto en el momento de la compra.
  product_title  text not null,
  variant_title  text,
  sku            text,
  image_url      text,
  unit_price     numeric(10, 2) not null check (unit_price >= 0),
  quantity       integer not null check (quantity > 0),
  discount_total numeric(10, 2) not null default 0 check (discount_total >= 0),
  total          numeric(12, 2) not null check (total >= 0),
  created_at     timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- --- Pagos -------------------------------------------------------------------
-- Nunca se almacenan datos de tarjeta: solo el identificador que devuelve la
-- pasarela tras tokenizar en su propio widget/SDK (brief §7).
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  provider            public.payment_provider not null,
  provider_payment_id text,
  status              public.payment_status not null default 'pending',
  amount              numeric(12, 2) not null check (amount >= 0),
  currency            char(3) not null default 'USD',
  -- Respuesta de la pasarela, saneada de PII/PAN antes de guardarse.
  provider_response   jsonb not null default '{}'::jsonb,
  error_message       text,
  processed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments (order_id);
create unique index if not exists payments_provider_ref_key
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

drop trigger if exists set_updated_at on public.payments;
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Idempotencia de webhooks: cada pasarela reintenta, y el mismo evento no debe
-- procesarse dos veces.
create table if not exists public.payment_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  provider         public.payment_provider not null,
  event_id         text not null,
  event_type       text,
  signature_valid  boolean not null default false,
  payload          jsonb not null default '{}'::jsonb,
  order_id         uuid references public.orders (id) on delete set null,
  processed_at     timestamptz,
  error_message    text,
  received_at      timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists payment_webhook_events_unprocessed_idx
  on public.payment_webhook_events (received_at desc) where processed_at is null;

-- --- Bitácora del pedido ------------------------------------------------------
create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  type       text not null,
  message    text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_idx on public.order_events (order_id, created_at desc);

-- Registra automáticamente los cambios de estado (auditoría, brief §1 fase 5).
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.order_events (order_id, actor_id, type, message, metadata)
    values (
      new.id, auth.uid(), 'status_changed',
      format('Estado: %s -> %s', old.status, new.status),
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  if tg_op = 'UPDATE' and new.payment_status is distinct from old.payment_status then
    insert into public.order_events (order_id, actor_id, type, message, metadata)
    values (
      new.id, auth.uid(), 'payment_status_changed',
      format('Pago: %s -> %s', old.payment_status, new.payment_status),
      jsonb_build_object('from', old.payment_status, 'to', new.payment_status)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists on_order_status_changed on public.orders;
create trigger on_order_status_changed
  after update on public.orders
  for each row execute function public.log_order_status_change();

-- Mantiene las métricas de CRM al confirmarse el pago.
create or replace function public.refresh_customer_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null then
    return null;
  end if;

  update public.customers c
  set orders_count  = coalesce(agg.total_orders, 0),
      total_spent   = coalesce(agg.total_spent, 0),
      last_order_at = agg.last_order_at
  from (
    select count(*) as total_orders,
           sum(o.total) as total_spent,
           max(o.placed_at) as last_order_at
    from public.orders o
    where o.customer_id = new.customer_id
      and o.payment_status in ('paid', 'partially_refunded')
  ) agg
  where c.id = new.customer_id;

  return null;
end;
$$;

drop trigger if exists on_order_paid on public.orders;
create trigger on_order_paid
  after insert or update of payment_status, total on public.orders
  for each row execute function public.refresh_customer_stats();
