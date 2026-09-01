-- =============================================================================
-- 0026 · El estado de pago «parcialmente pagado»
-- =============================================================================
-- Va en su propia migración, y no junto al resto de la fase L3, por una regla
-- de Postgres: un valor nuevo de un `enum` **no se puede usar en la misma
-- transacción que lo añade**. Si esto viviera en el mismo archivo que el
-- disparador que lo asigna, la migración fallaría al aplicarse sobre una base
-- limpia y funcionaría sobre una que ya lo tuviera — el peor de los dos mundos,
-- porque el fallo solo aparecería al reconstruir el esquema desde cero.
--
-- Se coloca después de `authorized` para que el orden del enum siga el recorrido
-- real del dinero: pendiente → autorizado → parcial → pagado.
-- =============================================================================

alter type public.payment_status add value if not exists 'partially_paid' after 'authorized';
