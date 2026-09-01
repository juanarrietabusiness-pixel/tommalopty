-- =============================================================================
-- 0031 · Los motorizados son gente del sistema, con lo justo que necesitan ver
-- =============================================================================
-- Fase L4.1 del plan de logística.
--
-- LO QUE DECIDE ESTA MIGRACIÓN
--
-- Un motorizado abre la aplicación en la calle, con una mano, y tiene que ver
-- **los envíos que lleva encima y nada más**. Ni el catálogo, ni los pedidos de
-- otros, ni los clientes, ni cuánto se cobró. Eso no es una preferencia de
-- interfaz: es la superficie que queda expuesta el día que a alguien le roben el
-- teléfono desbloqueado.
--
-- Por eso el permiso se decide aquí abajo y no en las pantallas. Una pantalla
-- que no enseña algo sigue pudiendo pedirlo.
--
-- LA TRAMPA QUE YA COSTÓ ONCE DÍAS DE CATÁLOGO ILEGIBLE
--
-- Un motorizado también es `authenticated`. Cualquier permiso de tabla o de
-- columna que se le quite, se le quita igual a la dueña del negocio y a
-- cualquier cliente con sesión. Los permisos por columna no distinguen quién
-- eres; lo que distingue es la política. Así que aquí no se revoca **nada**: se
-- añaden políticas.
--
-- QUÉ NO PUEDE HACER UN MOTORIZADO, Y DÓNDE SE IMPIDE
--
-- Las políticas dicen qué *filas* alcanza. No dicen qué *columnas* puede
-- cambiar: RLS no sabe de columnas. Sin nada más, un motorizado con acceso a
-- actualizar su envío podría reasignárselo a otro, cambiar el destino o mover el
-- envío a otro pedido. Eso lo impide `guard_courier_shipment_update`, más abajo,
-- y por eso es la parte de este archivo que hay que leer con más cuidado.
-- =============================================================================

-- --- 1. Quién es quién ------------------------------------------------------
create table if not exists public.couriers (
  id            uuid primary key default gen_random_uuid(),

  -- La cuenta con la que entra. Uno a uno: dos fichas para la misma persona
  -- harían que «mis entregas» dependiera de con cuál se consultó.
  profile_id    uuid not null unique references public.profiles (id) on delete cascade,

  display_name  text not null,
  phone         text,

  -- Cédula y documentos: quien reparte mercancía ajena se identifica. Los
  -- documentos van en `jsonb` porque cada uno tiene campos distintos y su
  -- vencimiento, y una tabla por tipo de papel sería una tabla por trámite.
  national_id   text,
  documents     jsonb not null default '{}'::jsonb,

  vehicle_type  text not null default 'moto',
  plate         text,

  -- Lo que se le paga por entrega. Puede no estar: hay quien va a sueldo.
  rate          numeric(10, 2) check (rate is null or rate >= 0),

  status        text not null default 'activo',
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint couriers_status_valido
    check (status in ('activo', 'pausa', 'inactivo')),
  constraint couriers_vehiculo_valido
    check (vehicle_type in ('moto', 'auto', 'bicicleta', 'a_pie'))
);

comment on table public.couriers is
  'Ficha del motorizado. `profile_id` es la cuenta con la que entra a /motorizado.';
comment on column public.couriers.status is
  'activo: se le asigna. pausa: no se le asigna pero cierra lo que lleva. inactivo: no entra.';
comment on column public.couriers.documents is
  'Licencia, seguro y sus vencimientos. jsonb porque cada papel tiene campos distintos.';

create index if not exists couriers_status_idx on public.couriers (status)
  where status <> 'inactivo';

drop trigger if exists set_updated_at on public.couriers;
create trigger set_updated_at before update on public.couriers
  for each row execute function public.set_updated_at();

