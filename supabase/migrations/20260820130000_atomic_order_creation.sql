-- =============================================================================
-- 0011 · Creación de pedidos atómica, con reserva de stock
-- =============================================================================
-- PROBLEMAS QUE CORRIGE (detectados en la auditoría)
--
-- 1. El stock nunca se descontaba ni se reservaba: la última unidad se podía
--    vender infinitas veces y el badge "agotado" no aparecía nunca.
-- 2. Comprobar-y-luego-actuar sin bloqueo: dos compras simultáneas de la última
--    unidad pasaban las dos.
-- 3. Líneas repetidas de la misma variante se validaban por separado: con 5
--    unidades, [{v,5},{v,5}] creaba un pedido de 10.
-- 4. Se podían comprar productos en borrador o archivados conociendo el UUID de
--    su variante (el checkout usa service_role, sin RLS que lo frenara).
-- 5. Pedido y líneas se insertaban en dos llamadas REST separadas: si fallaba la
--    segunda quedaba un pedido con totales y cero artículos.
-- 6. Los límites de uso de los cupones eran decorativos: nunca se registraba el
--    canje ni se incrementaba el contador.
-- 7. La página de confirmación se podía enumerar (los números de pedido son
--    secuenciales), exponiendo pedidos ajenos.
--
-- La solución es una única función transaccional: o se hace todo, o no se hace
-- nada. Postgres ya sabe hacer esto bien; el error era intentarlo desde la app.
-- =============================================================================

-- --- Token de confirmación ----------------------------------------------------
-- El número de pedido es secuencial y sirve para que el equipo lo mencione; NO
-- vale como credencial. La página de confirmación de un invitado se autentica
-- con este token opaco.
alter table public.orders
  add column if not exists confirmation_token text;

update public.orders
set confirmation_token = encode(extensions.gen_random_bytes(24), 'hex')
where confirmation_token is null;

alter table public.orders
  alter column confirmation_token set default encode(extensions.gen_random_bytes(24), 'hex');

alter table public.orders
  alter column confirmation_token set not null;

create unique index if not exists orders_confirmation_token_key
  on public.orders (confirmation_token);

comment on column public.orders.confirmation_token is
  'Credencial opaca para ver la confirmación sin sesión. Nunca reutilizar el order_number para esto.';

