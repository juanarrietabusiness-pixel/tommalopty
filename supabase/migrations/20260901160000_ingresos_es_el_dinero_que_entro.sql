-- =============================================================================
-- 0028 · Los reportes cuentan el dinero que entró, no el de los pedidos pagados
-- =============================================================================
-- Con abonos, «ingresos» deja de ser obvio y hay que elegir.
--
-- EL PROBLEMA
--
-- Hasta ahora los reportes sumaban `orders.total` de los pedidos con estado
-- `paid`. Con abonos aparece un tercer caso que esa fórmula no sabe contar: un
-- pedido de 300 con 200 cobrados. No es `paid`, así que suma cero — y sin
-- embargo hay 200 dólares en la caja. El panel enseñaría un día de ventas más
-- pobre de lo que fue, y justo los días de ticket alto, que son los que se
-- pagan a plazos.
--
-- La alternativa —contar los 300 completos— es peor: sería contar dinero que
-- todavía no está.
--
-- LA DECISIÓN
--
-- Ingresos = **lo cobrado**, `orders.amount_paid`.
--
-- Y no cambia nada de lo que ya se veía, que es lo que la hace segura:
--
--   * Pedido pagado del todo: `amount_paid` es igual al total. Mismo número.
--   * Pedido parcialmente pagado: antes cero, ahora lo cobrado. Corrige.
--   * Pedido sin pagar: cero en los dos casos.
--
-- El filtro pasa de «estado pagado» a «entró dinero», que además es más honesto
-- de leer: un pedido aparece en el reporte del día en que se cobró algo.
--
-- QUÉ SIGUE SIN RESOLVER
--
-- El ticket medio y `report_top_products` siguen usando el total del pedido, y
-- es lo correcto para lo que miden: cuánto vale un pedido y qué productos se
-- venden no depende de en cuántas veces se pague. Se deja anotado para que
-- nadie lo «arregle» sin querer.
-- =============================================================================

create or replace view public.report_sales_daily
with (security_invoker = on) as
select
  date_trunc('day', o.placed_at)::date as day,
  count(*)                             as orders_count,
  sum(o.amount_paid)                   as revenue,
  sum(o.discount_total)                as discounts,
  sum(o.shipping_total)                as shipping,
  round(avg(o.total), 2)               as average_order_value
from public.orders o
where o.placed_at is not null
  and o.amount_paid > 0
group by 1
order by 1 desc;

comment on view public.report_sales_daily is
  'Ventas por día. Los ingresos son el dinero cobrado (amount_paid), no el total de los pedidos pagados: con abonos no es lo mismo.';

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
      select sum(o.amount_paid) from public.orders o
      where o.amount_paid > 0
        and o.placed_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((
      select count(*) from public.orders o
      where o.placed_at >= now() - make_interval(days => p_days)
    ), 0),
    -- El ticket medio sí usa el total: mide cuánto vale un pedido, y eso no
    -- depende de en cuántas veces se pague.
    coalesce((
      select round(avg(o.total), 2) from public.orders o
      where o.amount_paid > 0
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
  'KPIs agregados del panel. Los ingresos son el dinero cobrado. SECURITY DEFINER: protegido por la guardia de rol de la app.';

revoke all on function public.dashboard_metrics(integer) from public, anon;
grant execute on function public.dashboard_metrics(integer) to authenticated;

-- `report_top_products` no cambia a propósito: mide qué se vende, no cuánto se
-- ha cobrado. Se le amplía el filtro para que un pedido a plazos también cuente
-- desde el primer abono, que es cuando la venta ya ocurrió.
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
where o.amount_paid > 0
group by oi.product_id, coalesce(p.title, oi.product_title), p.slug
order by units_sold desc;
