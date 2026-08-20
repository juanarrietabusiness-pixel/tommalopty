-- =============================================================================
-- 0008 · Vistas de lectura, búsqueda y reportes
-- =============================================================================
-- Todas las vistas usan `security_invoker` para que RLS se evalúe con el rol de
-- quien consulta, no con el del propietario de la vista.
-- =============================================================================

-- --- Vista de catálogo para el storefront ------------------------------------
-- Aplana producto + variante por defecto + imagen principal + stock, que es
-- exactamente lo que consume el grid de productos.
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
  select pv.* from public.product_variants pv
  where pv.product_id = p.id and pv.is_active
  order by pv.is_default desc, pv.position asc
  limit 1
) v on true
left join lateral (
  select pi.* from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.position asc
  limit 1
) img on true
left join public.inventory inv on inv.variant_id = v.id;

comment on view public.product_catalog is
  'Vista plana producto+variante por defecto+imagen+stock. Fuente del grid del storefront.';

-- --- Búsqueda full-text -------------------------------------------------------
create or replace function public.search_products(
  p_query text,
  p_limit integer default 24,
  p_offset integer default 0
)
returns setof public.product_catalog
language sql
stable
set search_path = public
as $$
  select c.*
  from public.product_catalog c
  join public.products p on p.id = c.id
  where c.status = 'active'
    and (
      p_query is null
      or p_query = ''
      or p.search_vector @@ websearch_to_tsquery('spanish', p_query)
      or p.title ilike '%' || p_query || '%'
    )
  order by
    case
      when p_query is null or p_query = '' then 0
      else ts_rank(p.search_vector, websearch_to_tsquery('spanish', p_query))
    end desc,
    c.is_featured desc,
    c.published_at desc nulls last
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

comment on function public.search_products(text, integer, integer) is
  'Búsqueda del catálogo con ts_rank + fallback ILIKE. Sustituible por Meilisearch.';

-- --- Reportes (panel administrativo) -----------------------------------------
create or replace view public.report_sales_daily
with (security_invoker = on) as
select
  date_trunc('day', o.placed_at)::date as day,
  count(*)                             as orders_count,
  sum(o.total)                         as revenue,
  sum(o.discount_total)                as discounts,
  sum(o.shipping_total)                as shipping,
  round(avg(o.total), 2)               as average_order_value
from public.orders o
where o.placed_at is not null
  and o.payment_status in ('paid', 'partially_refunded')
group by 1
order by 1 desc;

create or replace view public.report_top_products
with (security_invoker = on) as
select
  oi.product_id,
  coalesce(p.title, oi.product_title) as title,
  p.slug,
  sum(oi.quantity)                    as units_sold,
  sum(oi.total)                       as revenue,
  count(distinct oi.order_id)         as orders_count
from public.order_items oi
join public.orders o on o.id = oi.order_id
left join public.products p on p.id = oi.product_id
where o.payment_status in ('paid', 'partially_refunded')
group by oi.product_id, coalesce(p.title, oi.product_title), p.slug
order by units_sold desc;

create or replace view public.report_low_stock
with (security_invoker = on) as
select
  v.id            as variant_id,
  v.product_id,
  p.title         as product_title,
  v.title         as variant_title,
  v.sku,
  i.quantity,
  i.reserved_quantity,
  i.low_stock_threshold,
  greatest(i.quantity - i.reserved_quantity, 0) as available_quantity
from public.inventory i
join public.product_variants v on v.id = i.variant_id
join public.products p on p.id = v.product_id
where i.track_inventory
  and (i.quantity - i.reserved_quantity) <= i.low_stock_threshold
order by available_quantity asc;

-- Embudo de conversión: carritos creados -> con artículos -> convertidos.
create or replace view public.report_conversion_funnel
with (security_invoker = on) as
select
  date_trunc('day', c.created_at)::date                                     as day,
  count(*)                                                                  as carts_created,
  count(*) filter (where exists (
    select 1 from public.cart_items ci where ci.cart_id = c.id
  ))                                                                        as carts_with_items,
  count(*) filter (where c.status = 'converted')                            as carts_converted,
  count(*) filter (where c.status = 'abandoned')                            as carts_abandoned
from public.carts c
group by 1
order by 1 desc;

-- --- KPIs del dashboard -------------------------------------------------------
create or replace function public.dashboard_metrics(p_days integer default 30)
returns table (
  revenue numeric,
  orders_count bigint,
  average_order_value numeric,
  new_customers bigint,
  pending_orders bigint,
  low_stock_items bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select sum(o.total) from public.orders o
      where o.payment_status in ('paid', 'partially_refunded')
        and o.placed_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((
      select count(*) from public.orders o
      where o.placed_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((
      select round(avg(o.total), 2) from public.orders o
      where o.payment_status in ('paid', 'partially_refunded')
        and o.placed_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((
      select count(*) from public.customers c
      where c.created_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((
      select count(*) from public.orders o where o.status = 'pending'
    ), 0),
    coalesce((select count(*) from public.report_low_stock), 0);
$$;

comment on function public.dashboard_metrics(integer) is
  'KPIs agregados del panel. SECURITY DEFINER: protegido por la guardia de rol de la app.';

revoke all on function public.dashboard_metrics(integer) from anon;