-- --- Creación de pedido -------------------------------------------------------
create or replace function public.create_order(
  p_email text,
  p_lines jsonb,
  p_shipping_address jsonb default null,
  p_shipping_method_id uuid default null,
  p_discount_code text default null,
  p_phone text default null,
  p_customer_note text default null,
  p_first_name text default null,
  p_last_name text default null
)
returns table (
  order_id uuid,
  order_number text,
  confirmation_token text,
  subtotal numeric,
  discount_total numeric,
  shipping_total numeric,
  total numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- Las líneas viajan como jsonb en variables locales, no en una tabla
  -- temporal: crear y destruir una tabla en cada compra ensucia el catálogo de
  -- Postgres a volumen, y además deja la función fuera del análisis estático
  -- (`supabase db lint`), que es donde se detectarían errores reales.
  v_pedidas       jsonb;   -- lo que pidió el cliente, agrupado por variante
  v_lineas        jsonb;   -- ya resueltas contra el catálogo y el stock
  v_sin_stock     uuid;
  v_customer_id   uuid;
  v_order_id      uuid;
  v_order_number  text;
  v_token         text;
  v_subtotal      numeric(12,2) := 0;
  v_discount      numeric(12,2) := 0;
  v_discount_id   uuid;
  v_shipping      numeric(12,2) := 0;
  v_total         numeric(12,2) := 0;
  v_method        record;
  v_shipping_snapshot jsonb := null;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'El carrito está vacío.' using errcode = 'P0001';
  end if;

  -- 1. Agrupar por variante ANTES de validar: dos líneas de la misma variante
  --    son una sola petición de stock, no dos independientes.
  select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'quantity', quantity))
  into v_pedidas
  from (
    select (line ->> 'variant_id')::uuid as variant_id,
           sum((line ->> 'quantity')::int) as quantity
    from jsonb_array_elements(p_lines) as line
    group by 1
  ) agrupadas;

  if exists (
    select 1 from jsonb_array_elements(v_pedidas) l where (l ->> 'quantity')::int <= 0
  ) then
    raise exception 'Las cantidades deben ser mayores que cero.' using errcode = 'P0001';
  end if;

  -- 2. Bloquear el inventario de todas las variantes implicadas, en orden de id
  --    para evitar interbloqueos entre compras simultáneas.
  perform 1
  from public.inventory i
  where i.variant_id in (
    select (l ->> 'variant_id')::uuid from jsonb_array_elements(v_pedidas) l
  )
  order by i.variant_id
  for update;

  -- 3. Resolver contra el catálogo con el stock ya bloqueado. Los JOIN filtran
  --    variantes inactivas y productos sin publicar: si alguna línea no
  --    sobrevive, el conteo no cuadra y se rechaza el pedido entero.
  select jsonb_agg(jsonb_build_object(
    'variant_id',    v.id,
    'quantity',      r.quantity,
    'unit_price',    v.price,
    'product_id',    v.product_id,
    'product_title', p.title,
    'variant_title', v.title,
    'sku',           v.sku,
    'tracked',       coalesce(inv.track_inventory, false),
    'available',     case
                       when coalesce(inv.track_inventory, false)
                            and not coalesce(inv.allow_backorder, false)
                         then greatest(inv.quantity - inv.reserved_quantity, 0)
                       else 2147483647
                     end
  ))
  into v_lineas
  from (
    select (l ->> 'variant_id')::uuid as variant_id, (l ->> 'quantity')::int as quantity
    from jsonb_array_elements(v_pedidas) l
  ) r
  join public.product_variants v on v.id = r.variant_id and v.is_active
  join public.products p on p.id = v.product_id and p.status = 'active'
  left join public.inventory inv on inv.variant_id = v.id;

  if v_lineas is null
     or jsonb_array_length(v_lineas) <> jsonb_array_length(v_pedidas) then
    raise exception 'Alguno de los productos ya no está disponible para la venta.'
      using errcode = 'P0002';
  end if;

  select (l ->> 'variant_id')::uuid into v_sin_stock
  from jsonb_array_elements(v_lineas) l
  where (l ->> 'available')::bigint < (l ->> 'quantity')::int
  limit 1;

  if v_sin_stock is not null then
    raise exception 'Stock insuficiente para la variante %.', v_sin_stock
      using errcode = 'P0003';
  end if;

  select coalesce(sum(round((l ->> 'unit_price')::numeric * (l ->> 'quantity')::int, 2)), 0)
  into v_subtotal
  from jsonb_array_elements(v_lineas) l;

  -- 4. Ficha de cliente: se reutiliza por email o se crea.
  insert into public.customers (email, first_name, last_name, phone)
  values (p_email, p_first_name, p_last_name, p_phone)
  on conflict (email) do update
    set first_name = coalesce(public.customers.first_name, excluded.first_name),
        last_name  = coalesce(public.customers.last_name, excluded.last_name),
        phone      = coalesce(public.customers.phone, excluded.phone),
        updated_at = now()
  returning id into v_customer_id;

  -- 5. Descuento, ahora sí con el cliente para aplicar el límite por persona.
  if p_discount_code is not null and length(trim(p_discount_code)) > 0 then
    select d.discount_id, d.amount into v_discount_id, v_discount
    from public.validate_discount(p_discount_code, v_subtotal, v_customer_id) d
    where d.is_valid;

    if not found then
      raise exception 'El código de descuento no es válido.' using errcode = 'P0004';
    end if;
  end if;

  v_discount := least(coalesce(v_discount, 0), v_subtotal);

  -- 6. Envío: el umbral de gratuidad se evalúa sobre el subtotal ya descontado.
  if p_shipping_method_id is not null then
    select * into v_method
    from public.shipping_methods
    where id = p_shipping_method_id and is_active;

    if not found then
      raise exception 'El método de envío no está disponible.' using errcode = 'P0005';
    end if;

    v_shipping := case
      when v_method.free_above_subtotal is not null
           and (v_subtotal - v_discount) >= v_method.free_above_subtotal then 0
      else v_method.price
    end;

    v_shipping_snapshot := jsonb_build_object(
      'id', v_method.id, 'name', v_method.name, 'price', v_shipping
    );
  end if;

  v_total := round(v_subtotal - v_discount + v_shipping, 2);

  -- 7. Pedido.
  insert into public.orders (
    customer_id, email, phone, subtotal, discount_total, shipping_total, total,
    discount_code, shipping_address, shipping_method, customer_note
  )
  values (
    v_customer_id, p_email, p_phone, v_subtotal, v_discount, v_shipping, v_total,
    nullif(trim(coalesce(p_discount_code, '')), ''), p_shipping_address,
    v_shipping_snapshot, p_customer_note
  )
  returning id, public.orders.order_number, public.orders.confirmation_token
  into v_order_id, v_order_number, v_token;

  -- 8. Líneas, con instantánea del producto en el momento de la compra.
  insert into public.order_items (
    order_id, variant_id, product_id, product_title, variant_title, sku,
    unit_price, quantity, total
  )
  select
    v_order_id,
    (l ->> 'variant_id')::uuid,
    (l ->> 'product_id')::uuid,
    l ->> 'product_title',
    l ->> 'variant_title',
    l ->> 'sku',
    (l ->> 'unit_price')::numeric,
    (l ->> 'quantity')::int,
    round((l ->> 'unit_price')::numeric * (l ->> 'quantity')::int, 2)
  from jsonb_array_elements(v_lineas) l;

  -- 9. Reservar el stock. Esta es la línea que faltaba: sin ella se vende aire.
  update public.inventory i
  set reserved_quantity = i.reserved_quantity + (l ->> 'quantity')::int
  from jsonb_array_elements(v_lineas) l
  where i.variant_id = (l ->> 'variant_id')::uuid
    and i.track_inventory;

  -- 10. Registrar el canje para que los límites del cupón signifiquen algo.
  if v_discount_id is not null then
    insert into public.discount_redemptions (discount_id, customer_id, order_id, amount)
    values (v_discount_id, v_customer_id, v_order_id, v_discount);

    update public.discounts
    set usage_count = usage_count + 1
    where id = v_discount_id;
  end if;

  return query select v_order_id, v_order_number, v_token, v_subtotal, v_discount, v_shipping, v_total;
