-- =============================================================================
-- 0022 · Los permisos de tabla que faltaban
-- =============================================================================
-- Tres agujeros de permisos que solo aparecieron al conectar las aplicaciones a
-- una base de datos real. Ninguno se ve en local con la clave de servicio, y
-- ninguno lo detecta un test con mocks: son decisiones de Postgres.
--
-- Los tres tienen la misma raíz. La migración 0011 concedió privilegios «on all
-- tables in schema public», que en Postgres significa *sobre las tablas que
-- existían en ese momento*, no sobre las futuras. Y `service_role` nunca
-- apareció en aquella lista.
-- =============================================================================

-- --- 1. `service_role` no podía tocar ninguna tabla --------------------------
-- El rol con el que el servidor confirma pedidos tenía exactamente cero
-- privilegios de lectura y escritura en `public`. Lo que salvaba al checkout es
-- que `create_order` es `security definer` y corre como su dueño; en cuanto la
-- misma petición intentaba registrar el pago o releer las líneas para el correo,
-- Postgres respondía «permission denied» y el pedido quedaba a medias.
--
-- `service_role` solo se usa desde servidor, con la clave secreta, y salta RLS
-- por diseño. Que no tuviera privilegios de tabla no era una protección: era un
-- fallo silencioso.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- --- 2. El catálogo público era ilegible --------------------------------------
-- La migración 0014 revocó `inventory.reserved_quantity` de `anon` para no
-- publicar el nivel de reservas. La intención era buena; el efecto, que la
-- tienda entera dejara de cargar:
--
--   * `product_catalog` se declara `security_invoker = on` y calcula
--     `available_quantity` leyendo `reserved_quantity`. Al evaluarse con los
--     permisos de quien consulta, la vista pasó a fallar para todo el mundo.
--   * `listProducts` y `getProductBySlug` leen la columna directamente por el
--     mismo motivo: necesitan restar las reservas.
--
-- Portada, tienda y ficha de producto respondían «permission denied for table
-- inventory». Estuvo así desde el 20 de agosto y no se vio hasta el primer
-- despliegue con base real, que es justamente para lo que existe staging.
--
-- Y hay un motivo de fondo para deshacerlo en vez de reescribir las consultas:
-- **la columna nunca estuvo protegida**. `quantity` sí se concedía, y
-- `available_quantity` se publica en la vista. Con esos dos, cualquiera obtiene
-- las reservas restando. Se estaba pagando el precio de una protección
-- inexistente.
--
-- Lo que sí queda revocado, porque no es derivable y sí es operación interna:
-- `low_stock_threshold`, `allow_backorder`, `location` y `updated_at`.
grant select (reserved_quantity) on public.inventory to anon, authenticated;

-- (`product_variants.cost_price` sigue revocada: el margen no se deduce de nada
-- de lo que la tienda publica, así que ahí la revocación sí protege.)

-- --- 3. `delivery_zones` no tenía privilegios ---------------------------------
-- La tabla se creó en la migración 0021, después del `grant on all tables`, así
-- que nació con sus políticas RLS bien puestas y sin un solo privilegio: el
-- checkout no habría podido preguntar si reparte en una dirección.
grant select on public.delivery_zones to anon, authenticated;
grant insert, update, delete on public.delivery_zones to authenticated;

-- --- 4. Que no vuelva a pasar con la siguiente tabla --------------------------
-- `alter default privileges` sí alcanza a lo que aún no existe. Se declara para
-- `authenticated` y `service_role`, que son contextos ya autenticados donde RLS
-- es la barrera real.
--
-- `anon` se deja fuera a propósito. Hoy tiene `select, insert` sobre todo por la
-- concesión de 0011, y ahí se queda: una tabla nueva no debería quedar expuesta
-- al público por omisión, sino porque alguien lo escribió.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

-- --- 5. La vista del catálogo pedía columnas que no necesita ------------------
-- Con `inventory` arreglado, `product_catalog` seguía fallando: los `left join
-- lateral` hacen `select pv.*` y `select pi.*`, y ese asterisco arrastra
-- `product_variants.cost_price`, que sí está revocada con razón.
--
-- Un `select *` dentro de una vista `security_invoker` convierte cualquier
-- permiso por columna en un permiso por tabla: basta una columna prohibida en
-- cualquier punto del árbol para que la consulta entera se caiga. Se enumeran
-- las columnas que la vista usa de verdad, que además es lo que debería haber
-- puesto desde el principio.
create or replace view public.product_catalog
with (security_invoker = on) as
select
  p.id,
  p.slug,
  p.title,
  p.subtitle,
  p.brand,
  p.status,
  p.is_featured,
  p.tags,
  p.rating_average,
  p.rating_count,
  p.published_at,
  v.id                as default_variant_id,
  v.sku,
  v.price,
  v.compare_at_price,
  img.url             as image_url,
  img.alt             as image_alt,
  (v.compare_at_price is not null and v.compare_at_price > v.price) as on_sale,
  case
    when v.compare_at_price is not null and v.compare_at_price > 0
      then round((1 - (v.price / v.compare_at_price)) * 100)::int
    else 0
  end                 as discount_percent,
  greatest(coalesce(inv.quantity, 0) - coalesce(inv.reserved_quantity, 0), 0) as available_quantity,
  coalesce(inv.track_inventory, false) as track_inventory
from public.products p
left join lateral (
  select pv.id, pv.sku, pv.price, pv.compare_at_price
  from public.product_variants pv
  where pv.product_id = p.id and pv.is_active
  order by pv.is_default desc, pv.position asc
  limit 1
) v on true
left join lateral (
  select pi.url, pi.alt
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.position asc
  limit 1
) img on true
left join public.inventory inv on inv.variant_id = v.id;

comment on view public.product_catalog is
  'Vista plana producto+variante por defecto+imagen+stock. Fuente del grid del storefront.';

grant select on public.product_catalog to anon, authenticated;
