-- =============================================================================
-- 0034 · Las dos guardias de envíos fijan su `search_path`
-- =============================================================================
-- Lo encontró el linter de Supabase (`function_search_path_mutable`) al pasarlo
-- sobre la base ya aplicada, que es justo lo que la revisión de código no ve.
--
-- QUÉ PASABA
--
-- `guard_shipment_transition` y `guard_courier_shipment_update` se escribieron
-- sin `set search_path`. Las demás funciones del esquema sí lo llevan —
-- `log_shipment_status_change`, `is_staff`, `current_courier_id`— así que esto
-- era un olvido y no una decisión.
--
-- POR QUÉ IMPORTA EN UNA FUNCIÓN DE DISPARADOR
--
-- Sin `search_path` fijo, los nombres sin cualificar se resuelven con el que
-- traiga quien ejecuta la operación. Las dos son `security invoker`, así que
-- nadie gana permisos que no tuviera; lo que se gana es **elegir qué función se
-- llama**. Estas dos guardias son exactamente lo que decide si un motorizado
-- puede reasignarse un envío, y una guardia cuyo comportamiento depende de una
-- variable de sesión de quien la dispara no es una guardia.
--
-- Hoy los dos cuerpos ya cualifican todo lo que llaman (`public.is_staff()`,
-- `public.is_courier()`), así que fijarlo no cambia ningún comportamiento: cierra
-- la puerta por la que entraría el día que alguien añada una llamada sin
-- cualificar, que es cuando ya nadie se acuerda de esta propiedad.
--
-- Se usa `set search_path = public` y no `= ''` para seguir la forma que ya
-- tiene el resto del esquema. Los cuerpos van íntegros y sin cambios: un
-- `create or replace` no puede modificar solo la cabecera.
-- =============================================================================

create or replace function public.guard_shipment_transition()
returns trigger
language plpgsql
set search_path = public
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

create or replace function public.guard_courier_shipment_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- El equipo puede tocarlo todo: esta guardia existe solo para los motorizados.
  if public.is_staff() then
    return new;
  end if;

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
     or new.dispatched_at        is distinct from old.dispatched_at
     or new.delivered_at         is distinct from old.delivered_at
  then
    raise exception
      'Un motorizado solo puede cambiar el estado y la prueba de entrega de su envío.'
      using errcode = '42501';
  end if;

  -- Asignar y devolver son decisiones de quien despacha, no de quien reparte.
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

revoke all on function public.guard_shipment_transition() from public, anon, authenticated;
revoke all on function public.guard_courier_shipment_update() from public, anon, authenticated;
