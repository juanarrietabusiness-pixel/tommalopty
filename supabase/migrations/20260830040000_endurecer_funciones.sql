-- =============================================================================
-- 0020 · Cerrar lo que señaló el linter de seguridad de Supabase
-- =============================================================================
-- Ejecutar los avisos de seguridad contra el proyecto de staging sacó dos cosas
-- que la revisión de código no había visto.
--
-- 1. `revoke ... from anon` NO quita el permiso que Postgres da por defecto
--
--    La migración 0013 quiso cerrar `dashboard_metrics` a los visitantes:
--
--      revoke all on function public.dashboard_metrics(integer) from anon;
--
--    No funciona. Postgres concede `EXECUTE` a `PUBLIC` en toda función nueva, y
--    revocárselo a `anon` no toca esa concesión: `anon` la sigue heredando por
--    ser parte de `PUBLIC`. Hay que revocar de `PUBLIC` y luego conceder a quien
--    sí debe.
--
--    No fue explotable —la función se defiende sola con `is_staff()` y responde
--    42501— pero la defensa era una sola, no dos como se creía.
--
-- 2. Las funciones de disparador están expuestas como endpoints RPC
--
--    Toda función del esquema `public` aparece en `/rest/v1/rpc/<nombre>`, y las
--    de disparador no son excepción: `handle_new_user`, `release_order_inventory`
--    o `guard_customer_identity` se pueden invocar desde fuera. Llamarlas suelta
--    un error de Postgres, así que tampoco era explotable, pero son superficie
--    que no tiene por qué existir.
--
--    Se revocan de `PUBLIC` en bloque y por consulta al catálogo, no por lista:
--    así la próxima función de disparador que se añada queda cubierta sin que
--    nadie se acuerde de volver aquí. Se filtran los dos tipos de retorno,
--    `trigger` y `event_trigger`: mirar solo el primero dejaba fuera
--    `rls_auto_enable`, que es un disparador de eventos DDL.
--
--    Revocar `EXECUTE` no afecta a los disparadores. Postgres comprueba ese
--    permiso al CREAR el disparador, no cada vez que se dispara.
--
-- 3. `search_path` mutable en dos funciones
--
--    `build_product_search_vector` es la que importa: es `immutable` y alimenta
--    el índice de búsqueda. Resuelve `to_tsvector('spanish', ...)`, y el nombre
--    de esa configuración de búsqueda se resuelve por `search_path`. Con un
--    `search_path` distinto, la misma fila podría indexarse de otra manera.
--
--    Se usa `alter function ... set search_path` y no `create or replace`: toca
--    solo el ajuste y deja el cuerpo intacto, que es lo prudente con una función
--    de la que cuelga un índice.
-- =============================================================================

-- --- 1. La revocación que no revocaba -----------------------------------------
revoke all on function public.dashboard_metrics(integer) from public;
revoke all on function public.dashboard_metrics(integer) from anon;
grant execute on function public.dashboard_metrics(integer) to authenticated;

-- --- 2. Las funciones de disparador salen de la API REST ----------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      -- `event_trigger` va aparte de `trigger`: `rls_auto_enable` es un
      -- disparador de eventos DDL y se colaba por no devolver `trigger`.
      and p.prorettype in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.firma);
  end loop;
end;
$$;

-- --- 3. `search_path` fijo en las dos que lo tenían suelto --------------------
-- `pg_catalog` va explícito porque de ahí sale la configuración de búsqueda
-- 'spanish' y los operadores de tsvector.
alter function public.build_product_search_vector(text, text, text, text[], text)
  set search_path = pg_catalog, public;

alter function public.set_updated_at()
  set search_path = pg_catalog, public;

-- Las funciones auxiliares de autorización (`is_admin`, `is_staff`,
-- `is_superadmin`, `current_user_role`, `current_customer_id`) se quedan como
-- están a propósito: las políticas RLS las evalúan con los permisos de quien
-- consulta, así que revocarles `EXECUTE` rompería el propio RLS. Lo único que
-- revelan es si quien pregunta es administrador, que ya sabe.
--
-- `validate_discount` también se queda: el checkout de invitado la necesita, y
-- valida un código que quien llama ya conoce.
