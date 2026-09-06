-- Anular un envío creado por error (issue #54)
--
-- EL PROBLEMA
--
-- Se despacha un pedido equivocado, o se crea el envío dos veces. Hasta ahora
-- no había marcha atrás: los siete estados servían para contar lo que le pasa a
-- un paquete que existe, y ninguno servía para decir «este envío no debió
-- existir». La única salida era marcarlo «fallido» y luego «devuelto», que
-- deja en la bitácora del pedido un intento de entrega que nunca ocurrió y una
-- devolución que nadie hizo. El histórico acababa contando una entrega fallida
-- de un paquete que jamás salió del almacén.
--
-- LA DECISIÓN, Y POR QUÉ ES ESTA
--
-- `anulado` solo se alcanza desde `pendiente`, y es terminal.
--
-- Desde `pendiente` porque ahí el envío todavía no es nada: no tiene motorizado
-- asignado, no ha salido, nadie lo espera. En cuanto está `asignado` ya hay una
-- persona con una tarea, y desde `recogido` hay un paquete físico en la calle;
-- para eso están `fallido` y `devuelto`, que es lo que de verdad pasó.
--
-- Terminal porque un envío anulado no se resucita. Si el pedido vuelve a
-- despacharse, es un envío nuevo, con su guía y su número: reabrir el anterior
-- reescribiría la historia de un papel que ya se tiró.
--
-- Y no se borra la fila, por lo mismo que no se borran los pedidos: el número
-- de guía ya pudo imprimirse, y una guía impresa que no existe en el sistema es
-- peor que una anulada.
--
-- QUIÉN PUEDE
--
-- El equipo, desde el panel. Los motorizados no: `guard_courier_shipment_update`
-- ya enumera los cuatro estados que pueden marcar (`recogido`, `en_ruta`,
-- `entregado`, `fallido`) y `anulado` no está en esa lista, así que esta
-- migración no necesita tocarla. Es la ventaja de una lista blanca sobre una
-- lista negra.

-- --- 1. El estado nuevo entra en el CHECK -----------------------------------
alter table public.shipments drop constraint if exists shipments_status_valido;
alter table public.shipments add constraint shipments_status_valido
  check (status in (
    'pendiente', 'asignado', 'recogido', 'en_ruta', 'entregado', 'fallido', 'devuelto', 'anulado'
  ));

-- --- 2. Y en la máquina de estados de la base -------------------------------
-- Se repite entera, no se parchea: la función completa aquí es lo que se lee
-- cuando alguien pregunta qué transiciones existen hoy.
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
    -- Anular solo desde aquí: es el único estado en el que el envío todavía no
    -- es nada. Ver la cabecera de esta migración.
    when 'pendiente' then array['asignado', 'fallido', 'anulado']
    when 'asignado'  then array['recogido', 'pendiente', 'fallido']
    when 'recogido'  then array['en_ruta', 'fallido']
    when 'en_ruta'   then array['entregado', 'fallido']
    -- Un fallido se reintenta o se devuelve. Nunca salta a entregado: si al
    -- final se entregó, hubo un segundo intento y ese intento debe constar.
    when 'fallido'   then array['pendiente', 'devuelto']
    -- Terminales: 'entregado', 'devuelto' y 'anulado'.
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
  'Repite la máquina de estados de @nebula/domain dentro de Postgres: la de la aplicación es una recomendación, esta no. Incluye "anulado", alcanzable solo desde "pendiente" y terminal (issue #54).';

-- La función se reemplaza, no se crea: `create or replace` conserva los
-- privilegios que ya tenía, y el `revoke` de la migración 0028 sigue en pie. Se
-- repite igualmente, porque depender de eso es depender de un detalle.
revoke all on function public.guard_shipment_transition() from public, anon, authenticated;
