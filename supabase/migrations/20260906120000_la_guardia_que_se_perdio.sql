-- Dos funciones que se podían llamar desde fuera
--
-- CÓMO SE ENCONTRARON
--
-- Preguntándole a la base de datos, no leyendo el código: qué funciones de
-- `public` que no sean de disparador puede ejecutar hoy `anon` o
-- `authenticated`. Quince. Trece son a propósito. Dos no.
--
-- Es la misma clase de error que hubo que corregir en los issues #9 y #10, y
-- que esta vez se busca con una consulta en vez de con la vista: **una función
-- nueva nace con `EXECUTE` para `PUBLIC`**, y `revoke ... from anon,
-- authenticated` NO se lo quita, porque el permiso no está concedido a esos
-- roles sino a `PUBLIC`. Ya está escrito en la migración 0021; se volvió a
-- olvidar dos veces.
--
-- --- 1. `dashboard_metrics`: la guardia existía y se perdió ------------------
--
-- La migración 0013 (`harden_access`) le puso una guardia de rol:
--
--     if not public.is_staff() then
--       raise exception 'No autorizado.' using errcode = '42501';
--     end if;
--
-- La migración 0034 (`ingresos_es_el_dinero_que_entro`) la reescribió entera
-- —con `create or replace`, para cambiar los ingresos de `total` a
-- `amount_paid`, que era un cambio de contabilidad sin nada que ver con
-- permisos— y **la guardia desapareció en el camino**. El comentario que esa
-- misma migración dejó puesto sigue diciendo «protegido por la guardia de rol
-- de la app», describiendo la guardia que acababa de borrar.
--
-- Consecuencia, comprobada en staging: cualquiera que se registre como cliente
-- puede llamarla por RPC y leer la facturación de la tienda, el número de
-- pedidos, el ticket medio, los clientes nuevos y el stock bajo.
--
-- No se puede cerrar solo con `revoke`: el panel la llama con la sesión de
-- quien la mira, que es `authenticated` igual que un cliente. El rol no se
-- distingue por privilegio de Postgres, sino dentro de la función. Por eso
-- vuelve la guardia, y por eso vuelve en `plpgsql`.
--
-- --- 2. `limpiar_lead_intentos`: se escribió sin revocar ---------------------
--
-- La migración 0033 puso un límite de altas por IP y, con él, un barrido de los
-- intentos viejos. Al barrido se le olvidó el `revoke` —en la migración cuyo
-- asunto era exactamente ese descuido—, así que hoy lo puede invocar cualquiera
-- sin cuenta.
--
-- No burla el límite: el límite cuenta los intentos de la última hora y el
-- barrido solo borra los de más de dos. Pero es una escritura en la base que
-- puede disparar cualquiera desde fuera, y no hay ninguna razón para que se
-- pueda.
--
-- Y de paso se agenda, que era la mitad que faltaba: la función se escribió
-- «para agendarla con pg_cron» y nunca se agendó, así que `lead_intentos` crece
-- desde entonces guardando algo que solo sirve una hora.

-- --- 1 -----------------------------------------------------------------------
create or replace function public.dashboard_metrics(p_days integer default 30)
returns table (
  revenue numeric,
  orders_count bigint,
  average_order_value numeric,
  new_customers bigint,
  pending_orders bigint,
  low_stock_items bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  -- La guardia va PRIMERO y no depende de los privilegios de Postgres: el panel
  -- la llama con la sesión de quien la mira, y esa sesión es `authenticated`
  -- exactamente igual que la de un cliente de la tienda.
  if not public.is_staff() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  return query
  select
    coalesce((
      select sum(o.amount_paid) from public.orders o
      where o.amount_paid > 0
        and o.placed_at >= now() - make_interval(days => p_days)
    ), 0)::numeric,
    coalesce((
      select count(*) from public.orders o
      where o.placed_at >= now() - make_interval(days => p_days)
    ), 0)::bigint,
    -- El ticket medio sí usa el total: mide cuánto vale un pedido, y eso no
    -- depende de en cuántas veces se pague. (De la migración 0034; se conserva.)
    coalesce((
      select round(avg(o.total), 2) from public.orders o
      where o.amount_paid > 0
        and o.placed_at >= now() - make_interval(days => p_days)
    ), 0)::numeric,
    coalesce((
      select count(*) from public.customers c
      where c.created_at >= now() - make_interval(days => p_days)
    ), 0)::bigint,
    coalesce((
      select count(*) from public.orders o where o.status = 'pending'
    ), 0)::bigint,
    coalesce((select count(*) from public.report_low_stock), 0)::bigint;
end;
$function$;

comment on function public.dashboard_metrics(integer) is
  'KPIs agregados del panel. Los ingresos son el dinero cobrado. SECURITY DEFINER con guardia is_staff() DENTRO de la función: el panel la llama con la sesión de quien mira, que es authenticated igual que un cliente.';

revoke all on function public.dashboard_metrics(integer) from public;
revoke all on function public.dashboard_metrics(integer) from anon;
grant execute on function public.dashboard_metrics(integer) to authenticated;

-- --- 2 -----------------------------------------------------------------------
-- `from public` es el que hace el trabajo; los otros dos están por si algún día
-- alguien concede directamente a esos roles.
revoke all on function public.limpiar_lead_intentos() from public;
revoke all on function public.limpiar_lead_intentos() from anon, authenticated;
grant execute on function public.limpiar_lead_intentos() to service_role;

comment on function public.limpiar_lead_intentos() is
  'Barrido de los intentos de alta viejos. Solo lo llama pg_cron (que corre como superusuario) y el service_role. Nadie de fuera.';