end;
$$;

comment on function public.create_order is
  'Crea un pedido de forma atómica: valida catálogo y stock, bloquea inventario, reserva unidades y registra el canje del cupón. Única vía de creación de pedidos.';

-- Solo el servidor la invoca (service_role). Nunca desde el navegador.
revoke all on function public.create_order from anon, authenticated;

-- --- Liberación de stock ------------------------------------------------------
-- Al cancelar o reembolsar hay que devolver las unidades reservadas; al cumplir
-- el pedido, descontarlas del stock real.
create or replace function public.release_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pedido cancelado o reembolsado: la reserva se libera.
  if new.status in ('cancelled', 'refunded') and old.status not in ('cancelled', 'refunded') then
    update public.inventory i
    set reserved_quantity = greatest(i.reserved_quantity - oi.quantity, 0)
    from public.order_items oi
    where oi.order_id = new.id and i.variant_id = oi.variant_id and i.track_inventory;
  end if;

  -- Pedido entregado: la reserva se convierte en salida real de inventario.
  if new.fulfillment_status = 'fulfilled' and old.fulfillment_status <> 'fulfilled' then
    update public.inventory i
    set quantity = greatest(i.quantity - oi.quantity, 0),
        reserved_quantity = greatest(i.reserved_quantity - oi.quantity, 0)
    from public.order_items oi
    where oi.order_id = new.id and i.variant_id = oi.variant_id and i.track_inventory;
  end if;

  return null;
end;
$$;

drop trigger if exists on_order_inventory_change on public.orders;
create trigger on_order_inventory_change
  after update of status, fulfillment_status on public.orders
  for each row execute function public.release_order_inventory();
