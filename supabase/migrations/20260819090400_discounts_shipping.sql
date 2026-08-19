-- =============================================================================
-- 0005 · Descuentos y métodos de envío
-- =============================================================================

create table if not exists public.discounts (
  id                uuid primary key default gen_random_uuid(),
  code              extensions.citext not null unique,
  description       text,
  type              public.discount_type not null default 'percentage',
  value             numeric(10, 2) not null default 0 check (value >= 0),
  min_subtotal      numeric(10, 2) not null default 0 check (min_subtotal >= 0),
  -- Ámbito opcional: {"product_ids": [...], "category_ids": [...]}
  applies_to        jsonb not null default '{}'::jsonb,
  usage_limit       integer check (usage_limit is null or usage_limit > 0),
  usage_limit_per_customer integer check (usage_limit_per_customer is null or usage_limit_per_customer > 0),
  usage_count       integer not null default 0 check (usage_count >= 0),
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,
  is_active         boolean not null default true,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint discounts_percentage_range
    check (type <> 'percentage' or value <= 100),
  constraint discounts_valid_window
    check (ends_at is null or ends_at > starts_at)
);

create index if not exists discounts_active_idx
  on public.discounts (is_active, starts_at, ends_at);

drop trigger if exists set_updated_at on public.discounts;
create trigger set_updated_at before update on public.discounts
  for each row execute function public.set_updated_at();

create table if not exists public.discount_redemptions (
  id          uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  order_id    uuid,
  amount      numeric(10, 2) not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists discount_redemptions_discount_idx
  on public.discount_redemptions (discount_id, created_at desc);

-- --- Métodos de envío --------------------------------------------------------
create table if not exists public.shipping_methods (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text,
  price              numeric(10, 2) not null default 0 check (price >= 0),
  free_above_subtotal numeric(10, 2) check (free_above_subtotal is null or free_above_subtotal >= 0),
  estimated_days_min smallint,
  estimated_days_max smallint,
  countries          char(2)[] not null default '{PA}',
  is_active          boolean not null default true,
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.shipping_methods;
create trigger set_updated_at before update on public.shipping_methods
  for each row execute function public.set_updated_at();

-- Valida un código de descuento y devuelve el importe a aplicar sobre `subtotal`.
-- El cálculo vive en la base de datos para que storefront y admin no diverjan.
create or replace function public.validate_discount(
  p_code text,
  p_subtotal numeric,
  p_customer_id uuid default null
)
returns table (
  discount_id uuid,
  code text,
  type public.discount_type,
  amount numeric,
  is_valid boolean,
  reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d public.discounts%rowtype;
  used_by_customer integer := 0;
begin
  select * into d from public.discounts
  where public.discounts.code = p_code::extensions.citext
  limit 1;

  if not found then
    return query select null::uuid, p_code, null::public.discount_type, 0::numeric, false,
                        'Código no encontrado';
    return;
  end if;

  if not d.is_active
     or d.starts_at > now()
     or (d.ends_at is not null and d.ends_at < now()) then
    return query select d.id, d.code::text, d.type, 0::numeric, false, 'Código expirado o inactivo';
    return;
  end if;

  if d.usage_limit is not null and d.usage_count >= d.usage_limit then
    return query select d.id, d.code::text, d.type, 0::numeric, false, 'Código agotado';
    return;
  end if;

  if p_customer_id is not null and d.usage_limit_per_customer is not null then
    select count(*) into used_by_customer
    from public.discount_redemptions r
    where r.discount_id = d.id and r.customer_id = p_customer_id;

    if used_by_customer >= d.usage_limit_per_customer then
      return query select d.id, d.code::text, d.type, 0::numeric, false,
                          'Límite de usos por cliente alcanzado';
      return;
    end if;
  end if;

  if p_subtotal < d.min_subtotal then
    return query select d.id, d.code::text, d.type, 0::numeric, false,
                        format('Requiere un subtotal mínimo de %s', d.min_subtotal);
    return;
  end if;

  return query select
    d.id,
    d.code::text,
    d.type,
    case d.type
      when 'percentage'   then round(p_subtotal * d.value / 100, 2)
      when 'fixed_amount' then least(d.value, p_subtotal)
      else 0::numeric
    end,
    true,
    null::text;
end;
$$;

comment on function public.validate_discount(text, numeric, uuid) is
  'Única fuente de verdad para validar y calcular descuentos (storefront + admin).';
