-- =============================================================================
-- 0021 · La dirección deja de ser solo texto
-- =============================================================================
-- Fase L1 del plan de logística.
--
-- POR QUÉ
--
-- Una entrega no falla en la ruta: falla cuando se capturó la dirección. En
-- Panamá la dirección escrita no es una referencia fiable —no hay numeración
-- consistente y el código postal apenas se usa—, así que la única referencia
-- dura es la coordenada.
--
-- Y no es criterio nuestro: la guía de Servientrega Panamá acepta campos
-- `latitud` y `longitud` (ver docs/INVESTIGACION-COURIERS-PANAMA.md). El
-- courier nacional consume coordenadas. Sin estas columnas se le entrega una
-- guía peor de lo que su propia API admite.
--
-- QUÉ SE GUARDA, Y QUÉ NO
--
-- La base de datos solo impone lo que es *imposible*: una latitud fuera de
-- [-90, 90] no existe. Lo que es meramente *improbable* —un punto fuera de
-- Panamá— se avisa en la interfaz, no se prohíbe aquí: una tienda que algún día
-- envíe fuera del país no debería necesitar una migración para hacerlo.
--
-- SOBRE LAS ZONAS DE COBERTURA
--
-- Los polígonos van en `jsonb` y no en PostGIS, a propósito:
--
--   * Las zonas son unas pocas, no miles. El punto-en-polígono se resuelve en
--     memoria sin que se note.
--   * La comprobación vive en `@nebula/domain`, así que se prueba sin levantar
--     base de datos y la comparten tienda y panel.
--   * Añadir PostGIS es una dependencia de infraestructura que habría que
--     mantener, migrar y tener presente en cada restauración.
--
-- Si algún día hay cientos de zonas o hace falta buscar «la zona más cercana»,
-- esto se revisa: la columna es `jsonb`, así que migrar a `geography` es un
-- `alter table`, no un rediseño.
-- =============================================================================

-- --- 1. Coordenadas y referencias en las direcciones guardadas ---------------
alter table public.addresses
  add column if not exists latitude  numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add column if not exists location_precision text,
  add column if not exists reference text,
  add column if not exists delivery_instructions text;

comment on column public.addresses.latitude is
  'Coordenada del punto de entrega. Es la referencia dura; el texto es apoyo.';
comment on column public.addresses.location_precision is
  'De dónde salió el punto: gps (ubicación del navegador), pin (lo colocó la persona), geocoded (lo dedujo el buscador) o manual (se escribió a mano).';
comment on column public.addresses.reference is
  'Cómo reconocer el sitio: «portón negro, al lado de la farmacia».';
comment on column public.addresses.delivery_instructions is
  'Qué hacer al llegar: «llamar antes», «dejar en portería».';

alter table public.addresses
  drop constraint if exists addresses_latitude_range;
alter table public.addresses
  add constraint addresses_latitude_range
  check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table public.addresses
  drop constraint if exists addresses_longitude_range;
alter table public.addresses
  add constraint addresses_longitude_range
  check (longitude is null or (longitude >= -180 and longitude <= 180));

-- Media coordenada no sirve para nada, y es peor que ninguna: parece un dato.
alter table public.addresses
  drop constraint if exists addresses_coords_completas;
alter table public.addresses
  add constraint addresses_coords_completas
  check ((latitude is null) = (longitude is null));

alter table public.addresses
  drop constraint if exists addresses_precision_valida;
alter table public.addresses
  add constraint addresses_precision_valida
  check (
    location_precision is null
    or location_precision in ('gps', 'pin', 'geocoded', 'manual')
  );

-- Saber de dónde salió el punto importa tanto como el punto: una coordenada
-- «manual» merece que alguien la mire antes de mandar a un motorizado.
alter table public.addresses
  drop constraint if exists addresses_precision_con_coords;
alter table public.addresses
  add constraint addresses_precision_con_coords
  check ((latitude is null) = (location_precision is null));

-- --- 2. Zonas de cobertura ----------------------------------------------------
create table if not exists public.delivery_zones (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  -- Anillo exterior de un polígono, como [[lng, lat], [lng, lat], ...].
  -- El orden es lng-lat, igual que GeoJSON, para no tener dos convenciones.
  polygon      jsonb not null default '[]'::jsonb,
  -- Tarifa propia de la zona. `null` = usa el método de envío normal.
  shipping_price numeric(10, 2) check (shipping_price is null or shipping_price >= 0),
  -- Reparto propio (motorizados) o courier externo. Lo usa la fase L4.
  handled_by   text not null default 'propio',
  is_active    boolean not null default true,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint delivery_zones_handled_by_valido
    check (handled_by in ('propio', 'courier'))
);

comment on table public.delivery_zones is
  'Áreas de reparto. El polígono se evalúa en la aplicación (@nebula/domain), no en la base: son pocas zonas y así la regla se prueba sin Postgres.';

create index if not exists delivery_zones_activas_idx
  on public.delivery_zones (is_active, position);

drop trigger if exists set_updated_at on public.delivery_zones;
create trigger set_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

-- --- 3. Seguridad -------------------------------------------------------------
-- Las zonas activas son públicas: el checkout necesita decir «no llegamos ahí»
-- antes de cobrar, y eso ocurre sin sesión.
alter table public.delivery_zones enable row level security;

drop policy if exists "delivery_zones_public_read" on public.delivery_zones;
create policy "delivery_zones_public_read" on public.delivery_zones
  for select using (is_active or public.is_staff());

drop policy if exists "delivery_zones_admin_write" on public.delivery_zones;
create policy "delivery_zones_admin_write" on public.delivery_zones
  for all using (public.is_admin()) with check (public.is_admin());

-- El pedido guarda una instantánea de la dirección en `orders.shipping_address`
-- (jsonb), así que las coordenadas viajan ahí sin cambiar el esquema. No se
-- añade columna: el pedido no debe romperse si la dirección guardada cambia,
-- que es justo por lo que esa columna es una instantánea.
