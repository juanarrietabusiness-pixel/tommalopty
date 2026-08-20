-- =============================================================================
-- 0015 · Caducidad de las reservas de stock
-- =============================================================================
-- PROBLEMA
--
-- `create_order` reserva inventario al crear el pedido, y esa reserva solo se
-- libera cuando el pedido pasa a `cancelled`, `refunded` o `fulfilled`. Un
-- pedido que nadie paga se queda en `pending` para siempre, reteniendo stock
-- indefinidamente.
--
-- El efecto en producción no es de seguridad, es comercial: el catálogo se va
-- marcando "agotado" solo, sin que nadie haya comprado nada. Y como
-- `/api/checkout` acepta invitados sin límite de tasa, cualquiera puede vaciar
-- el catálogo entero con un bucle.
--
-- SOLUCIÓN
--
-- Una función que cancela los pedidos `pending` que llevan demasiado tiempo sin
-- pagarse. No toca el inventario a mano: al cambiar el estado se dispara
-- `on_order_inventory_change`, que ya sabe liberar la reserva, y
-- `log_order_status_change`, que deja constancia en la bitácora del pedido. La
-- lógica de inventario sigue viviendo en un solo sitio.
--
-- Se devuelve además el uso del cupón. Un pedido caducado nunca se cobró, así
-- que su canje no debe seguir contando contra el límite del código: si no, un
-- cupón de un solo uso se quema con un carrito abandonado. Esto es específico
-- de la caducidad automática; la cancelación manual desde el panel mantiene el
-- canje, porque ahí sí hubo una decisión humana sobre un pedido real.
-- =============================================================================

create or replace function public.caducar_reservas_de_pedidos(p_horas integer default 2)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids   uuid[];
  v_total integer;
begin
  if p_horas is null or p_horas < 1 then
    raise exception 'El plazo de caducidad debe ser de al menos una hora.'
      using errcode = 'P0006';
  end if;

  -- La cancelación y la selección van en la MISMA sentencia a propósito. Hacer
  -- primero un `select` de candidatos y después el `update` deja una ventana en
  -- la que el webhook de la pasarela puede marcar el pedido como pagado: se
  -- cancelaría un pedido cobrado.
  with expirados as (
    update public.orders
    set status           = 'cancelled',
        cancelled_reason = format('Reserva caducada: %s h sin confirmar el pago', p_horas)
    where status = 'pending'
      and payment_status = 'pending'
      and created_at < now() - make_interval(hours => p_horas)
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from expirados;

  v_total := coalesce(array_length(v_ids, 1), 0);

  if v_total = 0 then
    return 0;
  end if;

  -- Devolver los usos del cupón antes de borrar los canjes, que son de donde
  -- sale la cuenta.
  update public.discounts d
  set usage_count = greatest(d.usage_count - x.usos, 0)
  from (
    select r.discount_id, count(*)::int as usos
    from public.discount_redemptions r
    where r.order_id = any(v_ids)
    group by r.discount_id
  ) x
  where d.id = x.discount_id;

  delete from public.discount_redemptions where order_id = any(v_ids);

  return v_total;
end;
$$;

comment on function public.caducar_reservas_de_pedidos is
  'Cancela los pedidos pendientes de pago más antiguos que el plazo dado, liberando su reserva de inventario y devolviendo el uso del cupón. Devuelve cuántos caducó.';

-- Misma lección que con `create_order`, y hacen falta las dos mitades:
--
--  * `public`, porque Postgres concede EXECUTE a PUBLIC al crear cualquier
--    función y ese grant sobrevive a un revoke dirigido a roles concretos.
--  * `anon` y `authenticated`, porque Supabase declara ALTER DEFAULT PRIVILEGES
--    sobre `public` a favor de esos roles: la concesión que reciben es propia y
--    explícita, así que revocar solo de PUBLIC la dejaría intacta.
--
-- Quitar cualquiera de las dos deja la función invocable desde el navegador por
-- /rest/v1/rpc/. El test `no es invocable desde el navegador` lo comprueba.
revoke all on function public.caducar_reservas_de_pedidos(integer)
  from public, anon, authenticated;

-- Y se concede explícitamente a quien sí debe ejecutarla, sin depender de que
-- el revoke anterior haya respetado la concesión por defecto.
grant execute on function public.caducar_reservas_de_pedidos(integer) to service_role;

-- --- Cómo se agenda -----------------------------------------------------------
-- La migración NO agenda nada. `pg_cron` necesita estar en
-- `shared_preload_libraries`, cosa que no se puede garantizar desde una
-- migración: intentar crearlo aquí rompería `supabase db reset` en cualquier
-- entorno que no lo tenga precargado, incluida la CI.
--
-- La activación es un paso único por entorno, documentado en docs/RUNBOOK.md.
-- En el SQL Editor de Supabase:
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'caducar-reservas',
--     '*/15 * * * *',
--     $cron$select public.caducar_reservas_de_pedidos(2)$cron$
--   );
--
-- El plazo de 2 horas es lo habitual en e-commerce con pago con tarjeta. Si se
-- conecta un método de pago manual (transferencia, ACH), hay que subirlo: se
-- cambia el argumento, no la función.
