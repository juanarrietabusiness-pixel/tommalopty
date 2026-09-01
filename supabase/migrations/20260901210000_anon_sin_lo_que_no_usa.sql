-- =============================================================================
-- 0033 · `anon` se queda solo con lo que la tienda usa de verdad
-- =============================================================================
-- Cierra el issue #24.
--
-- QUÉ SE ENCONTRÓ, MIRANDO LA BASE Y NO EL SQL
--
-- Toda tabla de `public` nace con privilegios para `anon` que nadie escribió.
-- En este proyecto vienen de dos sitios distintos, y conviene no confundirlos
-- porque se arreglan distinto:
--
--   1. **Los privilegios por omisión.** `pg_default_acl` da a `anon`, para cada
--      tabla nueva creada por `postgres`: `TRUNCATE`, `REFERENCES`, `TRIGGER` y
--      `MAINTAIN`. Por eso `shipments` los tenía sin que ninguna migración se
--      los diera. Se corrige cambiando el propio `alter default privileges`.
--
--   2. **Una concesión explícita antigua** (`grant select, insert on all tables`
--      de la 0011), que alcanzó a todas las tablas que existían entonces. Por eso
--      `orders`, `payments` o `customers` tienen `SELECT` e `INSERT` para el
--      público. Se corrige tabla por tabla, aquí abajo.
--
-- CUÁNTO IMPORTA, SIN DRAMATIZAR
--
-- Con RLS bien puesta, `select`, `insert`, `update` y `delete` no devuelven ni
-- tocan nada: lo para la política. **`truncate` es la excepción**, y es la que
-- justifica esta migración: no está sujeto a políticas de fila, así que el
-- privilegio es lo único que separa a un visitante anónimo de vaciar una tabla.
-- Hoy no se llega desde la API —PostgREST no emite `truncate`— pero eso es una
-- propiedad de la capa de arriba, no de la base, y no es donde debe vivir esa
-- garantía.
--
-- POR QUÉ ESTO NO ES UN BUCLE, Y NO DEBE SERLO
--
-- Un `revoke all from anon` sobre todas las tablas deja la tienda sin catálogo.
-- Ya pasó, y duró once días (`docs/ESTADO.md` § 4). Así que cada tabla aparece
-- escrita con su nombre y en el grupo que le toca, y **lo que se conserva se
-- vuelve a conceder en la línea siguiente**, para que se lea de un vistazo qué
-- alcanza el público sin ir a buscarlo a otra migración.
--
-- La lista de lo que la tienda lee no es una suposición: es
-- `CONSULTAS_DE_LA_TIENDA` en `packages/db/src/__tests__/permisos.test.ts`, que
-- ejecuta cada consulta como `anon` contra un Postgres de verdad.
-- =============================================================================

-- --- 1. Que las futuras nazcan limpias --------------------------------------
-- Esto es lo que impide que la próxima tabla repita la historia. Solo cubre las
-- creadas por `postgres`, que es quien ejecuta las migraciones; el arranque de
-- Supabase declara además los suyos como `supabase_admin`, y esos no se pueden
-- cambiar desde aquí. Por eso las migraciones siguientes deben seguir revocando
-- explícitamente, y hay un test que lo comprueba.
alter default privileges in schema public revoke all on tables from anon;

-- --- 2. Lo que la tienda pública SÍ lee --------------------------------------
-- Se revoca todo y se devuelve `select` en la misma línea. Sin esto no hay
-- catálogo, ni páginas, ni zonas de reparto en el checkout.
revoke all on public.products          from anon;  grant select on public.products          to anon;
revoke all on public.product_images    from anon;  grant select on public.product_images    to anon;
revoke all on public.product_options   from anon;  grant select on public.product_options   to anon;
revoke all on public.product_categories from anon; grant select on public.product_categories to anon;
revoke all on public.categories        from anon;  grant select on public.categories        to anon;
revoke all on public.reviews           from anon;  grant select on public.reviews           to anon;
revoke all on public.settings          from anon;  grant select on public.settings          to anon;
revoke all on public.shipping_methods  from anon;  grant select on public.shipping_methods  to anon;
revoke all on public.delivery_zones    from anon;  grant select on public.delivery_zones    to anon;
revoke all on public.cms_pages         from anon;  grant select on public.cms_pages         to anon;
revoke all on public.cms_posts         from anon;  grant select on public.cms_posts         to anon;
revoke all on public.cms_banners       from anon;  grant select on public.cms_banners       to anon;
revoke all on public.cms_menus         from anon;  grant select on public.cms_menus         to anon;

-- --- 3. Las dos tablas que se leen por columnas ------------------------------
-- `cost_price` (el margen), `location` y `low_stock_threshold` se quedan fuera a
-- propósito, y hay tests que lo fijan. Se vuelven a conceder columna por columna
-- porque el permiso de columna y el de tabla son dos entradas distintas, y
-- escribirlas aquí evita depender de cuál de las dos sobrevive a un `revoke`.
revoke all on public.product_variants from anon;
grant select (
  id, product_id, sku, barcode, title, option_values, price, compare_at_price,
  image_url, weight_grams, position, is_default, is_active, created_at, updated_at
) on public.product_variants to anon;

revoke all on public.inventory from anon;
grant select (variant_id, quantity, reserved_quantity, track_inventory)
  on public.inventory to anon;

-- --- 4. La única tabla en la que el público escribe --------------------------
-- La política `leads_public_insert` existe para el formulario de contacto. Leer
-- los leads es del equipo.
revoke all on public.leads from anon;  grant insert on public.leads to anon;

-- --- 5. Todo lo demás: nada ---------------------------------------------------
-- Ninguna pantalla pública toca estas tablas. Las páginas que enseñan un pedido
-- sin sesión —la confirmación, el seguimiento y la del QR— se sirven desde el
-- servidor con la clave de servicio y filtrando por token, que es otro rol y
-- otros permisos. Verificado: todos los caminos de escritura de la tienda usan
-- `getSupabaseServiceClient()`.
revoke all on public.orders                 from anon;
revoke all on public.order_items            from anon;
revoke all on public.order_events           from anon;
revoke all on public.payments               from anon;
revoke all on public.payment_webhook_events from anon;
revoke all on public.shipments              from anon;
revoke all on public.customers              from anon;
revoke all on public.addresses              from anon;
revoke all on public.profiles               from anon;
revoke all on public.carts                  from anon;
revoke all on public.cart_items             from anon;
revoke all on public.wishlists              from anon;
revoke all on public.wishlist_items         from anon;
revoke all on public.discounts              from anon;
revoke all on public.discount_redemptions   from anon;
revoke all on public.crm_notes              from anon;
revoke all on public.crm_tags               from anon;
revoke all on public.campaigns              from anon;
revoke all on public.integrations           from anon;
revoke all on public.audit_log              from anon;

-- `couriers` y `courier_zones` ya lo revocan en la 0031, y `admin_bootstrap` en
-- la 0023. Se repiten aquí para que esta migración se pueda leer como el
-- inventario completo de lo que alcanza el público, sin excepciones que haya que
-- ir a buscar a otro archivo.
revoke all on public.couriers      from anon;
revoke all on public.courier_zones from anon;
revoke all on public.admin_bootstrap from anon;
