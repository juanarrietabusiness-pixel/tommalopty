-- =============================================================================
-- 0025 · Los envíos son una entidad propia
-- =============================================================================
-- Fase L2 del plan de logística.
--
-- POR QUÉ NO BASTA CON EL ESTADO DEL PEDIDO
--
-- `orders.status` dice si el pedido está enviado; no dice quién lo lleva, ni por
-- dónde va, ni qué pasó en el intento anterior. Y sobre todo: **un pedido puede
-- tener más de un envío**. Con abonos (fase L3) se despacha parcial, y un pedido
-- grande puede ir en dos viajes. Meter eso en una columna del pedido obliga a
-- elegir cuál de los dos viajes es «el» estado, y esa elección siempre está mal
-- para el otro.
--
-- EL TOKEN, Y POR QUÉ NO ES EL NÚMERO DE GUÍA
--
-- El QR de la guía apunta a `/g/<token>`. Ese token es aleatorio y opaco, igual
-- que el de la confirmación de pedido y por el mismo motivo: los números de guía
-- son legibles y correlativos, así que quien tenga uno puede probar el
-- siguiente. Con un token de 24 bytes no hay siguiente que probar.
--
-- LA DIRECCIÓN VA COPIADA, NO REFERENCIADA
--
-- El envío guarda su propia instantánea de a dónde va. Si mañana el cliente
-- corrige su dirección guardada, el envío que ya salió no puede cambiar de
-- destino a mitad de camino: quien lo lleva tiene un papel impreso con la
-- dirección vieja, y el sistema tiene que coincidir con ese papel.
-- =============================================================================

-- --- 1. La numeración -------------------------------------------------------
-- Secuencia propia y no la del pedido: un pedido con dos envíos tendría dos
-- guías, y compartir la numeración haría que los números saltaran sin motivo
-- aparente para quien los lee en un papel.
create sequence if not exists public.shipment_number_seq;

-- --- 2. La tabla ------------------------------------------------------------
create table if not exists public.shipments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,

  -- Número legible para las personas. El QR no lo usa.
  tracking_number   text not null unique
                    default 'GU-' || lpad(nextval('public.shipment_number_seq')::text, 6, '0'),

  -- Lo que codifica el QR. Opaco y aleatorio a propósito.
  token             text not null unique
                    default encode(extensions.gen_random_bytes(24), 'hex'),

  status            text not null default 'pendiente',

  -- Quién lo lleva. Las dos columnas conviven porque hay dos mundos: el
  -- reparto propio (una persona con cuenta en el panel, fase L4) y el courier
  -- externo (un nombre y un número de guía suyo, fase L5).
  assigned_to       uuid references public.profiles (id) on delete set null,
  carrier           text,
  carrier_tracking_number text,
  carrier_tracking_url    text,

  -- Instantánea del destino. Ver la nota de arriba.
  destination       jsonb not null default '{}'::jsonb,
  latitude          numeric(10, 7),
  longitude         numeric(10, 7),

  -- Prueba de entrega. La foto NO va aquí: va en un bucket privado, y aquí
  -- solo su clave. El bucket público de las imágenes de producto no sirve —
  -- una foto de entrega es la puerta de casa de alguien.
  delivery_proof_key   text,
  delivery_note        text,
  received_by          text,
  failure_reason       text,

  shipping_cost     numeric(10, 2) check (shipping_cost is null or shipping_cost >= 0),

  estimated_at      timestamptz,
  dispatched_at     timestamptz,
  delivered_at      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint shipments_status_valido
    check (status in ('pendiente', 'asignado', 'recogido', 'en_ruta', 'entregado', 'fallido', 'devuelto')),

  -- Las mismas reglas que las direcciones: media coordenada es peor que
  -- ninguna, porque parece un dato.
  constraint shipments_latitude_range
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint shipments_longitude_range
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  constraint shipments_coords_completas
    check ((latitude is null) = (longitude is null))
);

comment on table public.shipments is
  'Envíos de un pedido. Un pedido puede tener varios: despacho parcial o dos viajes.';
comment on column public.shipments.token is
  'Lo que codifica el QR de la guía. Opaco: los números de guía son correlativos y se pueden enumerar.';
comment on column public.shipments.destination is
  'Instantánea del destino. No se referencia la dirección guardada: el envío que ya salió no puede cambiar de destino.';
comment on column public.shipments.delivery_proof_key is
  'Clave del objeto en el bucket PRIVADO. Nunca una URL pública: es la puerta de casa de alguien.';

create index if not exists shipments_order_idx on public.shipments (order_id, created_at desc);
create index if not exists shipments_status_idx on public.shipments (status, created_at desc);
create index if not exists shipments_assigned_idx on public.shipments (assigned_to, status)
  where assigned_to is not null;

