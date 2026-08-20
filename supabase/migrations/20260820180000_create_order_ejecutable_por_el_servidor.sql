-- =============================================================================
-- 0016 · `create_order` vuelve a ser ejecutable por el servidor
-- =============================================================================
-- REGRESIÓN DE PRODUCCIÓN. El checkout no podía crear ni un solo pedido.
--
-- La migración 0014 cerró un agujero real —`create_order` era invocable desde el
-- navegador— con:
--
--   revoke all on function public.create_order(...) from public, anon, authenticated;
--
-- El revoke era correcto y sigue siéndolo. Lo que faltaba es la otra mitad: la
-- función la crea `postgres`, así que tras revocar de PUBLIC el único que
-- conserva EXECUTE es el propietario. `service_role` nunca tuvo una concesión
-- propia, y no hereda la de `postgres`: PostgREST hace `set role service_role`,
-- y a partir de ahí los permisos se comprueban contra ese rol.
--
-- El resultado: `/api/checkout` usa el cliente service-role, y toda llamada a
-- `create_order` respondía 42501 `permission denied`. Cada compra, un 500.
--
-- No se detectó antes porque los tests de la 0014 solo cubrían los caminos
-- malos —que `anon` y `authenticated` reciban 42501— y ninguno comprobaba que
-- el camino bueno siguiera abierto. Un permiso tiene dos lados y hay que probar
-- los dos; verificar solo que la puerta está cerrada no dice si la llave abre.
--
-- La lección general: no dar por hecha una concesión que no está escrita. Si el
-- servidor necesita ejecutar algo, se concede explícitamente.
-- =============================================================================

grant execute on function public.create_order(
  text, jsonb, jsonb, uuid, text, text, text, text, text
) to service_role;

comment on function public.create_order(
  text, jsonb, jsonb, uuid, text, text, text, text, text
) is
  'Crea un pedido de forma atómica: valida catálogo y stock, bloquea inventario, '
  'reserva unidades y registra el canje del cupón. Única vía de creación de pedidos. '
  'EXECUTE revocado de PUBLIC, anon y authenticated; concedido explícitamente a '
  'service_role, que es quien la llama desde el Route Handler del checkout. '
  'Si se recrea con `create or replace`, hay que rehacer AMBAS cosas: el revoke '
  'de PUBLIC y este grant.';
