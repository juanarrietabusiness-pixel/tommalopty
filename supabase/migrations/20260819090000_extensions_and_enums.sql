-- =============================================================================
-- 0001 · Extensiones, tipos enumerados y utilidades compartidas
-- =============================================================================
-- Todo el esquema de negocio vive en `public`. Las funciones auxiliares de
-- autorización se declaran SECURITY DEFINER con search_path fijo para poder
-- consultarse desde las políticas RLS sin provocar recursión.
-- =============================================================================

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;
create extension if not exists "unaccent" with schema extensions;

-- --- Tipos enumerados --------------------------------------------------------

do $$ begin
  create type public.user_role as enum ('customer', 'operator', 'admin', 'superadmin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fulfillment_status as enum ('unfulfilled', 'partial', 'fulfilled', 'returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_provider as enum ('paypal', 'wompi', 'paguelofacil', 'yappy', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_type as enum ('percentage', 'fixed_amount', 'free_shipping');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.address_type as enum ('shipping', 'billing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cart_status as enum ('active', 'converted', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- --- Utilidades --------------------------------------------------------------

-- Mantiene `updated_at` en cada UPDATE. Se engancha por trigger en cada tabla.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Convierte un texto a slug URL-safe ("Café Orgánico 250g" -> "cafe-organico-250g").
create or replace function public.slugify(value text)
returns text
language sql
immutable
strict
set search_path = public, extensions
as $$
  select trim(
           both '-' from
           regexp_replace(
             lower(extensions.unaccent(value)),
             '[^a-z0-9]+', '-', 'g'
           )
         );
$$;

comment on function public.slugify(text) is
  'Normaliza un texto a slug URL-safe. Usado por catálogo y CMS.';

-- Construye el vector de búsqueda de un producto.
-- Se declara IMMUTABLE (y no se inlinea en la tabla) porque `array_to_string`
-- es STABLE y Postgres no acepta expresiones no inmutables en columnas generadas.
create or replace function public.build_product_search_vector(
  p_title text,
  p_brand text,
  p_subtitle text,
  p_tags text[],
  p_description text
)
returns tsvector
language sql
immutable
as $$
  select setweight(to_tsvector('spanish', coalesce(p_title, '')), 'A')
      || setweight(to_tsvector('spanish', coalesce(p_brand, '')), 'B')
      || setweight(to_tsvector('spanish', coalesce(p_subtitle, '')), 'B')
      || setweight(to_tsvector('spanish', coalesce(array_to_string(p_tags, ' '), '')), 'C')
      || setweight(to_tsvector('spanish', coalesce(p_description, '')), 'D');
$$;