-- --- 2. Qué zonas cubre cada uno --------------------------------------------
-- Tabla de unión y no un `uuid[]` en la ficha: con un array, borrar una zona de
-- reparto deja identificadores colgando que ya no apuntan a nada, y nadie se
-- entera hasta que el reparto automático propone una zona que no existe.
create table if not exists public.courier_zones (
  courier_id uuid not null references public.couriers (id) on delete cascade,
  zone_id    uuid not null references public.delivery_zones (id) on delete cascade,
  primary key (courier_id, zone_id)
);

comment on table public.courier_zones is
  'Zonas que cubre cada motorizado. Tabla de unión para que borrar una zona no deje huérfanos.';

create index if not exists courier_zones_zone_idx on public.courier_zones (zone_id);

-- --- 3. Los dos ayudantes que usan las políticas ----------------------------
-- SECURITY DEFINER por lo mismo que `is_staff()`: dentro de ellas no se evalúa
-- la RLS de las tablas que consultan, lo que evita recursión al preguntar por el
-- propio permiso.

create or replace function public.current_courier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.couriers c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id = auth.uid()
    and p.is_active
    and p.role = 'courier'
    and c.status <> 'inactivo';
$$;

comment on function public.current_courier_id() is
  'La ficha de motorizado de quien consulta, o null. Un inactivo no tiene: no entra.';

create or replace function public.is_courier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_courier_id() is not null;
$$;

-- `pausa` sí pasa: quien está en pausa no recibe entregas nuevas, pero tiene que
-- poder cerrar las que ya lleva encima. Dejarlo fuera significaría que pausar a
-- alguien a media tarde le deja tres paquetes sin poder marcar entregados.
comment on function public.is_courier() is
  'true si quien consulta es un motorizado en activo o en pausa. Un inactivo, no.';

grant execute on function public.current_courier_id() to authenticated;
grant execute on function public.is_courier() to anon, authenticated;

-- --- 4. Un motorizado solo cambia el estado y la prueba de entrega ----------
-- ESTA ES LA PARTE IMPORTANTE DEL ARCHIVO.
--
-- La política de más abajo le deja actualizar las filas que tiene asignadas.
-- Pero RLS decide filas, no columnas: sin esta guardia, un motorizado podría
-- reasignarse el envío de otro, cambiar la dirección de entrega o mover el envío
-- a un pedido distinto, y todo ello pasando la política sin despeinarse.
--
-- Se declara en la base y no en la aplicación por el mismo motivo que la máquina
-- de estados: la de la aplicación es una recomendación que cualquier cliente de
-- la API se salta.
create or replace function public.guard_courier_shipment_update()
returns trigger
language plpgsql
as $$
begin
  -- El equipo puede tocarlo todo: esta guardia existe solo para los motorizados.
  if public.is_staff() then
    return new;
  end if;

  -- Ni el service-role ni nadie más llega hasta aquí con permiso de escritura
  -- —la política lo impide—, salvo la clave de servicio, que es el servidor
  -- actuando en nombre de la tienda: la página del QR mueve envíos así.
  if not public.is_courier() then
    return new;
  end if;

  if new.order_id                is distinct from old.order_id
     or new.tracking_number      is distinct from old.tracking_number
     or new.token                is distinct from old.token
     or new.assigned_to          is distinct from old.assigned_to
     or new.destination          is distinct from old.destination
     or new.latitude             is distinct from old.latitude
     or new.longitude            is distinct from old.longitude
     or new.carrier              is distinct from old.carrier
     or new.carrier_tracking_number is distinct from old.carrier_tracking_number
     or new.carrier_tracking_url is distinct from old.carrier_tracking_url
     or new.shipping_cost        is distinct from old.shipping_cost
     or new.estimated_at         is distinct from old.estimated_at
     -- Las fechas las pone `guard_shipment_transition`, que corre después de
     -- esta guardia. Que las ponga la base y no quien llama es lo que impide
     -- que una entrega de las nueve de la noche conste a las cinco de la tarde.
     or new.dispatched_at        is distinct from old.dispatched_at
     or new.delivered_at         is distinct from old.delivered_at
  then
    raise exception
      'Un motorizado solo puede cambiar el estado y la prueba de entrega de su envío.'
      using errcode = '42501';
  end if;

  -- Asignar y devolver son decisiones de quien despacha, no de quien reparte.
  -- La lista es la misma que `ESTADOS_DEL_MOTORIZADO` en @nebula/domain.
  if new.status is distinct from old.status
     and new.status not in ('recogido', 'en_ruta', 'entregado', 'fallido')
  then
    raise exception 'Un motorizado no puede poner un envío en "%".', new.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_courier_shipment_update() is
  'RLS decide filas, no columnas. Esto impide que un motorizado se reasigne un envío o le cambie el destino.';

