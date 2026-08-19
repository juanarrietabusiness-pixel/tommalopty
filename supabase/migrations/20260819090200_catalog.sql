-- =============================================================================
-- 0003 · Catálogo: categorías, productos, variantes, imágenes, inventario
-- =============================================================================

-- --- Categorías (jerárquicas) ------------------------------------------------
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid references public.categories (id) on delete set null,
  slug            text not null unique,
  name            text not null,
  description     text,
  image_url       text,
  position        integer not null default 0,
  is_active       boolean not null default true,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint categories_not_self_parent check (parent_id is null or parent_id <> id)
);

create index if not exists categories_parent_idx on public.categories (parent_id);
create index if not exists categories_active_idx on public.categories (is_active, position);

drop trigger if exists set_updated_at on public.categories;
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- --- Productos ---------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  subtitle         text,
  description      text,
  brand            text,
  status           public.product_status not null default 'draft',
  is_featured      boolean not null default false,
  tags             text[] not null default '{}',
  seo_title        text,
  seo_description  text,
  -- Métricas denormalizadas para ordenar el grid sin joins caros.
  rating_average   numeric(3, 2) not null default 0 check (rating_average between 0 and 5),
  rating_count     integer not null default 0 check (rating_count >= 0),
  published_at     timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Búsqueda full-text de Postgres (sección "Búsqueda" del brief).
  search_vector    tsvector generated always as (
    public.build_product_search_vector(title, brand, subtitle, tags, description)
  ) stored
);

comment on column public.products.search_vector is
  'Índice full-text (español). Migrar a Meilisearch/Algolia si el catálogo crece.';

create index if not exists products_search_idx on public.products using gin (search_vector);
create index if not exists products_title_trgm_idx
  on public.products using gin (title extensions.gin_trgm_ops);
create index if not exists products_status_idx on public.products (status, published_at desc);
create index if not exists products_featured_idx
  on public.products (is_featured) where status = 'active';

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- --- Relación producto ↔ categoría (n:m) -------------------------------------
create table if not exists public.product_categories (
  product_id  uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_idx
  on public.product_categories (category_id);

-- --- Imágenes ----------------------------------------------------------------
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  url         text not null,
  alt         text,
  position    integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists product_images_product_idx
  on public.product_images (product_id, position);
-- Una sola imagen principal por producto.
create unique index if not exists product_images_primary_key
  on public.product_images (product_id) where is_primary;

-- --- Opciones de producto (Talla, Color, ...) --------------------------------
create table if not exists public.product_options (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name       text not null,
  values     text[] not null default '{}',
  position   integer not null default 0,
  unique (product_id, name)
);

-- --- Variantes ---------------------------------------------------------------
create table if not exists public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  sku               text unique,
  barcode           text,
  title             text not null default 'Estándar',
  -- Precio en USD (Panamá). Sin conversión de divisa: ver brief §7.
  price             numeric(10, 2) not null check (price >= 0),
  compare_at_price  numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  cost_price        numeric(10, 2) check (cost_price is null or cost_price >= 0),
  weight_grams      integer check (weight_grams is null or weight_grams >= 0),
  option_values     jsonb not null default '{}'::jsonb,
  image_url         text,
  position          integer not null default 0,
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint product_variants_compare_at_gt_price
    check (compare_at_price is null or compare_at_price >= price)
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, position);
create unique index if not exists product_variants_default_key
  on public.product_variants (product_id) where is_default;

drop trigger if exists set_updated_at on public.product_variants;
create trigger set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- --- Inventario --------------------------------------------------------------
create table if not exists public.inventory (
  variant_id            uuid primary key references public.product_variants (id) on delete cascade,
  quantity              integer not null default 0,
  reserved_quantity     integer not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold   integer not null default 5 check (low_stock_threshold >= 0),
  track_inventory       boolean not null default true,
  allow_backorder       boolean not null default false,
  location              text not null default 'principal',
  updated_at            timestamptz not null default now()
);

comment on column public.inventory.reserved_quantity is
  'Unidades comprometidas en pedidos aún no cumplidos. Disponible = quantity - reserved.';

drop trigger if exists set_updated_at on public.inventory;
create trigger set_updated_at before update on public.inventory
  for each row execute function public.set_updated_at();

-- Toda variante nace con su fila de inventario.
create or replace function public.ensure_inventory_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory (variant_id) values (new.id)
  on conflict (variant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_variant_created on public.product_variants;
create trigger on_variant_created
  after insert on public.product_variants
  for each row execute function public.ensure_inventory_row();

-- --- Reseñas -----------------------------------------------------------------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  customer_id  uuid,
  author_name  text not null,
  rating       smallint not null check (rating between 1 and 5),
  title        text,
  body         text,
  status       public.review_status not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists reviews_product_idx
  on public.reviews (product_id, status);

drop trigger if exists set_updated_at on public.reviews;
create trigger set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- Recalcula la media de valoración del producto al aprobar/editar reseñas.
create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating_average = coalesce(agg.avg_rating, 0),
      rating_count   = coalesce(agg.total, 0)
  from (
    select avg(rating)::numeric(3, 2) as avg_rating, count(*) as total
    from public.reviews
    where product_id = target_product and status = 'approved'
  ) agg
  where p.id = target_product;
  return null;
end;
$$;

drop trigger if exists on_review_changed on public.reviews;
create trigger on_review_changed
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();
