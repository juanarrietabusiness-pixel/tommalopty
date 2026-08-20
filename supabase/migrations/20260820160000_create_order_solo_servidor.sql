-- =============================================================================
-- 0014 · `create_order` deja de ser invocable desde el navegador
-- =============================================================================
-- PROBLEMA
--
-- La migración 0011 cierra la función así:
--
--   revoke all on function public.create_order from anon, authenticated;
--
-- y no surte efecto. A diferencia de las tablas, Postgres concede `EXECUTE` a
-- `PUBLIC` por defecto al crear una función, y ese grant sobrevive a un revoke
-- dirigido a roles concretos: `anon` y `authenticated` siguen pudiendo
-- ejecutarla porque lo heredan de `PUBLIC`. En el ACL real se ve como `=X`:
--
--   create_order → {=X/postgres, postgres=X/postgres}
--                   ^^^ esto es PUBLIC, y el revoke nunca lo tocó
--
-- Como PostgREST expone las funciones de `public` en /rest/v1/rpc/, cualquiera
-- con la anon key —que es pública por diseño, viaja en el bundle— podía crear
-- pedidos saltándose el Route Handler.
--
-- Los importes nunca estuvieron en riesgo: `create_order` recalcula precios
-- desde el catálogo y no acepta totales del cliente. Lo que sí permitía:
--
--   · reservar stock sin límite ni autenticación, de forma scriptable
--   · crear y modificar fichas de `customers` por email, saltándose RLS
--     (la función es SECURITY DEFINER)
--   · quemar códigos de descuento incrementando `usage_count`
--   · dejar pedidos fantasma en el panel, sin fila en `payments`
--
-- SOLUCIÓN
--
-- Revocar de `public`, que es de donde venía el permiso de verdad. Se nombran
-- también `anon` y `authenticated` para que quede explícito en el ACL y para
-- que un `grant` futuro a esos roles no pase inadvertido en una revisión.
--
-- La firma va completa a propósito: si algún día se añade una sobrecarga de
-- `create_order`, un revoke sin tipos fallaría por ambigüedad en vez de
-- revocar la que no toca.
--
-- Sin guardia de rol dentro de la función: el permiso es la barrera correcta
-- aquí, y una comprobación interna mal calibrada rompería el checkout de
-- invitado, que llama con service_role y sin sesión de usuario.
--
-- El test de RLS que acompaña a esta migración falla sin ella. Importa que
-- exista: un `create or replace function` futuro vuelve a conceder EXECUTE a
-- PUBLIC en silencio, que es exactamente cómo se llegó hasta aquí.
-- =============================================================================

revoke all on function public.create_order(
  text, jsonb, jsonb, uuid, text, text, text, text, text
) from public, anon, authenticated;

comment on function public.create_order(
  text, jsonb, jsonb, uuid, text, text, text, text, text
) is
  'Crea un pedido de forma atómica: valida catálogo y stock, bloquea inventario, '
  'reserva unidades y registra el canje del cupón. Única vía de creación de pedidos. '
  'Solo service_role: el EXECUTE está revocado de PUBLIC, anon y authenticated. '
  'Si se recrea con `create or replace`, hay que volver a revocar de PUBLIC.';