revoke all on function public.guard_courier_shipment_update() from public, anon, authenticated;

-- El nombre importa: los `before update` corren en orden alfabético, y este
-- tiene que evaluarse con los valores tal como llegaron, ANTES de que
-- `guard_shipment_transition` ponga las fechas. `guard_c…` < `guard_s…`.
drop trigger if exists guard_courier_shipment_update on public.shipments;
create trigger guard_courier_shipment_update
  before update on public.shipments
  for each row execute function public.guard_courier_shipment_update();

-- --- 5. Seguridad -----------------------------------------------------------
alter table public.couriers enable row level security;
alter table public.courier_zones enable row level security;

-- El equipo gestiona las fichas.
drop policy if exists "couriers_staff_read" on public.couriers;
create policy "couriers_staff_read" on public.couriers
  for select using (public.is_staff());

drop policy if exists "couriers_staff_write" on public.couriers;
create policy "couriers_staff_write" on public.couriers
  for all using (public.is_admin()) with check (public.is_admin());

-- Cada motorizado ve su propia ficha y solo la suya: la necesita para saber su
-- tarifa y qué papeles se le vencen. No la puede editar — su tarifa la acuerda
-- quien le contrata.
drop policy if exists "couriers_propia_ficha" on public.couriers;
create policy "couriers_propia_ficha" on public.couriers
  for select using (profile_id = auth.uid());

drop policy if exists "courier_zones_staff_read" on public.courier_zones;
create policy "courier_zones_staff_read" on public.courier_zones
  for select using (public.is_staff());

drop policy if exists "courier_zones_staff_write" on public.courier_zones;
create policy "courier_zones_staff_write" on public.courier_zones
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "courier_zones_propias" on public.courier_zones;
create policy "courier_zones_propias" on public.courier_zones
  for select using (courier_id = public.current_courier_id());

-- --- 6. Los envíos que lleva encima, y solo esos ----------------------------
-- Se añaden políticas; las del equipo no se tocan. Las permisivas se suman, así
-- que esto amplía lo que ve un motorizado sin quitarle nada a nadie.
drop policy if exists "shipments_courier_read" on public.shipments;
create policy "shipments_courier_read" on public.shipments
  for select using (assigned_to = auth.uid() and public.is_courier());

-- `for update` y no `for all`: un motorizado no crea ni borra envíos. Y el
-- `with check` repite la condición para que no pueda soltarle el envío a otro
-- en la misma operación que lo actualiza.
drop policy if exists "shipments_courier_update" on public.shipments;
create policy "shipments_courier_update" on public.shipments
  for update
  using (assigned_to = auth.uid() and public.is_courier())
  with check (assigned_to = auth.uid() and public.is_courier());

-- --- 7. Permisos de tabla ---------------------------------------------------
-- Explícitos aunque los `default privileges` de la 0022 ya los den: que se lea
-- aquí qué toca cada rol. `anon` fuera, como siempre.
grant select, insert, update, delete on public.couriers to authenticated;
grant select, insert, update, delete on public.courier_zones to authenticated;
