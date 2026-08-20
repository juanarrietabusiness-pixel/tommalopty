-- =============================================================================
-- 0004 · Clientes y CRM
-- =============================================================================
-- `customers` existe con o sin cuenta: un checkout de invitado crea la ficha
-- por email y se enlaza a `profiles` en cuanto la persona se registra.
-- =============================================================================

create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid unique references public.profiles (id) on delete set null,
  email             extensions.citext not null unique,
  first_name        text,
  last_name         text,
  phone             text,
  accepts_marketing boolean not null default false,
  marketing_opt_in_at timestamptz,
  tags              text[] not null default '{}',
  -- Métricas denormalizadas para el CRM y la segmentación.
  orders_count      integer not null default 0 check (orders_count >= 0),
  total_spent       numeric(12, 2) not null default 0 check (total_spent >= 0),
  last_order_at     timestamptz,
  notes_count       integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.customers is
  'Ficha CRM. `profile_id` es null en compras de invitado hasta que se registran.';

create index if not exists customers_tags_idx on public.customers using gin (tags);
create index if not exists customers_last_order_idx on public.customers (last_order_at desc nulls last);

drop trigger if exists set_updated_at on public.customers;
create trigger set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- FK diferida de reseñas -> clientes (la tabla se creó en la migración anterior).
alter table public.reviews
  drop constraint if exists reviews_customer_id_fkey;
alter table public.reviews
  add constraint reviews_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete set null;

-- Enlaza (o crea) la ficha de cliente cuando nace un perfil.
create or replace function public.link_customer_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customers (profile_id, email, first_name)
  values (new.id, new.email, nullif(split_part(coalesce(new.full_name, ''), ' ', 1), ''))
  on conflict (email) do update
    set profile_id = excluded.profile_id,
        updated_at = now()
    where public.customers.profile_id is null;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.link_customer_to_profile();

-- --- Direcciones -------------------------------------------------------------
create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  type         public.address_type not null default 'shipping',
  label        text,
  first_name   text not null,
  last_name    text not null,
  company      text,
  line1        text not null,
  line2        text,
  city         text not null,
  province     text,
  country_code char(2) not null default 'PA',
  postal_code  text,
  phone        text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists addresses_customer_idx on public.addresses (customer_id, type);
create unique index if not exists addresses_default_key
  on public.addresses (customer_id, type) where is_default;

drop trigger if exists set_updated_at on public.addresses;
create trigger set_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- --- Notas internas del CRM ---------------------------------------------------
create table if not exists public.crm_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  body        text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists crm_notes_customer_idx
  on public.crm_notes (customer_id, created_at desc);

drop trigger if exists set_updated_at on public.crm_notes;
create trigger set_updated_at before update on public.crm_notes
  for each row execute function public.set_updated_at();

-- --- Catálogo de etiquetas (para autocompletar y segmentar) ------------------
create table if not exists public.crm_tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#173c2e',
  description text,
  created_at  timestamptz not null default now()
);

-- --- Leads (captación: newsletter, formularios, campañas) --------------------
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  email        extensions.citext not null,
  name         text,
  phone        text,
  source       text not null default 'newsletter',
  status       public.lead_status not null default 'new',
  utm          jsonb not null default '{}'::jsonb,
  customer_id  uuid references public.customers (id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists leads_email_source_key on public.leads (email, source);
create index if not exists leads_status_idx on public.leads (status, created_at desc);

drop trigger if exists set_updated_at on public.leads;
create trigger set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- --- Campañas de marketing ---------------------------------------------------
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  channel       text not null default 'email',
  status        public.content_status not null default 'draft',
  subject       text,
  body          text,
  segment       jsonb not null default '{}'::jsonb,
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  stats         jsonb not null default '{}'::jsonb,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.campaigns;
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- --- Wishlist (panel de cliente) ---------------------------------------------
create table if not exists public.wishlists (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name        text not null default 'Favoritos',
  created_at  timestamptz not null default now(),
  unique (customer_id, name)
);

create table if not exists public.wishlist_items (
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);
