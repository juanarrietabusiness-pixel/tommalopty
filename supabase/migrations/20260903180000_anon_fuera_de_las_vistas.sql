-- =============================================================================
-- 0035 · `anon` fuera de las vistas
-- =============================================================================
-- Cierra el issue #38, encontrado en la auditoría del 3 de septiembre.
--
-- QUÉ SE ESCAPÓ, Y POR QUÉ
--
-- La migración 0033 dejó a `anon` con `SELECT` en las trece tablas que la tienda
-- lee y con `INSERT` en `leads`, y eso está bien. Pero fue **tabla por tabla**,
-- y las cinco vistas de `public` no estaban en la lista. Siguen con lo que les
-- dieron los privilegios por omisión:
--
--     INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE
--
-- sobre `product_catalog`, `report_conversion_funnel`, `report_low_stock`,
-- `report_sales_daily` y `report_top_products`.
--
-- POR QUÉ HOY NO ABRE NADA, Y AUN ASÍ SE ARREGLA
--
-- Las cinco vistas tienen `security_invoker=on`, así que se ejecutan con los
-- privilegios de quien consulta y la RLS de las tablas base sí aplica.
-- Comprobado contra la base real antes de escribir esto:
--
--     set local role anon;
--     select count(*) from public.report_sales_daily;
--     -- ERROR: 42501: permission denied for table orders
--
-- Y `TRUNCATE` sobre una vista no es una operación válida en Postgres.
--
-- Se arregla igual por dos razones. La primera es que la garantía descansa hoy
-- en una sola cosa: el día que alguien cree una vista sin `security_invoker`, o
-- le conceda a `anon` un `SELECT` sobre `orders` por cualquier motivo, los
-- informes de ventas quedan legibles sin sesión. La segunda es que el
-- invariante escrito —«ningún TRUNCATE fuera de `service_role`»— deja de ser
-- cierto, y un invariante que no se cumple es peor que no tenerlo: el siguiente
-- que lo lea confiará en él.
--
-- ESTO TAMPOCO ES UN BUCLE, Y POR LA MISMA RAZÓN
--
-- `product_catalog` **la lee la tienda sin sesión**: es de donde salen el
-- catálogo, la búsqueda y las fichas de producto. Quitarle el `SELECT` a `anon`
-- es exactamente lo que dejó la tienda once días sin catálogo
-- (`docs/ESTADO.md` § 4). Así que va escrita con su nombre, se le revoca todo lo
-- demás, y **el `SELECT` se vuelve a conceder en la línea siguiente** para que
-- se lea de un vistazo qué alcanza el público.
-- =============================================================================

-- --- La que la tienda sí necesita ------------------------------------------
-- Lee el catálogo público sin sesión. Se queda solo con `SELECT`.
revoke all on public.product_catalog from anon;
grant select on public.product_catalog to anon;

-- --- Los cuatro informes del panel -----------------------------------------
-- Son de operación: ventas, más vendidos, stock bajo y embudo. Un visitante
-- anónimo no tiene nada que hacer aquí, ni siquiera leyendo.
revoke all on public.report_conversion_funnel from anon;
revoke all on public.report_low_stock from anon;
revoke all on public.report_sales_daily from anon;
revoke all on public.report_top_products from anon;

-- `authenticated` se deja como está a propósito: quien administra la tienda
-- también es `authenticated`, y lo que distingue a un cliente de la dueña son
-- las políticas RLS de las tablas base, no los privilegios de la vista. Es la
-- lección de `docs/ESTADO.md` § 4 sobre `authenticated`.