drop trigger if exists set_updated_at on public.shipments;
create trigger set_updated_at before update on public.shipments
  for each row execute function public.set_updated_at();

-- --- 3. Que ningún proceso pueda saltarse un paso ---------------------------
-- La máquina de estados está declarada en `@nebula/domain`, y ahí es donde la
-- consultan las pantallas. Pero una máquina de estados que solo vive en la
-- aplicación es una recomendación: cualquier script, cualquier pantalla nueva y
-- cualquier corrección hecha a mano en el panel de Supabase puede ignorarla.
--
-- Aquí se repite. No es duplicar por gusto: es la diferencia entre «la interfaz
-- no te deja» y «no se puede». Y quien va a mover estos estados está en la
-- calle tocando botones con una mano.
create or replace function public.guard_shipment_transition()
returns trigger
language plpgsql
as $$
declare
  permitidos text[];
begin
  if new.status = old.status then
    return new;
  end if;

  permitidos := case old.status
    when 'pendiente' then array['asignado', 'fallido']
    when 'asignado'  then array['recogido', 'pendiente', 'fallido']
    when 'recogido'  then array['en_ruta', 'fallido']
    when 'en_ruta'   then array['entregado', 'fallido']
    -- Un fallido se reintenta o se devuelve. Nunca salta a entregado: si al
    -- final se entregó, hubo un segundo intento y ese intento debe constar.
    when 'fallido'   then array['pendiente', 'devuelto']
    else array[]::text[]
  end;

  if not (new.status = any (permitidos)) then
    raise exception 'Un envío "%" no puede pasar a "%".', old.status, new.status
      using errcode = '23514';
  end if;

  -- Las fechas las pone la base, no quien llama: así no hay dos formas de
  -- marcar lo mismo y la línea de tiempo no depende de que nadie se olvide.
  if new.status in ('recogido', 'en_ruta') and new.dispatched_at is null then
    new.dispatched_at := now();
  end if;

  if new.status = 'entregado' and new.delivered_at is null then
    new.delivered_at := now();
  end if;

  return new;
end;
$$;

comment on function public.guard_shipment_transition() is
  'Repite la máquina de estados de @nebula/domain dentro de Postgres: la de la aplicación es una recomendación, esta no.';

drop trigger if exists guard_shipment_transition on public.shipments;
create trigger guard_shipment_transition
  before update on public.shipments
  for each row execute function public.guard_shipment_transition();

-- --- 4. Cada cambio queda en la bitácora del pedido -------------------------
-- Se escribe en `order_events` y no en una bitácora propia del envío: quien
-- mira un pedido quiere UNA línea de tiempo, no dos que haya que intercalar
-- mentalmente. El `metadata` lleva de qué envío se trata.
create or replace function public.log_shipment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, actor_id, type, message, metadata)
    values (
      new.order_id,
      auth.uid(),
      'shipment_created',
      'Envío ' || new.tracking_number || ' creado.',
      jsonb_build_object('shipment_id', new.id, 'tracking_number', new.tracking_number)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_events (order_id, actor_id, type, message, metadata)
    values (
      new.order_id,
      auth.uid(),
      'shipment_status_changed',
      'Envío ' || new.tracking_number || ': ' || old.status || ' → ' || new.status,
      jsonb_build_object(
        'shipment_id', new.id,
        'tracking_number', new.tracking_number,
        'from', old.status,
        'to', new.status
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.log_shipment_status_change() from public, anon, authenticated;
revoke all on function public.guard_shipment_transition() from public, anon, authenticated;

drop trigger if exists log_shipment_status_change on public.shipments;
create trigger log_shipment_status_change
  after insert or update on public.shipments
  for each row execute function public.log_shipment_status_change();

-- --- 5. Seguridad -----------------------------------------------------------
-- Los envíos son cosa del equipo. Las dos páginas públicas —la del QR y la de
-- seguimiento— no leen esta tabla con el rol público: se sirven desde el
-- servidor con la clave de servicio, filtrando por el token, igual que hace ya
-- la confirmación de pedido. El token ES el permiso, y comprobarlo en el
-- servidor evita tener que abrir la tabla entera a `anon` para que funcione.
alter table public.shipments enable row level security;

drop policy if exists "shipments_staff_read" on public.shipments;
create policy "shipments_staff_read" on public.shipments
  for select using (public.is_staff());

drop policy if exists "shipments_staff_write" on public.shipments;
create policy "shipments_staff_write" on public.shipments
  for all using (public.is_staff()) with check (public.is_staff());

-- Explícitos aunque los `default privileges` de la migración 0022 ya los den:
-- que se lea en la migración qué puede tocar cada rol, sin ir a buscarlo.
-- `anon` se queda fuera a propósito.
grant select, insert, update, delete on public.shipments to authenticated;
grant usage, select on sequence public.shipment_number_seq to authenticated, service_role;
